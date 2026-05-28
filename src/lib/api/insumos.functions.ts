import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UNIDADES = ["KG", "M2", "M3", "ML", "PZA", "LT", "TON"] as const;

async function getUserCompanyAndDirector(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const { data: roles } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("company_id", profile.company_id);
  const isDirector = (roles ?? []).some((r: any) => r.role === "director");
  return { companyId: profile.company_id as string, isDirector };
}

export const listInsumos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      estatus: z.enum(["autorizado", "pendiente"]).optional(),
      categoriaId: z.string().uuid().nullable().optional(),
      unidad: z.enum(UNIDADES).optional(),
      search: z.string().trim().max(200).optional(),
    }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("insumos")
      .select("id, nombre, unidad, estatus, categoria_id, solicitado_por, created_at, autorizado_at, categoria:insumo_categorias(id, nombre)")
      .order("created_at", { ascending: false });
    if (data.estatus) q = q.eq("estatus", data.estatus);
    if (data.categoriaId) q = q.eq("categoria_id", data.categoriaId);
    if (data.unidad) q = q.eq("unidad", data.unidad);
    if (data.search) q = q.ilike("nombre", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    const userIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.solicitado_por).filter(Boolean))
    );

    let priceMap = new Map<string, { precio: number; proveedor: string | null; fecha: string }>();
    if (ids.length > 0) {
      const { data: precios } = await supabase
        .from("insumos_historial_precios")
        .select("insumo_id, precio_unitario, proveedor, fecha")
        .in("insumo_id", ids)
        .order("fecha", { ascending: false });
      for (const p of precios ?? []) {
        if (!priceMap.has(p.insumo_id)) {
          priceMap.set(p.insumo_id, {
            precio: Number(p.precio_unitario),
            proveedor: p.proveedor,
            fecha: p.fecha,
          });
        }
      }
    }

    let profileMap = new Map<string, { nombre_completo: string; email: string }>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, nombre_completo, email").in("id", userIds);
      for (const p of profs ?? []) profileMap.set(p.id, p);
    }

    return (rows ?? []).map((r: any) => ({
      ...r,
      ultimo_precio: priceMap.get(r.id) ?? null,
      solicitante: r.solicitado_por ? profileMap.get(r.solicitado_por) ?? null : null,
    }));
  });

export const getMetricasInsumos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ count: total }, { count: pendientes }, cats, hist] = await Promise.all([
      supabase.from("insumos").select("*", { count: "exact", head: true }),
      supabase.from("insumos").select("*", { count: "exact", head: true }).eq("estatus", "pendiente"),
      supabase.from("insumo_categorias").select("id", { count: "exact", head: true }),
      supabase.from("insumos_historial_precios").select("insumo_id"),
    ]);
    const conHistorial = new Set((hist.data ?? []).map((r: any) => r.insumo_id)).size;
    return {
      total: total ?? 0,
      pendientes: pendientes ?? 0,
      categorias: cats.count ?? 0,
      conHistorial,
    };
  });

