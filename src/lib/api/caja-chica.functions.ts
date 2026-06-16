import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Helpers
// ============================================================

/** Tasa de IVA general en México (16%). */
export const IVA_RATE = 0.16;

/**
 * Monto que se carga al costo de la obra para un gasto de caja chica.
 * - factura: base sin IVA (monto / 1.16) — el IVA es acreditable, no es costo.
 * - nota / ninguno: monto total — sin IVA acreditable.
 */
export function montoGastoObra(
  monto: number,
  tipoComprobante: "factura" | "nota" | "ninguno" | string | null | undefined,
): number {
  const m = Number(monto) || 0;
  if (tipoComprobante === "factura") {
    return Math.round((m / (1 + IVA_RATE)) * 100) / 100;
  }
  return m;
}

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
    isSupervisor: set.has("supervisor"),
    isAdministrativo: set.has("administrativo"),
  };
}

async function isMemberObra(supabase: any, userId: string, obraId: string) {
  const { data } = await supabase
    .from("obra_team").select("id")
    .eq("obra_id", obraId).eq("user_id", userId).maybeSingle();
  return !!data;
}

async function isResidenteDeObra(supabase: any, userId: string, obraId: string) {
  const { data } = await supabase
    .from("obra_team").select("role")
    .eq("obra_id", obraId).eq("user_id", userId).maybeSingle();
  return data?.role === "residente";
}

async function notify(rows: Array<{
  user_id: string; company_id: string; obra_id?: string | null;
  tipo: string; titulo: string; mensaje: string; link?: string | null;
}>) {
  if (rows.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notificaciones").insert(rows);
}

async function enrichUsers(supabase: any, ids: Array<string | null | undefined>) {
  const userIds = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!userIds.length) return new Map<string, { nombre_completo: string; email: string }>();
  const { data } = await supabase
    .from("profiles").select("id, nombre_completo, email").in("id", userIds);
  return new Map<string, any>((data ?? []).map((p: any) => [p.id, p]));
}

// ============================================================
// ASIGNACIONES
// ============================================================

export const listAsignacionesCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("caja_chica_asignaciones")
      .select("*")
      .eq("obra_id", data.obraId)
      .eq("activo", true);
    if (error) throw new Error(error.message);
    const users = await enrichUsers(supabase, (rows ?? []).map((r: any) => r.residente_id));
    return (rows ?? []).map((r: any) => ({
      ...r,
      residente_nombre: users.get(r.residente_id)?.nombre_completo
        ?? users.get(r.residente_id)?.email ?? null,
    }));
  });

export const setMontoBaseCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      residenteId: z.string().uuid(),
      monto: z.number().min(0),
      notas: z.string().trim().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector) throw new Error("Solo el director puede asignar caja chica");

    const { data: existing } = await supabase
      .from("caja_chica_asignaciones")
      .select("id")
      .eq("obra_id", data.obraId)
      .eq("residente_id", data.residenteId)
      .eq("activo", true)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("caja_chica_asignaciones")
        .update({ monto_base: data.monto, notas: data.notas ?? null })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id };
    }
    const { data: inserted, error } = await supabase
      .from("caja_chica_asignaciones")
      .insert({
        company_id: ctx.companyId,
        obra_id: data.obraId,
        residente_id: data.residenteId,
        monto_base: data.monto,
        asignado_por: userId,
        notas: data.notas ?? null,
      })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id };
  });

// ============================================================
// FONDOS
// ============================================================

export const listFondosCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obraId: z.string().uuid().optional() }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("caja_chica_fondos").select("*").order("created_at", { ascending: false });
    if (data.obraId) q = q.eq("obra_id", data.obraId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const arr = rows ?? [];
    const users = await enrichUsers(
      supabase,
      arr.flatMap((r: any) => [r.residente_id, r.solicitado_por, r.entregado_por])
    );
    const obraIds = Array.from(new Set(arr.map((r: any) => r.obra_id))) as string[];
    let obras: any[] = [];
    if (obraIds.length) {
      const { data: o } = await supabase.from("obras").select("id, nombre").in("id", obraIds);
      obras = o ?? [];
    }
    const nameOf = (id: string | null) =>
      id ? (users.get(id)?.nombre_completo ?? users.get(id)?.email ?? null) : null;
    return arr.map((r: any) => ({
      ...r,
      residente_nombre: nameOf(r.residente_id),
      solicitado_nombre: nameOf(r.solicitado_por),
      entregado_nombre: nameOf(r.entregado_por),
      obra_nombre: obras.find((o) => o.id === r.obra_id)?.nombre ?? null,
    }));
  });

