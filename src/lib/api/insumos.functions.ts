import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UNIDAD_REGEX = /^[A-Z0-9]{1,10}$/;
const unidadSchema = z.string().trim().toUpperCase().regex(UNIDAD_REGEX, "Unidad: 1-10 caracteres (letras o números)");

async function validateUnidad(supabase: any, companyId: string, unidad: string) {
  const { count, error } = await supabase
    .from("insumo_unidades")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("codigo", unidad);
  if (error) throw new Error(error.message);
  if (!count) throw new Error(`Unidad "${unidad}" no existe. Créala desde el catálogo de unidades.`);
}

async function getUserCompanyAndDirector(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const { data: roles } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("company_id", profile.company_id);
  const isDirector = (roles ?? []).some((r: any) => r.role === "director");
  return { companyId: profile.company_id as string, isDirector };
}

const CODIGO_REGEX = /^[A-Z0-9]{2,5}-\d{3,6}$/;
const PREFIJO_REGEX = /^[A-Z0-9]{3}$/;

function derivarPrefijo(nombre: string): string {
  const clean = nombre.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (clean + "XXX").slice(0, 3);
}

async function prefijoUnico(
  supabase: any,
  companyId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base;
  for (let suffix = 1; suffix <= 99; suffix++) {
    let q = supabase
      .from("insumo_categorias")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("prefijo", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { count } = await q;
    if (!count) return candidate;
    candidate =
      suffix < 10
        ? base.slice(0, 2) + String(suffix + 1)
        : base.slice(0, 1) + String(suffix + 1).padStart(2, "0");
  }
  throw new Error("No se pudo generar un prefijo único");
}

export const listInsumos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      estatus: z.enum(["autorizado", "pendiente"]).optional(),
      categoriaId: z.string().uuid().nullable().optional(),
      unidad: unidadSchema.optional(),
      search: z.string().trim().max(200).optional(),
      soloRenta: z.boolean().optional(),
    }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("insumos")
      .select("id, codigo, nombre, unidad, estatus, categoria_id, solicitado_por, created_at, autorizado_at, disponible_renta, categoria:insumo_categorias(id, nombre, prefijo)")
      .order("created_at", { ascending: false });
    if (data.estatus) q = q.eq("estatus", data.estatus);
    if (data.categoriaId) q = q.eq("categoria_id", data.categoriaId);
    if (data.unidad) q = q.eq("unidad", data.unidad);
    if (data.soloRenta) q = q.eq("disponible_renta", true);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "\\$&");
      q = q.or(`nombre.ilike.%${s}%,codigo.ilike.%${s}%`);
    }
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
      unidad: unidadSchema,
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
      unidad: unidadSchema,
      categoriaId: z.string().uuid().nullable(),
      codigo: z.string().trim().toUpperCase().regex(CODIGO_REGEX, "Formato inválido (ej. CEM-0001)").optional(),
      disponibleRenta: z.boolean().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector } = await getUserCompanyAndDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede editar insumos");
    const patch: {
      nombre: string; unidad: typeof data.unidad; categoria_id: string | null; codigo?: string; disponible_renta?: boolean;
    } = {
      nombre: data.nombre,
      unidad: data.unidad,
      categoria_id: data.categoriaId,
    };
    if (data.codigo) patch.codigo = data.codigo;
    if (typeof data.disponibleRenta === "boolean") patch.disponible_renta = data.disponibleRenta;
    const { error } = await supabase.from("insumos").update(patch).eq("id", data.id);
    if (error) {
      if (error.message.includes("insumos_codigo_unique")) {
        throw new Error("Ese código ya existe en otro insumo");
      }
      throw new Error(error.message);
    }
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
  .inputValidator((d: unknown) =>
    z.object({
      nombre: z.string().trim().min(1).max(100),
      prefijo: z.string().trim().toUpperCase().regex(PREFIJO_REGEX, "Prefijo debe ser 3 letras o números").optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getUserCompanyAndDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede crear categorías");
    const base = data.prefijo ?? derivarPrefijo(data.nombre);
    const prefijo = data.prefijo ? base : await prefijoUnico(supabase, companyId, base);
    const { error } = await supabase
      .from("insumo_categorias").insert({ company_id: companyId, nombre: data.nombre, prefijo });
    if (error) {
      if (error.message.includes("insumo_categorias_prefijo_unique")) {
        throw new Error(`El prefijo "${prefijo}" ya está en uso`);
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const editarCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      nombre: z.string().trim().min(1).max(100),
      prefijo: z.string().trim().toUpperCase().regex(PREFIJO_REGEX, "Prefijo debe ser 3 letras o números").optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const patch: { nombre: string; prefijo?: string } = { nombre: data.nombre };
    if (data.prefijo) patch.prefijo = data.prefijo;
    const { error } = await context.supabase
      .from("insumo_categorias").update(patch).eq("id", data.id);
    if (error) {
      if (error.message.includes("insumo_categorias_prefijo_unique")) {
        throw new Error(`El prefijo "${data.prefijo}" ya está en uso`);
      }
      throw new Error(error.message);
    }
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

export const importarInsumos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      filas: z.array(
        z.object({
          nombre: z.string().trim().min(1).max(200),
          unidad: unidadSchema,
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
      return { ok: false as const, errores };
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
      const toInsert: { company_id: string; nombre: string; prefijo: string }[] = [];
      for (const nombre of nuevasCats.values()) {
        const base = derivarPrefijo(nombre);
        const prefijo = await prefijoUnico(supabase, companyId, base);
        toInsert.push({ company_id: companyId, nombre, prefijo });
      }
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

    return { ok: true as const, insertadas: rows.length, categoriasCreadas: nuevasCats.size };
  });
