import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  procesarRenglones,
  procesarOrdenCambio,
  reconstruirVigente,
  type RenglonInput,
  type RenglonBase,
  type RenglonOC,
  type OCInput,
} from "@/lib/presupuesto-utils";

async function getCompanyAndIsDirector(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const { data: dir } = await supabase
    .from("user_roles").select("id")
    .eq("user_id", userId).eq("company_id", profile.company_id).eq("role", "director")
    .maybeSingle();
  return { companyId: profile.company_id as string, isDirector: !!dir };
}

async function getObraRole(supabase: any, userId: string, obraId: string) {
  const { data } = await supabase
    .from("obra_team").select("role")
    .eq("obra_id", obraId).eq("user_id", userId).maybeSingle();
  const role = (data?.role ?? null) as string | null;
  return {
    isResidente: role === "residente",
    isSupervisor: role === "supervisor",
    role,
  };
}

/**
 * Recalcula obras.monto_contratado como la suma del monto_total de todos los
 * presupuestos autorizados de la obra (base + órdenes de cambio).
 */
async function recalcularMontoContratado(supabase: any, obraId: string) {
  const { data: rows, error } = await supabase
    .from("obra_presupuestos")
    .select("monto_total")
    .eq("obra_id", obraId)
    .eq("estatus", "autorizado");
  if (error) throw new Error(error.message);
  const total = (rows ?? []).reduce(
    (acc: number, r: { monto_total: number | null }) =>
      acc + (Number(r.monto_total) || 0),
    0,
  );
  const { error: updErr } = await supabase
    .from("obras")
    .update({ monto_contratado: total })
    .eq("id", obraId);
  if (updErr) throw new Error(updErr.message);
}

export const listPresupuestos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("obra_presupuestos")
      .select("id, tipo, numero, nombre, descripcion, estatus, monto_total, enviado_at, enviado_por, autorizado_at, autorizado_por, rechazado_at, rechazado_por, rechazo_motivo, created_at")
      .eq("obra_id", data.obraId)
      .order("tipo", { ascending: true })
      .order("numero", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPresupuesto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: presupuesto, error } = await supabase
      .from("obra_presupuestos")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: renglones, error: e2 } = await supabase
      .from("obra_presupuesto_renglones")
      .select("*")
      .eq("presupuesto_id", data.id)
      .order("orden", { ascending: true });
    if (e2) throw new Error(e2.message);
    return { presupuesto, renglones: renglones ?? [] };
  });

export const crearPresupuesto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      tipo: z.enum(["base", "adenda"]),
      nombre: z.string().trim().min(1).max(255),
      descripcion: z.string().trim().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getCompanyAndIsDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede crear presupuestos");

    let numero = 0;
    if (data.tipo === "adenda") {
      const { data: maxRow } = await supabase
        .from("obra_presupuestos")
        .select("numero")
        .eq("obra_id", data.obraId)
        .eq("tipo", "adenda")
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();
      numero = (maxRow?.numero ?? 0) + 1;
    } else {
      // Solo permitir un base (en borrador o autorizado)
      const { data: existing } = await supabase
        .from("obra_presupuestos").select("id")
        .eq("obra_id", data.obraId).eq("tipo", "base").limit(1).maybeSingle();
      if (existing) throw new Error("Ya existe un presupuesto base para esta obra");
    }

    const { data: created, error } = await supabase
      .from("obra_presupuestos")
      .insert({
        obra_id: data.obraId,
        company_id: companyId,
        tipo: data.tipo,
        numero,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

const renglonSchema = z.object({
  clave: z.string().trim().min(1).max(50),
  concepto: z.string().trim().min(1).max(500),
  unidad: z.string().trim().max(20).nullable().optional(),
  cantidad: z.number().finite().nullable().optional(),
  precio_unitario: z.number().finite().nullable().optional(),
});

export const guardarRenglones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      presupuestoId: z.string().uuid(),
      renglones: z.array(renglonSchema).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector } = await getCompanyAndIsDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede editar presupuestos");

    const { data: presupuesto } = await supabase
      .from("obra_presupuestos").select("id, estatus")
      .eq("id", data.presupuestoId).single();
    if (!presupuesto) throw new Error("Presupuesto no encontrado");
    if (presupuesto.estatus === "autorizado")
      throw new Error("El presupuesto está autorizado y no se puede editar. Crea una adenda.");

    const { renglones, errores, montoTotal } = procesarRenglones(data.renglones as RenglonInput[]);
    if (errores.length > 0) {
      throw new Error(
        `Errores en ${errores.length} renglón(es): ${errores
          .slice(0, 3)
          .map((e) => `${e.clave || "(s/c)"}: ${e.errores.join(", ")}`)
          .join(" | ")}`,
      );
    }

    // Reemplazar todos los renglones
    const { error: delErr } = await supabase
      .from("obra_presupuesto_renglones")
      .delete()
      .eq("presupuesto_id", data.presupuestoId);
    if (delErr) throw new Error(delErr.message);

    if (renglones.length > 0) {
      const rows = renglones.map((r) => ({
        presupuesto_id: data.presupuestoId,
        clave: r.clave,
        nivel: r.nivel,
        parent_clave: r.parent_clave,
        concepto: r.concepto,
        unidad: r.unidad,
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
        importe: r.importe,
        es_grupo: r.es_grupo,
        orden: r.orden,
      }));
      const { error: insErr } = await supabase
        .from("obra_presupuesto_renglones")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    const { error: updErr } = await supabase
      .from("obra_presupuestos")
      .update({ monto_total: montoTotal })
      .eq("id", data.presupuestoId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, montoTotal, renglonesCount: renglones.length };
  });