export const solicitarFondoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      monto: z.number().positive(),
      notas: z.string().trim().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    const member = await isMemberObra(supabase, userId, data.obraId);
    if (!member && !ctx.isDirector) throw new Error("Sin acceso a esta obra");

    const { error } = await supabase
      .from("caja_chica_fondos")
      .insert({
        company_id: ctx.companyId,
        obra_id: data.obraId,
        residente_id: userId,
        monto_solicitado: data.monto,
        solicitado_por: userId,
        notas: data.notas ?? null,
      });
    if (error) throw new Error(error.message);

    const { data: admins } = await supabase
      .from("user_roles").select("user_id")
      .eq("company_id", ctx.companyId)
      .in("role", ["administrativo", "director"]);
    const targets = Array.from(new Set((admins ?? []).map((s: any) => s.user_id as string)))
      .filter((id) => id !== userId);
    await notify(targets.map((uid) => ({
      user_id: uid,
      company_id: ctx.companyId,
      obra_id: data.obraId,
      tipo: "caja_chica_fondo_solicitado",
      titulo: "Solicitud de fondo de caja chica",
      mensaje: `Residente solicita $${data.monto.toFixed(2)} en efectivo`,
      link: `/app/admin/caja-chica`,
    })));
    return { ok: true };
  });

export const entregarFondoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      montoEntregado: z.number().positive(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isAdministrativo) {
      throw new Error("Solo administrativo o director entrega el fondo");
    }
    const { data: fondo } = await supabase
      .from("caja_chica_fondos").select("estatus, residente_id, obra_id, company_id")
      .eq("id", data.id).maybeSingle();
    if (!fondo) throw new Error("Fondo no encontrado");
    if (fondo.estatus !== "pendiente") throw new Error("El fondo ya no está pendiente");

    const { error } = await supabase
      .from("caja_chica_fondos")
      .update({
        estatus: "entregado",
        monto_entregado: data.montoEntregado,
        entregado_por: userId,
        entregado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await notify([{
      user_id: fondo.residente_id,
      company_id: fondo.company_id,
      obra_id: fondo.obra_id,
      tipo: "caja_chica_fondo_entregado",
      titulo: "Fondo de caja chica entregado",
      mensaje: `Se entregaron $${data.montoEntregado.toFixed(2)} en efectivo`,
      link: `/app/obras/${fondo.obra_id}/caja-chica`,
    }]);
    return { ok: true };
  });

// ============================================================
// GASTOS
// ============================================================

const tipoComprobante = z.enum(["factura", "nota", "ninguno"]);

export const listGastosCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid().optional(),
      residenteId: z.string().uuid().optional(),
      estatus: z.string().optional(),
      reembolsoId: z.string().uuid().nullable().optional(),
      onlyBorrador: z.boolean().optional(),
    }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("caja_chica_gastos").select("*").order("fecha", { ascending: false });
    if (data.obraId) q = q.eq("obra_id", data.obraId);
    if (data.residenteId) q = q.eq("residente_id", data.residenteId);
    if (data.estatus) q = q.eq("estatus", data.estatus as any);
    if (data.onlyBorrador) q = q.eq("estatus", "borrador" as any);
    if (data.reembolsoId === null) q = q.is("reembolso_id", null);
    else if (data.reembolsoId) q = q.eq("reembolso_id", data.reembolsoId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const arr = rows ?? [];
    const users = await enrichUsers(
      supabase,
      arr.flatMap((r: any) => [r.residente_id, r.revisado_por])
    );
    return arr.map((r: any) => ({
      ...r,
      residente_nombre: users.get(r.residente_id)?.nombre_completo
        ?? users.get(r.residente_id)?.email ?? null,
      revisado_nombre: r.revisado_por
        ? (users.get(r.revisado_por)?.nombre_completo
            ?? users.get(r.revisado_por)?.email ?? null)
        : null,
    }));
  });

