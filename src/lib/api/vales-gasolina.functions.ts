import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Helpers
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

async function notify(rows: Array<{
  user_id: string; company_id: string; obra_id?: string | null;
  tipo: string; titulo: string; mensaje: string; link?: string | null;
}>) {
  if (rows.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notificaciones").insert(rows);
}

const TIPO = z.enum(["magna", "premium", "diesel"]);

// ============================================================
// LIST / GET
// ============================================================

export const listValesGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid().optional(),
      estatus: z.string().optional(),
    }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("vales_gasolina")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.obraId) q = q.eq("obra_id", data.obraId);
    if (data.estatus) q = q.eq("estatus", data.estatus as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const arr = rows ?? [];

    const userIds = Array.from(new Set(
      arr.flatMap((r: any) =>
        [r.solicitado_por, r.autorizado_por, r.rechazado_por, r.ligado_por, r.confirmado_por, r.cancelado_por]
      ).filter(Boolean)
    ));
    let profiles: any[] = [];
    if (userIds.length) {
      const { data: p } = await supabase
        .from("profiles").select("id, nombre_completo, email").in("id", userIds);
      profiles = p ?? [];
    }
    const obraIds = Array.from(new Set(arr.map((r: any) => r.obra_id).filter(Boolean)));
    let obras: any[] = [];
    if (obraIds.length) {
      const { data: o } = await supabase
        .from("obras").select("id, nombre").in("id", obraIds);
      obras = o ?? [];
    }

    const nameOf = (id: string | null) => {
      if (!id) return null;
      const p = profiles.find((x) => x.id === id);
      return p?.nombre_completo || p?.email || null;
    };
    const obraOf = (id: string | null) => {
      if (!id) return null;
      return obras.find((o) => o.id === id)?.nombre ?? null;
    };

    return arr.map((r: any) => ({
      ...r,
      solicitado_nombre: nameOf(r.solicitado_por),
      autorizado_nombre: nameOf(r.autorizado_por),
      rechazado_nombre: nameOf(r.rechazado_por),
      ligado_nombre: nameOf(r.ligado_por),
      confirmado_nombre: nameOf(r.confirmado_por),
      cancelado_nombre: nameOf(r.cancelado_por),
      obra_nombre: obraOf(r.obra_id),
    }));
  });

// ============================================================
// CREAR
// ============================================================

export const crearValeGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid().nullable().optional(),
      tipoCombustible: TIPO,
      monto: z.number().positive(),
      descripcion: z.string().trim().min(3).max(500),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    const obraId = data.obraId ?? null;

    if (obraId) {
      const allowed = ctx.isDirector || ctx.isAdministrativo || ctx.isSupervisor
        || await isMemberObra(supabase, userId, obraId);
      if (!allowed) throw new Error("Sin acceso a esa obra");
    } else {
      if (!ctx.isDirector && !ctx.isAdministrativo) {
        throw new Error("Solo director o administrativo pueden crear vales generales");
      }
    }

    const { data: folio, error: folioErr } = await supabase
      .rpc("siguiente_folio_vale_gasolina", { _company_id: ctx.companyId });
    if (folioErr) throw new Error(folioErr.message);

    const { data: inserted, error } = await supabase
      .from("vales_gasolina")
      .insert({
        folio,
        company_id: ctx.companyId,
        obra_id: obraId,
        tipo_combustible: data.tipoCombustible,
        monto_solicitado: data.monto,
        descripcion: data.descripcion,
        solicitado_por: userId,
      })
      .select("id, folio")
      .single();
    if (error) throw new Error(error.message);

    // Notificar a supervisores y director(es)
    const { data: supers } = await supabase
      .from("user_roles").select("user_id")
      .eq("company_id", ctx.companyId)
      .in("role", ["supervisor", "director"]);
    const targets = Array.from(new Set((supers ?? []).map((s: any) => s.user_id as string)))
      .filter((id) => id !== userId);
    await notify(targets.map((uid) => ({
      user_id: uid,
      company_id: ctx.companyId,
      obra_id: obraId,
      tipo: "vale_gasolina_solicitud",
      titulo: `Nuevo vale ${inserted.folio}`,
      mensaje: `Se solicitó un vale de gasolina por $${data.monto.toFixed(2)}`,
      link: `/app/admin/gasolinas`,
    })));

    return { ok: true, id: inserted.id, folio: inserted.folio };
  });

// ============================================================
// AUTORIZAR
// ============================================================

