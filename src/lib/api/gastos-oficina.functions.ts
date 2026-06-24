import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Context helper
// ============================================================
async function getCtx(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const companyId = profile.company_id as string;
  const { data: roles } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("company_id", companyId);
  const set = new Set((roles ?? []).map((r: any) => r.role as string));
  return {
    companyId,
    isDirector: set.has("director"),
    isAdministrativo: set.has("administrativo"),
  };
}

function ensureCanAprobar(ctx: { isDirector: boolean; isAdministrativo: boolean }) {
  if (!ctx.isDirector && !ctx.isAdministrativo) {
    throw new Error("Solo dirección o administrativo puede ejecutar esta acción");
  }
}

// ============================================================
// Types
// ============================================================
export type GastoOficinaTipo = "nomina_oficina" | "servicio" | "papeleria" | "otro";
export type GastoOficinaEstatus =
  | "pendiente_aprobacion"
  | "aprobada"
  | "rechazada"
  | "pagada"
  | "cancelada";

export type GastoOficinaRow = {
  id: string;
  folio: string;
  tipo: GastoOficinaTipo;
  concepto: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  beneficiario_trabajador_id: string | null;
  beneficiario_nombre: string | null;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  monto: number;
  fecha_gasto: string;
  fecha_requerida_pago: string | null;
  notas: string | null;
  evidencia_url: string | null;
  estatus: GastoOficinaEstatus;
  cxp_id: string | null;
  motivo_rechazo: string | null;
  solicitado_por: string;
  solicitado_por_nombre: string | null;
  aprobado_por: string | null;
  aprobado_at: string | null;
  created_at: string;
};