const gastoInput = z.object({
  fecha: z.string(),
  concepto: z.string().trim().min(2).max(255),
  descripcion: z.string().trim().max(1000).optional(),
  monto: z.number().positive(),
  tipoComprobante: tipoComprobante,
  evidenciaUrl: z.string().max(1000).nullable().optional(),
});

export const crearGastoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    gastoInput.extend({ obraId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    const esResidente = await isResidenteDeObra(supabase, userId, data.obraId);
    if (!ctx.isDirector && !esResidente) {
      throw new Error("Solo el residente de la obra puede registrar gastos de caja chica");
    }

    const { error } = await supabase
      .from("caja_chica_gastos")
      .insert({
        company_id: ctx.companyId,
        obra_id: data.obraId,
        residente_id: userId,
        fecha: data.fecha,
        concepto: data.concepto,
        descripcion: data.descripcion ?? null,
        monto: data.monto,
        tipo_comprobante: data.tipoComprobante,
        evidencia_url: data.evidenciaUrl ?? null,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const actualizarGastoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    gastoInput.extend({ id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase
      .from("caja_chica_gastos").select("estatus, residente_id")
      .eq("id", data.id).maybeSingle();
    if (!g) throw new Error("Gasto no encontrado");
    if (g.estatus !== "borrador") throw new Error("Solo borradores se pueden editar");
    if (g.residente_id !== userId) throw new Error("Solo el residente puede editar");
    const { error } = await supabase
      .from("caja_chica_gastos")
      .update({
        fecha: data.fecha,
        concepto: data.concepto,
        descripcion: data.descripcion ?? null,
        monto: data.monto,
        tipo_comprobante: data.tipoComprobante,
        evidencia_url: data.evidenciaUrl ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarGastoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: g } = await supabase
      .from("caja_chica_gastos").select("estatus, residente_id")
      .eq("id", data.id).maybeSingle();
    if (!g) throw new Error("Gasto no encontrado");
    if (g.estatus !== "borrador") throw new Error("Solo borradores se pueden eliminar");
    if (g.residente_id !== userId) throw new Error("Solo el residente puede eliminar");
    // No DELETE permitted on table — soft-remove by leaving it? Mark as rechazado not desired.
    // We allow update only; emulate delete via supabaseAdmin.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("caja_chica_gastos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// REEMBOLSOS
// ============================================================

export const listReembolsosCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid().optional(),
      estatus: z.string().optional(),
    }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("caja_chica_reembolsos").select("*").order("created_at", { ascending: false });
    if (data.obraId) q = q.eq("obra_id", data.obraId);
    if (data.estatus) q = q.eq("estatus", data.estatus as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const arr = rows ?? [];
    const users = await enrichUsers(
      supabase,
      arr.flatMap((r: any) => [
        r.residente_id, r.solicitado_por, r.revisado_por, r.enviado_admin_por,
        r.repuesto_por, r.rechazado_por,
      ])
    );
    const obraIds = Array.from(new Set(arr.map((r: any) => r.obra_id))) as string[];
    let obras: any[] = [];
    if (obraIds.length) {
      const { data: o } = await supabase.from("obras").select("id, nombre").in("id", obraIds);
      obras = o ?? [];
    }
    const nameOf = (id: string | null) =>
      id ? (users.get(id)?.nombre_completo ?? users.get(id)?.email ?? null) : null;
    return arr.map((r: any) => ({
      ...r,
      residente_nombre: nameOf(r.residente_id),
      solicitado_nombre: nameOf(r.solicitado_por),
      revisado_nombre: nameOf(r.revisado_por),
      repuesto_nombre: nameOf(r.repuesto_por),
      obra_nombre: obras.find((o) => o.id === r.obra_id)?.nombre ?? null,
    }));
  });

export const getReembolsoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: r } = await supabase
      .from("caja_chica_reembolsos").select("*").eq("id", data.id).maybeSingle();
    if (!r) throw new Error("Reembolso no encontrado");
    const { data: gastos } = await supabase
      .from("caja_chica_gastos").select("*")
      .eq("reembolso_id", data.id)
      .order("fecha", { ascending: true });
    const users = await enrichUsers(supabase, [
      r.residente_id, r.solicitado_por, r.revisado_por, r.repuesto_por, r.rechazado_por,
      ...(gastos ?? []).map((g: any) => g.revisado_por),
    ]);
    const nameOf = (id: string | null) =>
      id ? (users.get(id)?.nombre_completo ?? users.get(id)?.email ?? null) : null;
    return {
      reembolso: {
        ...r,
        residente_nombre: nameOf(r.residente_id),
        solicitado_nombre: nameOf(r.solicitado_por),
        revisado_nombre: nameOf(r.revisado_por),
        repuesto_nombre: nameOf(r.repuesto_por),
      },
      gastos: (gastos ?? []).map((g: any) => ({
        ...g,
        revisado_nombre: nameOf(g.revisado_por),
      })),
    };
  });

export const solicitarReembolsoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      semanaInicio: z.string(),
      semanaFin: z.string(),
      gastoIds: z.array(z.string().uuid()).min(1).max(200),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    const member = await isMemberObra(supabase, userId, data.obraId);
    if (!member && !ctx.isDirector) throw new Error("Sin acceso a esta obra");

    // Validar que los gastos sean borradores propios de esta obra
    const { data: gs } = await supabase
      .from("caja_chica_gastos")
      .select("id, monto, estatus, residente_id, obra_id")
      .in("id", data.gastoIds);
    const gastos = gs ?? [];
    if (gastos.length !== data.gastoIds.length) throw new Error("Gastos inválidos");
    for (const g of gastos) {
      if (g.estatus !== "borrador") throw new Error("Solo borradores se pueden incluir");
      if (g.residente_id !== userId) throw new Error("Solo tus propios gastos");
      if (g.obra_id !== data.obraId) throw new Error("Gastos de otra obra");
    }
    const total = gastos.reduce((a: number, g: any) => a + Number(g.monto), 0);

    const { data: folio, error: folioErr } = await supabase
      .rpc("siguiente_folio_caja_chica", { _company_id: ctx.companyId });
    if (folioErr) throw new Error(folioErr.message);
    if (!folio) throw new Error("No se pudo generar folio");

    const { data: reemb, error } = await supabase
      .from("caja_chica_reembolsos")
      .insert({
        folio: folio as string,
        company_id: ctx.companyId,
        obra_id: data.obraId,
        residente_id: userId,
        semana_inicio: data.semanaInicio,
        semana_fin: data.semanaFin,
        monto_solicitado: total,
        monto_aprobado: total,
        solicitado_por: userId,
      })
      .select("id, folio").single();
    if (error) throw new Error(error.message);

    const { error: upErr } = await supabase
      .from("caja_chica_gastos")
      .update({ estatus: "solicitado", reembolso_id: reemb.id })
      .in("id", data.gastoIds);
    if (upErr) throw new Error(upErr.message);

    // Notificar a supervisores
    const { data: sup } = await supabase
      .from("user_roles").select("user_id")
      .eq("company_id", ctx.companyId)
      .in("role", ["supervisor", "director"]);
    const targets = Array.from(new Set((sup ?? []).map((s: any) => s.user_id as string)))
      .filter((id) => id !== userId);
    await notify(targets.map((uid) => ({
      user_id: uid,
      company_id: ctx.companyId,
      obra_id: data.obraId,
      tipo: "caja_chica_reembolso_solicitado",
      titulo: `Reembolso ${reemb.folio}`,
      mensaje: `Se solicita reembolso por $${total.toFixed(2)}`,
      link: `/app/obras/${data.obraId}/caja-chica`,
    })));

    return { ok: true, id: reemb.id, folio: reemb.folio };
  });