export const autorizarValeGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      montoAutorizado: z.number().positive(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isSupervisor) {
      throw new Error("Solo supervisor o director autoriza");
    }
    const { data: vale } = await supabase
      .from("vales_gasolina").select("estatus, folio, solicitado_por, obra_id, company_id")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "pendiente_autorizacion") {
      throw new Error("Solo se autoriza un vale pendiente");
    }
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "autorizado",
        autorizado_por: userId,
        autorizado_at: new Date().toISOString(),
        monto_autorizado: data.montoAutorizado,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Notificar a administrativos
    const { data: admins } = await supabase
      .from("user_roles").select("user_id")
      .eq("company_id", vale.company_id)
      .in("role", ["administrativo", "director"]);
    const targets = Array.from(new Set((admins ?? []).map((s: any) => s.user_id as string)));
    await notify(targets.map((uid) => ({
      user_id: uid,
      company_id: vale.company_id,
      obra_id: vale.obra_id,
      tipo: "vale_gasolina_autorizado",
      titulo: `Vale ${vale.folio} autorizado`,
      mensaje: `Liga el código físico del vale por $${data.montoAutorizado.toFixed(2)}`,
      link: `/app/admin/gasolinas`,
    })));
    // También al solicitante
    await notify([{
      user_id: vale.solicitado_por,
      company_id: vale.company_id,
      obra_id: vale.obra_id,
      tipo: "vale_gasolina_autorizado",
      titulo: `Tu vale ${vale.folio} fue autorizado`,
      mensaje: `Monto autorizado: $${data.montoAutorizado.toFixed(2)}`,
      link: `/app/admin/gasolinas`,
    }]);

    return { ok: true };
  });

// ============================================================
// RECHAZAR
// ============================================================

export const rechazarValeGasolina = createServerFn({ method: "POST" })
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
    const { data: vale } = await supabase
      .from("vales_gasolina").select("estatus, folio, solicitado_por, obra_id, company_id")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "pendiente_autorizacion") {
      throw new Error("Solo se rechaza un vale pendiente");
    }
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "rechazado",
        rechazado_por: userId,
        rechazado_at: new Date().toISOString(),
        motivo_rechazo: data.motivo,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await notify([{
      user_id: vale.solicitado_por,
      company_id: vale.company_id,
      obra_id: vale.obra_id,
      tipo: "vale_gasolina_rechazado",
      titulo: `Vale ${vale.folio} rechazado`,
      mensaje: data.motivo,
      link: `/app/admin/gasolinas`,
    }]);
    return { ok: true };
  });

// ============================================================
// CANCELAR (solicitante)
// ============================================================

export const cancelarValeGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    const { data: vale } = await supabase
      .from("vales_gasolina").select("estatus, solicitado_por")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "pendiente_autorizacion") {
      throw new Error("Solo puedes cancelar un vale pendiente");
    }
    if (vale.solicitado_por !== userId && !ctx.isDirector) {
      throw new Error("Solo el solicitante o director puede cancelar");
    }
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "cancelado",
        cancelado_por: userId,
        cancelado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// LIGAR CÓDIGO FÍSICO (administrativo)
// ============================================================

export const ligarCodigoVale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      codigoVale: z.string().trim().min(1).max(100),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isAdministrativo) {
      throw new Error("Solo administrativo o director liga el código");
    }
    const { data: vale } = await supabase
      .from("vales_gasolina")
      .select("estatus, folio, solicitado_por, obra_id, company_id, monto_autorizado, monto_solicitado, tipo_combustible")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "autorizado") {
      throw new Error("Solo se liga un vale autorizado");
    }
    const ligadoAt = new Date().toISOString();
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "entregado",
        codigo_vale: data.codigoVale,
        ligado_por: userId,
        ligado_at: ligadoAt,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Registrar pasivo en contabilidad (partida doble)
    const monto = Number(vale.monto_autorizado ?? vale.monto_solicitado ?? 0);
    if (monto > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const asientoId = crypto.randomUUID();
      const fechaAsiento = ligadoAt.slice(0, 10);
      const concepto = `Vale ${vale.folio} — ${vale.tipo_combustible}`;
      const base = {
        company_id: vale.company_id,
        asiento_id: asientoId,
        fecha: fechaAsiento,
        concepto,
        referencia: vale.folio,
        origen_tipo: "vale_gasolina_entregado",
        origen_id: data.id,
        creado_por: userId,
      };
      const { error: asErr } = await supabaseAdmin.from("asientos_contables").insert([
        { ...base, tipo_movimiento: "cargo", cuenta_contable: "Costo de obra - Gasolinas", monto },
        { ...base, tipo_movimiento: "abono", cuenta_contable: "Cuentas por pagar - Gasolinas", monto },
      ]);
      if (asErr) {
        // Rollback del update del vale
        await supabase
          .from("vales_gasolina")
          .update({
            estatus: "autorizado",
            codigo_vale: null,
            ligado_por: null,
            ligado_at: null,
          })
          .eq("id", data.id);
        throw new Error(asErr.message);
      }
    }

    await notify([{
      user_id: vale.solicitado_por,
      company_id: vale.company_id,
      obra_id: vale.obra_id,
      tipo: "vale_gasolina_entregado",
      titulo: `Vale ${vale.folio} entregado`,
      mensaje: `Código: ${data.codigoVale}. Confirma la recepción.`,
      link: `/app/admin/gasolinas`,
    }]);
    return { ok: true };
  });