export const autorizarPresupuesto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector } = await getCompanyAndIsDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede autorizar presupuestos");

    const { data: pres, error: pErr } = await supabase
      .from("obra_presupuestos")
      .select("obra_id")
      .eq("id", data.id)
      .single();
    if (pErr) throw new Error(pErr.message);

    const { count } = await supabase
      .from("obra_presupuesto_renglones")
      .select("id", { count: "exact", head: true })
      .eq("presupuesto_id", data.id);
    if (!count || count === 0)
      throw new Error("El presupuesto no tiene renglones cargados");

    const { error } = await supabase
      .from("obra_presupuestos")
      .update({
        estatus: "autorizado",
        autorizado_por: userId,
        autorizado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await recalcularMontoContratado(supabase, pres.obra_id);
    return { ok: true };
  });

export const eliminarPresupuesto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector } = await getCompanyAndIsDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede eliminar");
    const { data: p } = await supabase
      .from("obra_presupuestos").select("estatus").eq("id", data.id).single();
    if (p?.estatus === "autorizado")
      throw new Error("No se puede eliminar un presupuesto autorizado");
    const { error } = await supabase
      .from("obra_presupuestos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Parsea un .xlsx base64 y devuelve los renglones detectados (sin guardar). */
export const parsearExcelPresupuesto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ fileBase64: z.string().min(1).max(20_000_000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const XLSX = await import("xlsx");
    const buffer = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("El archivo no tiene hojas");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const normalized: RenglonInput[] = rows
      .map((r) => {
        // Buscar columnas por nombre (case-insensitive, sin acentos)
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const entries: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) entries[norm(k)] = v;
        const numOrNull = (v: unknown): number | null => {
          if (v === null || v === undefined || v === "") return null;
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        };
        return {
          clave: String(entries["clave"] ?? "").trim(),
          concepto: String(entries["concepto"] ?? "").trim(),
          unidad: entries["unidad"] ? String(entries["unidad"]).trim() : null,
          cantidad: numOrNull(entries["cantidad"]),
          precio_unitario: numOrNull(entries["pu"] ?? entries["precio unitario"] ?? entries["precio_unitario"]),
        };
      })
      .filter((r) => r.clave || r.concepto);
    return { renglones: normalized };
  });

/** Genera la plantilla .xlsx en base64. */
export const descargarPlantillaPresupuesto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const data = [
      ["Clave", "Concepto", "Unidad", "Cantidad", "PU"],
      ["1", "Preliminares", "", "", ""],
      ["1.1", "Trazo y nivelación", "m2", 100, 50],
      ["1.2", "Limpieza del terreno", "m2", 100, 20],
      ["2", "Cimentación", "", "", ""],
      ["2.1", "Excavación", "m3", 50, 250],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");
    const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    return { fileBase64: b64 as string };
  });

// ============================================================
// Órdenes de cambio + presupuesto vigente
// ============================================================