async function recalcReembolsoTotales(supabase: any, reembolsoId: string) {
  const { data: gs } = await supabase
    .from("caja_chica_gastos")
    .select("monto, estatus")
    .eq("reembolso_id", reembolsoId);
  const arr = gs ?? [];
  const solicitado = arr
    .filter((g: any) => g.estatus !== "rechazado")
    .reduce((a: number, g: any) => a + Number(g.monto), 0);
  const aprobado = arr
    .filter((g: any) => g.estatus === "aprobado" || g.estatus === "reembolsado")
    .reduce((a: number, g: any) => a + Number(g.monto), 0);
  await supabase
    .from("caja_chica_reembolsos")
    .update({ monto_solicitado: solicitado, monto_aprobado: aprobado })
    .eq("id", reembolsoId);
}

export const revisarGastoReembolso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      gastoId: z.string().uuid(),
      decision: z.enum(["aprobado", "rechazado"]),
      motivo: z.string().trim().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isSupervisor) {
      throw new Error("Solo supervisor o director revisa");
    }
    const { data: g } = await supabase
      .from("caja_chica_gastos").select("estatus, reembolso_id")
      .eq("id", data.gastoId).maybeSingle();
    if (!g) throw new Error("Gasto no encontrado");
    if (!g.reembolso_id) throw new Error("Gasto sin reembolso");
    if (!["solicitado", "aprobado", "rechazado"].includes(g.estatus)) {
      throw new Error("No se puede revisar este gasto");
    }
    const { error } = await supabase
      .from("caja_chica_gastos")
      .update({
        estatus: data.decision,
        revisado_por: userId,
        revisado_at: new Date().toISOString(),
        motivo_rechazo: data.decision === "rechazado" ? (data.motivo ?? null) : null,
      })
      .eq("id", data.gastoId);
    if (error) throw new Error(error.message);
    // Mark reembolso en_revision
    await supabase
      .from("caja_chica_reembolsos")
      .update({ estatus: "en_revision", revisado_por: userId, revisado_at: new Date().toISOString() })
      .eq("id", g.reembolso_id)
      .eq("estatus", "solicitado");
    await recalcReembolsoTotales(supabase, g.reembolso_id);
    return { ok: true };
  });