export const listCategorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("insumo_categorias").select("id, nombre").order("nombre");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const solicitarInsumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      nombre: z.string().trim().min(1).max(200),
      unidad: z.enum(UNIDADES),
      categoriaId: z.string().uuid().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getUserCompanyAndDirector(supabase, userId);
    const { error } = await supabase.from("insumos").insert({
      company_id: companyId,
      categoria_id: data.categoriaId,
      nombre: data.nombre,
      unidad: data.unidad,
      estatus: "pendiente",
      solicitado_por: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editarInsumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      nombre: z.string().trim().min(1).max(200),
      unidad: z.enum(UNIDADES),
      categoriaId: z.string().uuid().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("insumos")
      .update({ nombre: data.nombre, unidad: data.unidad, categoria_id: data.categoriaId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const autorizarInsumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector } = await getUserCompanyAndDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede autorizar");
    const { error } = await supabase
      .from("insumos")
      .update({ estatus: "autorizado", autorizado_por: userId, autorizado_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rechazarInsumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector } = await getUserCompanyAndDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede rechazar");
    const { error } = await supabase.from("insumos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const crearCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ nombre: z.string().trim().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getUserCompanyAndDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede crear categorías");
    const { error } = await supabase
      .from("insumo_categorias").insert({ company_id: companyId, nombre: data.nombre });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editarCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), nombre: z.string().trim().min(1).max(100) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("insumo_categorias").update({ nombre: data.nombre }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { count } = await supabase
      .from("insumos").select("id", { count: "exact", head: true }).eq("categoria_id", data.id);
    if ((count ?? 0) > 0) throw new Error("No se puede eliminar: la categoría tiene insumos asociados");
    const { error } = await supabase.from("insumo_categorias").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getHistorialPrecios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ insumoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("insumos_historial_precios")
      .select("id, precio_unitario, proveedor, fecha, cantidad, obra_id")
      .eq("insumo_id", data.insumoId)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export class ImportarInsumosValidationError extends Error {
  errores: { row: number; nombre: string; unidad: string; categoria: string; error: string }[];
  constructor(errores: { row: number; nombre: string; unidad: string; categoria: string; error: string }[]) {
    super(`${errores.length} errores de validación`);
    this.errores = errores;
  }
}

export const importarInsumos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      filas: z.array(
        z.object({
          nombre: z.string().trim().min(1).max(200),
          unidad: z.enum(UNIDADES),
          categoria: z.string().trim().min(1).max(100),
          row: z.number().int().positive(),
        })
      ).min(1).max(500),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getUserCompanyAndDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede importar insumos");

    // Cargar insumos existentes de la compañía para detectar duplicados
    const { data: existingInsumos, error: exErr } = await supabase
      .from("insumos").select("nombre").eq("company_id", companyId);
    if (exErr) throw new Error(exErr.message);
    const existingNames = new Set(
      (existingInsumos ?? []).map((i: any) => String(i.nombre).trim().toLowerCase())
    );

    // Validar duplicados contra BD y duplicados internos
    const errores: { row: number; nombre: string; unidad: string; categoria: string; error: string }[] = [];
    const seenInFile = new Map<string, number>();
    for (const f of data.filas) {
      const key = f.nombre.trim().toLowerCase();
      if (existingNames.has(key)) {
        errores.push({ row: f.row, nombre: f.nombre, unidad: f.unidad, categoria: f.categoria, error: "Ya existe en la base de datos" });
      } else if (seenInFile.has(key)) {
        errores.push({ row: f.row, nombre: f.nombre, unidad: f.unidad, categoria: f.categoria, error: `Duplicado en el archivo (fila ${seenInFile.get(key)})` });
      } else {
        seenInFile.set(key, f.row);
      }
    }
    if (errores.length > 0) {
      throw new ImportarInsumosValidationError(errores);
    }

    // Cargar categorías existentes
    const { data: existingCats, error: catErr } = await supabase
      .from("insumo_categorias").select("id, nombre").eq("company_id", companyId);
    if (catErr) throw new Error(catErr.message);
    const catMap = new Map<string, string>();
    for (const c of existingCats ?? []) catMap.set(String(c.nombre).trim().toLowerCase(), c.id);

    // Crear categorías nuevas
    const nuevasCats = new Map<string, string>(); // key -> nombre original
    for (const f of data.filas) {
      const key = f.categoria.trim().toLowerCase();
      if (!catMap.has(key) && !nuevasCats.has(key)) {
        nuevasCats.set(key, f.categoria.trim());
      }
    }
    if (nuevasCats.size > 0) {
      const toInsert = Array.from(nuevasCats.values()).map((nombre) => ({ company_id: companyId, nombre }));
      const { data: inserted, error: insCatErr } = await supabase
        .from("insumo_categorias").insert(toInsert).select("id, nombre");
      if (insCatErr) throw new Error(`Error creando categorías: ${insCatErr.message}`);
      for (const c of inserted ?? []) catMap.set(String(c.nombre).trim().toLowerCase(), c.id);
    }

    // Bulk insert insumos como autorizados
    const now = new Date().toISOString();
    const rows = data.filas.map((f) => ({
      company_id: companyId,
      categoria_id: catMap.get(f.categoria.trim().toLowerCase()) ?? null,
      nombre: f.nombre.trim(),
      unidad: f.unidad,
      estatus: "autorizado" as const,
      solicitado_por: userId,
      autorizado_por: userId,
      autorizado_at: now,
    }));
    const { error: insErr } = await supabase.from("insumos").insert(rows);
    if (insErr) throw new Error(`Error insertando insumos: ${insErr.message}`);

    return { insertadas: rows.length, categoriasCreadas: nuevasCats.size };
  });