async function loadBaseYOcs(supabase: any, obraId: string) {
  const { data: presupuestos, error } = await supabase
    .from("obra_presupuestos")
    .select("id, tipo, numero, nombre, estatus")
    .eq("obra_id", obraId);
  if (error) throw new Error(error.message);

  const base = (presupuestos ?? []).find(
    (p: any) => p.tipo === "base" && p.estatus === "autorizado",
  );
  const ocs = (presupuestos ?? [])
    .filter((p: any) => p.tipo === "adenda" && p.estatus === "autorizado")
    .sort((a: any, b: any) => a.numero - b.numero);

  let baseRenglones: RenglonBase[] = [];
  if (base) {
    const { data: r } = await supabase
      .from("obra_presupuesto_renglones")
      .select("*")
      .eq("presupuesto_id", base.id)
      .order("orden", { ascending: true });
    baseRenglones = (r ?? []).map((x: any) => ({
      clave: x.clave,
      concepto: x.concepto,
      unidad: x.unidad,
      cantidad: x.cantidad != null ? Number(x.cantidad) : null,
      precio_unitario: x.precio_unitario != null ? Number(x.precio_unitario) : null,
      importe: Number(x.importe ?? 0),
      es_grupo: !!x.es_grupo,
      nivel: x.nivel,
      parent_clave: x.parent_clave,
    }));
  }

  const ocsRenglones: RenglonOC[][] = [];
  for (const oc of ocs) {
    const { data: r } = await supabase
      .from("obra_presupuesto_renglones")
      .select("*")
      .eq("presupuesto_id", oc.id)
      .order("orden", { ascending: true });
    ocsRenglones.push(
      (r ?? [])
        .filter((x: any) => x.tipo_movimiento && x.tipo_movimiento !== "renglon")
        .map((x: any) => ({
          clave: x.clave,
          tipo_movimiento: x.tipo_movimiento,
          importe_delta: Number(x.importe_delta ?? 0),
          concepto: x.concepto,
          unidad: x.unidad,
          cantidad: x.cantidad != null ? Number(x.cantidad) : null,
          precio_unitario: x.precio_unitario != null ? Number(x.precio_unitario) : null,
        })),
    );
  }

  return { base, ocs, baseRenglones, ocsRenglones };
}

export const getVigente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { base, baseRenglones, ocsRenglones } = await loadBaseYOcs(supabase, data.obraId);
    if (!base) return { vigente: [], montoTotal: 0, hasBase: false };
    const { vigente, montoTotal } = reconstruirVigente(baseRenglones, ocsRenglones);
    return { vigente, montoTotal, hasBase: true };
  });

const ocInputSchema = z.object({
  clave: z.string().trim().min(1).max(50),
  tipo_movimiento: z.enum(["modificacion", "adicion", "eliminacion"]),
  concepto: z.string().trim().max(500).optional(),
  unidad: z.string().trim().max(20).nullable().optional(),
  cantidad: z.number().finite().nullable().optional(),
  precio_unitario: z.number().finite().nullable().optional(),
});

export const guardarRenglonesOC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      presupuestoId: z.string().uuid(),
      renglones: z.array(ocInputSchema).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector } = await getCompanyAndIsDirector(supabase, userId);
    if (!isDirector) throw new Error("Solo el Director puede editar órdenes de cambio");

    const { data: presupuesto } = await supabase
      .from("obra_presupuestos")
      .select("id, obra_id, tipo, estatus")
      .eq("id", data.presupuestoId)
      .single();
    if (!presupuesto) throw new Error("Presupuesto no encontrado");
    if (presupuesto.tipo !== "adenda")
      throw new Error("Este endpoint es solo para órdenes de cambio");
    if (presupuesto.estatus === "autorizado")
      throw new Error("La orden de cambio está autorizada y no se puede editar");

    // Reconstruir el vigente SIN incluir esta OC (aunque no esté autorizada, igual la excluimos)
    const { baseRenglones, ocsRenglones } = await loadBaseYOcs(supabase, presupuesto.obra_id);
    const { vigente } = reconstruirVigente(baseRenglones, ocsRenglones);

    const { renglones, errores, montoDelta } = procesarOrdenCambio(
      vigente,
      data.renglones as OCInput[],
    );
    if (errores.length > 0) {
      throw new Error(
        `Errores en ${errores.length} renglón(es): ${errores
          .slice(0, 3)
          .map((e) => `${e.clave || "(s/c)"}: ${e.errores.join(", ")}`)
          .join(" | ")}`,
      );
    }

    const { error: delErr } = await supabase
      .from("obra_presupuesto_renglones")
      .delete()
      .eq("presupuesto_id", data.presupuestoId);
    if (delErr) throw new Error(delErr.message);

    if (renglones.length > 0) {
      const rows = renglones.map((r) => ({
        presupuesto_id: data.presupuestoId,
        clave: r.clave,
        nivel: r.nivel,
        parent_clave: r.parent_clave,
        concepto: r.concepto,
        unidad: r.unidad,
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
        importe:
          r.tipo_movimiento === "adicion" || r.tipo_movimiento === "modificacion"
            ? Number(r.cantidad ?? 0) * Number(r.precio_unitario ?? 0)
            : 0,
        importe_delta: r.importe_delta,
        tipo_movimiento: r.tipo_movimiento,
        es_grupo: false,
        orden: r.orden,
      }));
      const { error: insErr } = await supabase
        .from("obra_presupuesto_renglones")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    const { error: updErr } = await supabase
      .from("obra_presupuestos")
      .update({ monto_total: montoDelta })
      .eq("id", data.presupuestoId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, montoDelta, renglonesCount: renglones.length };
  });