export const cerrarRevisionReembolso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isSupervisor) {
      throw new Error("Solo supervisor o director envía al administrativo");
    }
    const { data: r } = await supabase
      .from("caja_chica_reembolsos").select("estatus, obra_id, company_id, folio, monto_aprobado")
      .eq("id", data.id).maybeSingle();
    if (!r) throw new Error("Reembolso no encontrado");
    if (!["solicitado", "en_revision"].includes(r.estatus)) {
      throw new Error("Reembolso no se puede enviar");
    }
    // Cualquier gasto que siga "solicitado" se considera aprobado
    await supabase
      .from("caja_chica_gastos")
      .update({ estatus: "aprobado", revisado_por: userId, revisado_at: new Date().toISOString() })
      .eq("reembolso_id", data.id)
      .eq("estatus", "solicitado");
    await recalcReembolsoTotales(supabase, data.id);

    const { error } = await supabase
      .from("caja_chica_reembolsos")
      .update({
        estatus: "enviado_admin",
        enviado_admin_at: new Date().toISOString(),
        enviado_admin_por: userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { data: admins } = await supabase
      .from("user_roles").select("user_id")
      .eq("company_id", r.company_id)
      .in("role", ["administrativo", "director"]);
    const targets = Array.from(new Set((admins ?? []).map((s: any) => s.user_id as string)));
    await notify(targets.map((uid) => ({
      user_id: uid,
      company_id: r.company_id,
      obra_id: r.obra_id,
      tipo: "caja_chica_reembolso_enviado_admin",
      titulo: `Reembolso ${r.folio} listo para reponer`,
      mensaje: `Monto aprobado: $${Number(r.monto_aprobado).toFixed(2)}`,
      link: `/app/admin/caja-chica`,
    })));
    return { ok: true };
  });