// ============================================================
// CONFIRMAR RECEPCIÓN
// ============================================================

export const confirmarRecepcionVale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    const { data: vale } = await supabase
      .from("vales_gasolina").select("estatus, solicitado_por")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "entregado") {
      throw new Error("Solo se confirma un vale entregado");
    }
    if (vale.solicitado_por !== userId && !ctx.isDirector) {
      throw new Error("Solo el solicitante o director confirma");
    }
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "confirmado",
        confirmado_por: userId,
        confirmado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// VALES POR PAGAR (Cuentas por pagar - Gasolinas)
// ============================================================

export const listValesPorPagar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isAdministrativo) {
      throw new Error("Sin permisos");
    }

    const { data: vales, error } = await supabase
      .from("vales_gasolina")
      .select("id, folio, obra_id, tipo_combustible, monto_autorizado, estatus, ligado_at, solicitado_por")
      .eq("company_id", ctx.companyId)
      .in("estatus", ["entregado", "confirmado"])
      .order("ligado_at", { ascending: false });
    if (error) throw new Error(error.message);
    const arr = (vales ?? []) as any[];
    if (arr.length === 0) return [];

    const ids = arr.map((v) => v.id);
    const { data: pagos } = await supabase
      .from("pagos")
      .select("origen_id, monto")
      .eq("company_id", ctx.companyId)
      .eq("origen_tipo", "gasolina")
      .is("cancelado_at", null)
      .in("origen_id", ids);
    const pagadoMap = new Map<string, number>();
    for (const p of (pagos ?? []) as any[]) {
      pagadoMap.set(p.origen_id, (pagadoMap.get(p.origen_id) ?? 0) + Number(p.monto));
    }

    const obraIds = Array.from(new Set(arr.map((v) => v.obra_id).filter(Boolean)));
    const { data: obras } = obraIds.length
      ? await supabase.from("obras").select("id, nombre").in("id", obraIds)
      : { data: [] as any[] };
    const oMap = new Map<string, string>(((obras ?? []) as any[]).map((o) => [o.id, o.nombre]));

    const userIds = Array.from(new Set(arr.map((v) => v.solicitado_por).filter(Boolean)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id, nombre_completo, email").in("id", userIds)
      : { data: [] as any[] };
    const pMap = new Map<string, string>(
      ((profs ?? []) as any[]).map((p) => [p.id, p.nombre_completo || p.email || ""]),
    );

    return arr
      .map((v) => {
        const total = Number(v.monto_autorizado ?? 0);
        const pagado = pagadoMap.get(v.id) ?? 0;
        const saldo = +(total - pagado).toFixed(2);
        return {
          id: v.id as string,
          folio: v.folio as string,
          obra_id: v.obra_id as string | null,
          obra_nombre: v.obra_id ? oMap.get(v.obra_id) ?? null : null,
          tipo_combustible: v.tipo_combustible as string,
          estatus: v.estatus as string,
          ligado_at: v.ligado_at as string | null,
          solicitante_nombre: v.solicitado_por ? pMap.get(v.solicitado_por) ?? null : null,
          monto_autorizado: total,
          pagado,
          saldo,
        };
      })
      .filter((r) => r.saldo > 0.01);
  });

const pagarValesSchema = z.object({
  valeIds: z.array(z.string().uuid()).min(1).max(50),
  cuentaId: z.string().uuid(),
  metodo: z.enum(["efectivo", "transferencia", "cheque"]),
  fecha: z.string().min(10).max(10),
  referencia: z.string().trim().max(120).optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
});