// ============================================================
// LIST
// ============================================================
export const listGastosOficina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { estatus?: GastoOficinaEstatus[] } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);

    let q = supabase
      .from("gastos_oficina")
      .select(`
        id, folio, tipo, concepto,
        proveedor_id, beneficiario_trabajador_id,
        periodo_inicio, periodo_fin, monto, fecha_gasto, fecha_requerida_pago,
        notas, evidencia_url, estatus, cxp_id, motivo_rechazo,
        solicitado_por, aprobado_por, aprobado_at, created_at,
        proveedor:terceros!gastos_oficina_proveedor_id_fkey(razon_social),
        trabajador:trabajadores!gastos_oficina_beneficiario_trabajador_id_fkey(nombre_completo),
        solicitante:profiles!gastos_oficina_solicitado_por_fkey(nombre_completo)
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (data.estatus && data.estatus.length > 0) {
      q = q.in("estatus", data.estatus);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      folio: r.folio,
      tipo: r.tipo,
      concepto: r.concepto,
      proveedor_id: r.proveedor_id,
      proveedor_nombre: r.proveedor?.razon_social ?? null,
      beneficiario_trabajador_id: r.beneficiario_trabajador_id,
      beneficiario_nombre: r.trabajador?.nombre_completo ?? null,
      periodo_inicio: r.periodo_inicio,
      periodo_fin: r.periodo_fin,
      monto: Number(r.monto),
      fecha_gasto: r.fecha_gasto,
      fecha_requerida_pago: r.fecha_requerida_pago,
      notas: r.notas,
      evidencia_url: r.evidencia_url,
      estatus: r.estatus,
      cxp_id: r.cxp_id,
      motivo_rechazo: r.motivo_rechazo,
      solicitado_por: r.solicitado_por,
      solicitado_por_nombre: r.solicitante?.nombre_completo ?? null,
      aprobado_por: r.aprobado_por,
      aprobado_at: r.aprobado_at,
      created_at: r.created_at,
    })) as GastoOficinaRow[];
  });

// ============================================================
// CREAR solicitud
// ============================================================
const crearSchema = z.object({
  tipo: z.enum(["servicio", "papeleria", "otro"]),
  concepto: z.string().min(2).max(500),
  proveedorId: z.string().uuid().nullable().optional(),
  monto: z.number().positive(),
  fechaGasto: z.string(),
  fechaRequeridaPago: z.string().nullable().optional(),
  notas: z.string().max(2000).nullable().optional(),
  evidenciaUrl: z.string().nullable().optional(),
});

export const crearGastoOficina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => crearSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);

    const { data: folio, error: fErr } = await supabase
      .rpc("siguiente_folio_gasto_oficina", { _company_id: companyId });
    if (fErr) throw new Error(fErr.message);

    const { data: row, error } = await supabase
      .from("gastos_oficina")
      .insert({
        company_id: companyId,
        folio,
        tipo: data.tipo,
        concepto: data.concepto,
        proveedor_id: data.proveedorId ?? null,
        monto: data.monto,
        fecha_gasto: data.fechaGasto,
        fecha_requerida_pago: data.fechaRequeridaPago ?? null,
        notas: data.notas ?? null,
        evidencia_url: data.evidenciaUrl ?? null,
        solicitado_por: userId,
      })
      .select("id, folio")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============================================================
// APROBAR → crea CxP
// ============================================================
export const aprobarGastoOficina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    ensureCanAprobar(ctx);

    const { data: g, error: gErr } = await supabase
      .from("gastos_oficina").select("*").eq("id", data.id).single();
    if (gErr || !g) throw new Error("Gasto no encontrado");
    if (g.estatus !== "pendiente_aprobacion") throw new Error("Sólo se pueden aprobar solicitudes pendientes");

    // Resolver beneficiario para CxP
    let beneficiarioTipo: "tercero" | "trabajador" = "tercero";
    let beneficiarioId: string | null = null;
    let beneficiarioNombre = "Gasto de oficina";

    if (g.tipo === "nomina_oficina" && g.beneficiario_trabajador_id) {
      beneficiarioTipo = "trabajador";
      beneficiarioId = g.beneficiario_trabajador_id;
      const { data: trab } = await supabase
        .from("trabajadores").select("nombre_completo").eq("id", g.beneficiario_trabajador_id).maybeSingle();
      beneficiarioNombre = trab?.nombre_completo ?? "Trabajador";
    } else if (g.proveedor_id) {
      beneficiarioTipo = "tercero";
      beneficiarioId = g.proveedor_id;
      const { data: prov } = await supabase
        .from("terceros").select("razon_social").eq("id", g.proveedor_id).maybeSingle();
      beneficiarioNombre = prov?.razon_social ?? "Proveedor";
    } else {
      throw new Error("La solicitud debe tener proveedor o beneficiario antes de aprobarse");
    }

    if (!beneficiarioId) throw new Error("Beneficiario inválido");

    const { data: cxpFolio, error: cfErr } = await supabase
      .rpc("siguiente_folio_cxp", { _company_id: ctx.companyId });
    if (cfErr) throw new Error(cfErr.message);

    const { data: cxp, error: cxpErr } = await supabase
      .from("cuentas_por_pagar")
      .insert({
        company_id: ctx.companyId,
        obra_id: null,
        folio: cxpFolio,
        fecha_emision: new Date().toISOString().slice(0, 10),
        fecha_vencimiento: g.fecha_requerida_pago,
        beneficiario_tipo: beneficiarioTipo,
        beneficiario_id: beneficiarioId,
        beneficiario_nombre: beneficiarioNombre,
        concepto: `${g.folio} · ${g.concepto}`,
        origen_tipo: "gasto_oficina",
        origen_id: g.id,
        monto_total: g.monto,
        monto_pagado: 0,
        estatus: "pendiente",
        creado_por: userId,
      })
      .select("id")
      .single();
    if (cxpErr) throw new Error(cxpErr.message);

    const { error: uErr } = await supabase
      .from("gastos_oficina")
      .update({
        estatus: "aprobada",
        cxp_id: cxp.id,
        aprobado_por: userId,
        aprobado_at: new Date().toISOString(),
      })
      .eq("id", g.id);
    if (uErr) throw new Error(uErr.message);

    return { ok: true, cxpId: cxp.id };
  });

// ============================================================
// RECHAZAR
// ============================================================
export const rechazarGastoOficina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; motivo: string }) =>
    z.object({ id: z.string().uuid(), motivo: z.string().min(2).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    ensureCanAprobar(ctx);

    const { error } = await supabase
      .from("gastos_oficina")
      .update({
        estatus: "rechazada",
        motivo_rechazo: data.motivo,
        aprobado_por: userId,
        aprobado_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("estatus", "pendiente_aprobacion");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// CANCELAR (solicitante o admin)
// ============================================================
export const cancelarGastoOficina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase
      .from("gastos_oficina").select("estatus, solicitado_por").eq("id", data.id).maybeSingle();
    if (!g) throw new Error("Gasto no encontrado");
    if (g.estatus !== "pendiente_aprobacion") {
      throw new Error("Sólo se pueden cancelar solicitudes pendientes");
    }
    const { error } = await supabase
      .from("gastos_oficina")
      .update({ estatus: "cancelada" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// PERSONAL DE OFICINA
// ============================================================
export type PersonalOficinaRow = {
  id: string;
  nombre_completo: string;
  puesto: string | null;
  periodicidad_pago: "semanal" | "quincenal" | "mensual" | null;
  sueldo_periodo: number | null;
};

export const listPersonalOficina = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    const { data, error } = await supabase
      .from("trabajadores")
      .select("id, nombre_completo, puesto, periodicidad_pago, sueldo_periodo")
      .eq("company_id", companyId)
      .eq("es_personal_oficina", true)
      .is("fecha_baja", null)
      .order("nombre_completo");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      nombre_completo: r.nombre_completo,
      puesto: r.puesto,
      periodicidad_pago: r.periodicidad_pago,
      sueldo_periodo: r.sueldo_periodo != null ? Number(r.sueldo_periodo) : null,
    })) as PersonalOficinaRow[];
  });

export const listTrabajadoresDisponibles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    const { data, error } = await supabase
      .from("trabajadores")
      .select("id, nombre_completo, puesto, es_personal_oficina")
      .eq("company_id", companyId)
      .is("fecha_baja", null)
      .order("nombre_completo");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string; nombre_completo: string; puesto: string | null; es_personal_oficina: boolean;
    }>;
  });

const setPersonalSchema = z.object({
  trabajadorId: z.string().uuid(),
  esPersonalOficina: z.boolean(),
  periodicidad: z.enum(["semanal", "quincenal", "mensual"]).nullable().optional(),
  sueldoPeriodo: z.number().nullable().optional(),
});

export const actualizarPersonalOficina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setPersonalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    ensureCanAprobar(ctx);

    const upd: Record<string, unknown> = {
      es_personal_oficina: data.esPersonalOficina,
    };
    if (data.esPersonalOficina) {
      upd.periodicidad_pago = data.periodicidad ?? null;
      upd.sueldo_periodo = data.sueldoPeriodo ?? null;
    } else {
      upd.periodicidad_pago = null;
      upd.sueldo_periodo = null;
    }

    const { error } = await supabase
      .from("trabajadores")
      .update(upd)
      .eq("id", data.trabajadorId)
      .eq("company_id", ctx.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// GENERAR nómina oficina del periodo
// ============================================================
const generarNominaSchema = z.object({
  periodicidad: z.enum(["semanal", "quincenal", "mensual"]),
  periodoInicio: z.string(),
  periodoFin: z.string(),
});

export const generarNominaOficinaDelPeriodo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => generarNominaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    ensureCanAprobar(ctx);

    const { data: personal, error: pErr } = await supabase
      .from("trabajadores")
      .select("id, nombre_completo, sueldo_periodo")
      .eq("company_id", ctx.companyId)
      .eq("es_personal_oficina", true)
      .eq("periodicidad_pago", data.periodicidad)
      .is("fecha_baja", null);
    if (pErr) throw new Error(pErr.message);

    let creados = 0;
    let omitidos = 0;
    for (const t of personal ?? []) {
      if (!t.sueldo_periodo || Number(t.sueldo_periodo) <= 0) {
        omitidos++;
        continue;
      }
      const { data: folio, error: fErr } = await supabase
        .rpc("siguiente_folio_gasto_oficina", { _company_id: ctx.companyId });
      if (fErr) throw new Error(fErr.message);

      const { error: insErr } = await supabase
        .from("gastos_oficina")
        .insert({
          company_id: ctx.companyId,
          folio,
          tipo: "nomina_oficina",
          concepto: `Nómina ${data.periodicidad} · ${t.nombre_completo} · ${data.periodoInicio} a ${data.periodoFin}`,
          beneficiario_trabajador_id: t.id,
          periodo_inicio: data.periodoInicio,
          periodo_fin: data.periodoFin,
          monto: Number(t.sueldo_periodo),
          fecha_gasto: data.periodoFin,
          fecha_requerida_pago: data.periodoFin,
          solicitado_por: userId,
        });
      if (insErr) {
        // duplicado (unique constraint) => contar como omitido
        if (insErr.code === "23505") {
          omitidos++;
          continue;
        }
        throw new Error(insErr.message);
      }
      creados++;
    }

    return { creados, omitidos, total: (personal ?? []).length };
  });