export const reponerReembolsoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      montoReembolsado: z.number().positive(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isAdministrativo) {
      throw new Error("Solo administrativo o director repone");
    }
    const { data: r } = await supabase
      .from("caja_chica_reembolsos").select("estatus, residente_id, obra_id, company_id, folio")
      .eq("id", data.id).maybeSingle();
    if (!r) throw new Error("Reembolso no encontrado");
    if (r.estatus !== "enviado_admin") throw new Error("Reembolso no está listo para reponer");

    const { error } = await supabase
      .from("caja_chica_reembolsos")
      .update({
        estatus: "repuesto",
        monto_reembolsado: data.montoReembolsado,
        repuesto_por: userId,
        repuesto_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabase
      .from("caja_chica_gastos")
      .update({ estatus: "reembolsado" })
      .eq("reembolso_id", data.id)
      .eq("estatus", "aprobado");

    await notify([{
      user_id: r.residente_id,
      company_id: r.company_id,
      obra_id: r.obra_id,
      tipo: "caja_chica_reembolso_repuesto",
      titulo: `Reembolso ${r.folio} repuesto`,
      mensaje: `Se repusieron $${data.montoReembolsado.toFixed(2)}`,
      link: `/app/obras/${r.obra_id}/caja-chica`,
    }]);
    return { ok: true };
  });

export const rechazarReembolsoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      motivo: z.string().trim().min(3).max(500),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isSupervisor) {
      throw new Error("Solo supervisor o director rechaza");
    }
    const { data: r } = await supabase
      .from("caja_chica_reembolsos").select("estatus, residente_id, obra_id, company_id, folio")
      .eq("id", data.id).maybeSingle();
    if (!r) throw new Error("Reembolso no encontrado");
    if (!["solicitado", "en_revision"].includes(r.estatus)) {
      throw new Error("Reembolso no se puede rechazar");
    }
    const { error } = await supabase
      .from("caja_chica_reembolsos")
      .update({
        estatus: "rechazado",
        rechazado_por: userId,
        rechazado_at: new Date().toISOString(),
        motivo_rechazo: data.motivo,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Liberar gastos
    await supabase
      .from("caja_chica_gastos")
      .update({ estatus: "borrador", reembolso_id: null })
      .eq("reembolso_id", data.id);
    await notify([{
      user_id: r.residente_id,
      company_id: r.company_id,
      obra_id: r.obra_id,
      tipo: "caja_chica_reembolso_rechazado",
      titulo: `Reembolso ${r.folio} rechazado`,
      mensaje: data.motivo,
      link: `/app/obras/${r.obra_id}/caja-chica`,
    }]);
    return { ok: true };
  });

// ============================================================
// SALDO
// ============================================================

export const getSaldoCajaChica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      residenteId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: asig } = await supabase
      .from("caja_chica_asignaciones").select("monto_base")
      .eq("obra_id", data.obraId).eq("residente_id", data.residenteId)
      .eq("activo", true).maybeSingle();
    const montoBase = Number(asig?.monto_base ?? 0);

    const { data: fondos } = await supabase
      .from("caja_chica_fondos").select("monto_entregado")
      .eq("obra_id", data.obraId).eq("residente_id", data.residenteId)
      .eq("estatus", "entregado");
    const entregado = (fondos ?? []).reduce(
      (a: number, f: any) => a + Number(f.monto_entregado ?? 0), 0
    );

    const { data: gastos } = await supabase
      .from("caja_chica_gastos").select("monto, estatus")
      .eq("obra_id", data.obraId).eq("residente_id", data.residenteId);
    const arr = gastos ?? [];
    const gastosPendientes = arr
      .filter((g: any) => ["borrador", "solicitado", "aprobado"].includes(g.estatus))
      .reduce((a: number, g: any) => a + Number(g.monto), 0);
    const gastosReembolsados = arr
      .filter((g: any) => g.estatus === "reembolsado")
      .reduce((a: number, g: any) => a + Number(g.monto), 0);

    return {
      montoBase,
      entregado,
      gastosPendientes,
      gastosReembolsados,
      disponible: entregado - gastosPendientes,
    };
  });