export const pagarValesGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pagarValesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isAdministrativo) {
      throw new Error("Sin permisos para registrar pagos");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cuenta
    const { data: cuenta, error: cErr } = await supabaseAdmin
      .from("cuentas")
      .select("id, company_id, tipo, activa, saldo_actual")
      .eq("id", data.cuentaId).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cuenta || cuenta.company_id !== ctx.companyId) throw new Error("Cuenta no encontrada");
    if (!cuenta.activa) throw new Error("La cuenta está inactiva");
    if (cuenta.tipo === "caja_fuerte" && data.metodo !== "efectivo") {
      throw new Error("La caja fuerte solo admite pagos en efectivo");
    }
    if (cuenta.tipo === "bancaria" && data.metodo === "efectivo") {
      throw new Error("Las cuentas bancarias no admiten pagos en efectivo");
    }

    // Vales
    const { data: vales, error: vErr } = await supabaseAdmin
      .from("vales_gasolina")
      .select("id, folio, estatus, monto_autorizado, company_id")
      .in("id", data.valeIds);
    if (vErr) throw new Error(vErr.message);
    if (!vales || vales.length !== data.valeIds.length) throw new Error("Algunos vales no se encontraron");
    for (const v of vales) {
      if (v.company_id !== ctx.companyId) throw new Error("Vale fuera de la empresa");
      if (!["entregado", "confirmado"].includes(v.estatus as string)) {
        throw new Error(`Vale ${v.folio} no está entregado`);
      }
    }

    // Pagos existentes por vale
    const { data: pagosPrev } = await supabaseAdmin
      .from("pagos")
      .select("origen_id, monto")
      .eq("company_id", ctx.companyId)
      .eq("origen_tipo", "gasolina")
      .is("cancelado_at", null)
      .in("origen_id", data.valeIds);
    const pagadoMap = new Map<string, number>();
    for (const p of (pagosPrev ?? []) as any[]) {
      pagadoMap.set(p.origen_id, (pagadoMap.get(p.origen_id) ?? 0) + Number(p.monto));
    }

    const saldoPorVale: Array<{ id: string; folio: string; saldo: number }> = [];
    let total = 0;
    for (const v of vales) {
      const aut = Number((v as any).monto_autorizado ?? 0);
      const saldo = +(aut - (pagadoMap.get(v.id as string) ?? 0)).toFixed(2);
      if (saldo <= 0.01) throw new Error(`Vale ${v.folio} ya está pagado`);
      saldoPorVale.push({ id: v.id as string, folio: v.folio as string, saldo });
      total += saldo;
    }
    total = +total.toFixed(2);

    if (total > Number(cuenta.saldo_actual) + 0.01) {
      throw new Error(`El total (${total}) excede el saldo de la cuenta (${cuenta.saldo_actual})`);
    }

    const conceptoMov = `Pago vales gasolina (${saldoPorVale.length})${data.referencia ? ` · ${data.referencia}` : ""}`;

    // 1. cuenta_movimiento (total)
    const { data: mov, error: mErr } = await supabaseAdmin
      .from("cuenta_movimientos")
      .insert({
        cuenta_id: data.cuentaId,
        company_id: ctx.companyId,
        fecha: data.fecha,
        tipo: "egreso",
        monto: total,
        concepto: conceptoMov,
        referencia: data.referencia || null,
        origen: "pago",
        creado_por: userId,
      })
      .select("id")
      .single();
    if (mErr) throw new Error(mErr.message);

    // 2. pagos (uno por vale)
    const pagosRows = saldoPorVale.map((s) => ({
      company_id: ctx.companyId,
      cuenta_id: data.cuentaId,
      fecha: data.fecha,
      monto: s.saldo,
      metodo: data.metodo,
      referencia: data.referencia || null,
      concepto: `Pago vale ${s.folio}`,
      notas: data.notas || null,
      origen_tipo: "gasolina",
      origen_id: s.id,
      cuenta_movimiento_id: mov.id,
      creado_por: userId,
    }));
    const { error: pErr } = await supabaseAdmin.from("pagos").insert(pagosRows);
    if (pErr) {
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      throw new Error(pErr.message);
    }

    // 3. Saldo cuenta
    const nuevoSaldo = +(Number(cuenta.saldo_actual) - total).toFixed(2);
    const { error: sErr } = await supabaseAdmin
      .from("cuentas").update({ saldo_actual: nuevoSaldo }).eq("id", data.cuentaId);
    if (sErr) {
      await supabaseAdmin.from("pagos").delete().eq("cuenta_movimiento_id", mov.id);
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      throw new Error(sErr.message);
    }

    // 4. Asientos contables (cargo pasivo gasolinas / abono cuenta)
    const cuentaActivo = cuenta.tipo === "bancaria" ? "Bancos" : "Caja fuerte";
    const asientos = saldoPorVale.flatMap((s) => {
      const asientoId = crypto.randomUUID();
      const base = {
        company_id: ctx.companyId,
        asiento_id: asientoId,
        fecha: data.fecha,
        concepto: `Pago vale ${s.folio}`,
        referencia: s.folio,
        origen_tipo: "pago_vale_gasolina",
        origen_id: s.id,
        creado_por: userId,
      };
      return [
        { ...base, tipo_movimiento: "cargo", cuenta_contable: "Cuentas por pagar - Gasolinas", monto: s.saldo },
        { ...base, tipo_movimiento: "abono", cuenta_contable: cuentaActivo, monto: s.saldo },
      ];
    });
    await supabaseAdmin.from("asientos_contables").insert(asientos);

    return { ok: true, total, count: saldoPorVale.length };
  });
