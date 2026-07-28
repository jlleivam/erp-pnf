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

async function notifyRentaRoles(
  supabase: any,
  opts: {
    companyId: string;
    obraId: string;
    excludeUserId: string;
    roles: string[];
    extraUserIds?: (string | null | undefined)[];
    tipo: string;
    titulo: string;
    mensaje: string;
    link: string;
  },
) {
  try {
    const { data: rows } = await supabase
      .from("user_roles").select("user_id")
      .eq("company_id", opts.companyId).in("role", opts.roles);
    const fromRoles = (rows ?? []).map((r: any) => r.user_id as string);
    const extras = (opts.extraUserIds ?? []).filter((u): u is string => !!u);
    const destinatarios = Array.from(new Set([...fromRoles, ...extras]))
      .filter((u) => u !== opts.excludeUserId);
    if (destinatarios.length === 0) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("notificaciones").insert(
      destinatarios.map((uid) => ({
        user_id: uid,
        company_id: opts.companyId,
        obra_id: opts.obraId,
        tipo: opts.tipo,
        titulo: opts.titulo,
        mensaje: opts.mensaje,
        link: opts.link,
      })),
    );
    if (error) console.error("[notificaciones] insert failed", error.message);
  } catch (e: any) {
    console.error("[notificaciones] renta error", e?.message);
  }
}

const PERIODOS_POR_AÑO: Record<string, number> = {
  diaria: 1,
  semanal: 7,
  quincenal: 15,
  mensual: 30,
};

function calcAcumulado(r: any): { dias: number; monto: number; diasRestantes: number | null } {
  if (!r.fecha_llegada_real || !r.tarifa_unitaria || !r.periodicidad) {
    return { dias: 0, monto: 0, diasRestantes: null };
  }
  const hoy = new Date();
  const inicio = new Date(r.fecha_llegada_real);
  const fin = r.fecha_devolucion_real ? new Date(r.fecha_devolucion_real) : hoy;
  const ms = fin.getTime() - inicio.getTime();
  const dias = Math.max(0, Math.floor(ms / 86400000) + 1);
  const diasPorPeriodo = PERIODOS_POR_AÑO[r.periodicidad] ?? 1;
  const periodos = dias / diasPorPeriodo;
  const monto = Number(r.tarifa_unitaria) * Number(r.cantidad ?? 1) * periodos;
  let diasRestantes: number | null = null;
  if (r.fecha_fin_programada && !r.fecha_devolucion_real) {
    const finProg = new Date(r.fecha_fin_programada);
    diasRestantes = Math.floor((finProg.getTime() - hoy.getTime()) / 86400000);
  }
  return { dias, monto, diasRestantes };
}

// ============================================================
// LIST / GET
// ============================================================

export const listRentas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rentas, error } = await supabase
      .from("obra_rentas")
      .select("*")
      .eq("obra_id", data.obraId)
      .order("numero", { ascending: true });
    if (error) throw new Error(error.message);
    const arr = rentas ?? [];
    const provIds = Array.from(new Set(arr.map((r: any) => r.proveedor_id).filter(Boolean)));
    let provs: any[] = [];
    if (provIds.length > 0) {
      const { data: t } = await supabase
        .from("terceros").select("id, razon_social").in("id", provIds);
      provs = t ?? [];
    }
    const provMap = new Map(provs.map((t: any) => [t.id, t.razon_social]));
    return arr.map((r: any) => {
      const acc = calcAcumulado(r);
      return {
        ...r,
        proveedor_nombre: r.proveedor_id ? (provMap.get(r.proveedor_id) ?? "—") : null,
        dias_acumulados: acc.dias,
        monto_acumulado: acc.monto,
        dias_restantes: acc.diasRestantes,
      };
    });
  });

export const getRenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: renta, error } = await supabase
      .from("obra_rentas").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);

    const [{ data: proveedor }, { data: renovaciones }, { data: eventos }, { data: pagos }] =
      await Promise.all([
        renta.proveedor_id
          ? supabase.from("terceros").select("id, razon_social, rfc, categoria")
              .eq("id", renta.proveedor_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("obra_renta_renovaciones").select("*")
          .eq("renta_id", data.id).order("numero", { ascending: true }),
        supabase.from("obra_renta_eventos").select("*")
          .eq("renta_id", data.id).order("fecha_inicio", { ascending: false }),
        supabase.from("obra_renta_pagos").select("*")
          .eq("renta_id", data.id).order("periodo_inicio", { ascending: true }),
      ]);

    // Enriquecer pagos con info de su CxP
    const cxpIds = (pagos ?? []).map((p: any) => p.cxp_id).filter(Boolean);
    let cxpMap = new Map<string, any>();
    if (cxpIds.length > 0) {
      const { data: cxps } = await supabase
        .from("cuentas_por_pagar")
        .select("id, folio, monto_total, monto_pagado, saldo, estatus, fecha_vencimiento")
        .in("id", cxpIds);
      cxpMap = new Map((cxps ?? []).map((c: any) => [c.id, c]));
    }
    const pagosEnriquecidos = (pagos ?? []).map((p: any) => ({
      ...p,
      cxp: p.cxp_id ? (cxpMap.get(p.cxp_id) ?? null) : null,
    }));

    const acc = calcAcumulado(renta);
    const totalPagado = pagosEnriquecidos.reduce(
      (s: number, p: any) => s + Number(p.cxp?.monto_pagado ?? (p.estatus === "pagado" ? p.monto : 0)),
      0,
    );
    const totalDevengado = pagosEnriquecidos.reduce((s: number, p: any) => s + Number(p.monto), 0);
    return {
      renta: { ...renta, proveedor },
      renovaciones: renovaciones ?? [],
      eventos: eventos ?? [],
      pagos: pagosEnriquecidos,
      dias_acumulados: acc.dias,
      monto_acumulado: acc.monto,
      dias_restantes: acc.diasRestantes,
      total_pagado: totalPagado,
      total_devengado: totalDevengado,
    };
  });

// ============================================================
// CREATE (residente)
// ============================================================

export const crearSolicitudRenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      insumoId: z.string().uuid(),
      cantidad: z.number().positive().default(1),
      descripcion: z.string().trim().max(1000).optional(),
      fechaEstimadaInicio: z.string().optional(),
      periodicidadSugerida: z.enum(["diaria", "semanal", "quincenal", "mensual"]).optional(),
      periodosEstimados: z.number().positive().nullable().optional(),
      diasAvisoVencimiento: z.number().int().min(0).max(60).default(3),
      enviar: z.boolean().default(false),
    }).parse(d),

  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getCtx(supabase, userId);
    if (!isDirector) {
      const { data: teamRow } = await supabase
        .from("obra_team")
        .select("role")
        .eq("obra_id", data.obraId)
        .eq("user_id", userId)
        .maybeSingle();
      const role = (teamRow as any)?.role as string | undefined;
      if (role !== "residente" && role !== "supervisor") {
        throw new Error("Solo el residente, supervisor o director puede crear solicitudes de renta");
      }
    }

    // Validar que el insumo pertenezca a la compañía, esté autorizado y disponible para renta
    const { data: insumo, error: insErr } = await supabase
      .from("insumos")
      .select("id, nombre, codigo, unidad, estatus, disponible_renta, company_id")
      .eq("id", data.insumoId)
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);
    if (!insumo || insumo.company_id !== companyId) throw new Error("Insumo no encontrado");
    if (insumo.estatus !== "autorizado") throw new Error("El insumo no está autorizado");
    if (!insumo.disponible_renta) throw new Error("Ese insumo no está marcado como disponible para renta");

    const { data: existing } = await supabase
      .from("obra_rentas").select("numero")
      .eq("obra_id", data.obraId).order("numero", { ascending: false }).limit(1);
    const siguiente = (existing?.[0]?.numero ?? 0) + 1;

    const equipoLabel = insumo.codigo
      ? `${insumo.codigo} — ${insumo.nombre}`
      : insumo.nombre;

    const { data: ins, error } = await supabase
      .from("obra_rentas")
      .insert({
        company_id: companyId,
        obra_id: data.obraId,
        numero: siguiente,
        insumo_id: insumo.id,
        equipo: equipoLabel,
        cantidad: data.cantidad,
        descripcion: data.descripcion ?? null,
        fecha_estimada_inicio: data.fechaEstimadaInicio ?? null,
        periodicidad: data.periodicidadSugerida ?? null,
        periodos_estimados: data.periodosEstimados ?? null,
        dias_aviso_vencimiento: data.diasAvisoVencimiento,
        estatus: data.enviar ? "cotizada" : "borrador",
        creado_por: userId,
      })
      .select("id").single();
    if (error) throw new Error(error.message);

    if (data.enviar) {
      await notifyRentaRoles(supabase, {
        companyId,
        obraId: data.obraId,
        excludeUserId: userId,
        roles: ["administrativo", "director"],
        tipo: "renta_solicitada",
        titulo: `Nueva solicitud de renta #${siguiente}`,
        mensaje: `${equipoLabel} — pendiente de cotizar`,
        link: `/app/obras/${data.obraId}/rentas`,
      });
    }


    return { id: ins.id as string };
  });

// ============================================================
// COTIZAR (administrativo) -> cotizada
// ============================================================

export const cotizarRenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      proveedorId: z.string().uuid(),
      periodicidad: z.enum(["diaria", "semanal", "quincenal", "mensual"]),
      tarifaUnitaria: z.number().nonnegative(),
      deposito: z.number().nonnegative().default(0),
      condiciones: z.string().trim().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector, isAdministrativo } = await getCtx(supabase, userId);
    if (!isDirector && !isAdministrativo) {
      throw new Error("Solo el administrativo o director puede cotizar");
    }
    const { data: renta } = await supabase
      .from("obra_rentas").select("estatus, obra_id, numero, equipo").eq("id", data.id).maybeSingle();
    if (!renta) throw new Error("Renta no encontrada");
    if (renta.estatus !== "borrador" && renta.estatus !== "rechazada") {
      throw new Error("Solo se puede cotizar una renta en borrador o rechazada");
    }
    const { error } = await supabase
      .from("obra_rentas")
      .update({
        proveedor_id: data.proveedorId,
        periodicidad: data.periodicidad,
        tarifa_unitaria: data.tarifaUnitaria,
        deposito: data.deposito,
        condiciones: data.condiciones ?? null,
        estatus: "cotizada",
        cotizado_por: userId,
        cotizado_at: new Date().toISOString(),
        rechazo_motivo: null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await notifyRentaRoles(supabase, {
      companyId,
      obraId: renta.obra_id,
      excludeUserId: userId,
      roles: ["supervisor", "director"],
      tipo: "renta_cotizada",
      titulo: `Renta #${renta.numero} pendiente de autorizar`,
      mensaje: `${renta.equipo} — cotizada, requiere tu autorización`,
      link: `/app/obras/${renta.obra_id}/rentas`,
    });

    return { ok: true };
  });

// ============================================================
// AUTORIZAR / RECHAZAR (supervisor)
// ============================================================

export const autorizarRenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector, isSupervisor } = await getCtx(supabase, userId);
    if (!isDirector && !isSupervisor) throw new Error("Solo supervisor o director autoriza");
    const { data: renta } = await supabase
      .from("obra_rentas").select("estatus, obra_id, numero, equipo, creado_por").eq("id", data.id).maybeSingle();
    if (renta?.estatus !== "cotizada") throw new Error("Solo se autoriza una renta cotizada");
    const { error } = await supabase
      .from("obra_rentas")
      .update({
        estatus: "autorizada",
        autorizado_por: userId,
        autorizado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await notifyRentaRoles(supabase, {
      companyId,
      obraId: renta.obra_id,
      excludeUserId: userId,
      roles: ["administrativo", "director"],
      extraUserIds: [renta.creado_por],
      tipo: "renta_autorizada",
      titulo: `Renta #${renta.numero} autorizada`,
      mensaje: `${renta.equipo} autorizada — lista para gestionar llegada`,
      link: `/app/obras/${renta.obra_id}/rentas`,
    });

    return { ok: true };
  });

export const rechazarRenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), motivo: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector, isSupervisor } = await getCtx(supabase, userId);
    if (!isDirector && !isSupervisor) throw new Error("Solo supervisor o director rechaza");
    const { error } = await supabase
      .from("obra_rentas")
      .update({
        estatus: "rechazada",
        rechazo_motivo: data.motivo,
        rechazado_por: userId,
        rechazado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// LLEGADA / DEVOLUCIÓN
// ============================================================

export const marcarLlegada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      fechaLlegada: z.string(),
      fechaFinProgramada: z.string(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: renta } = await supabase
      .from("obra_rentas").select("estatus").eq("id", data.id).maybeSingle();
    if (renta?.estatus !== "autorizada") {
      throw new Error("Solo se marca llegada en rentas autorizadas");
    }
    const { error } = await supabase
      .from("obra_rentas")
      .update({
        estatus: "activa",
        fecha_llegada_real: data.fechaLlegada,
        fecha_fin_programada: data.fechaFinProgramada,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.rpc("generar_periodos_renta", { _renta_id: data.id });
    await supabase.rpc("devengar_asientos_renta", { _renta_id: data.id });
    return { ok: true };
  });

export const marcarDevolucion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), fechaDevolucion: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: renta } = await supabase
      .from("obra_rentas").select("estatus").eq("id", data.id).maybeSingle();
    if (renta?.estatus !== "activa") {
      throw new Error("Solo se devuelve una renta activa");
    }
    const { error } = await supabase
      .from("obra_rentas")
      .update({
        estatus: "devuelta",
        fecha_devolucion_real: data.fechaDevolucion,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.rpc("generar_periodos_renta", { _renta_id: data.id });
    await supabase.rpc("devengar_asientos_renta", { _renta_id: data.id });
    return { ok: true };
  });

// ============================================================
// RENOVACIONES
// ============================================================

export const solicitarRenovacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      rentaId: z.string().uuid(),
      fechaFinNueva: z.string(),
      tarifaNueva: z.number().nonnegative().optional(),
      motivo: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: renta } = await supabase
      .from("obra_rentas")
      .select("estatus, fecha_fin_programada")
      .eq("id", data.rentaId).maybeSingle();
    if (renta?.estatus !== "activa") throw new Error("Solo rentas activas se pueden renovar");
    if (!renta.fecha_fin_programada) throw new Error("La renta no tiene fecha fin programada");
    if (new Date(data.fechaFinNueva) <= new Date(renta.fecha_fin_programada)) {
      throw new Error("La nueva fecha fin debe ser posterior a la actual");
    }
    const { data: existing } = await supabase
      .from("obra_renta_renovaciones").select("numero")
      .eq("renta_id", data.rentaId).order("numero", { ascending: false }).limit(1);
    const siguiente = (existing?.[0]?.numero ?? 0) + 1;
    const { error } = await supabase
      .from("obra_renta_renovaciones")
      .insert({
        renta_id: data.rentaId,
        numero: siguiente,
        fecha_fin_anterior: renta.fecha_fin_programada,
        fecha_fin_nueva: data.fechaFinNueva,
        tarifa_nueva: data.tarifaNueva ?? null,
        motivo: data.motivo ?? null,
        estatus: "pendiente",
        solicitado_por: userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const autorizarRenovacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector, isSupervisor } = await getCtx(supabase, userId);
    if (!isDirector && !isSupervisor) throw new Error("Solo supervisor o director autoriza");
    const { data: ren } = await supabase
      .from("obra_renta_renovaciones")
      .select("renta_id, fecha_fin_nueva, tarifa_nueva, estatus")
      .eq("id", data.id).maybeSingle();
    if (ren?.estatus !== "pendiente") throw new Error("Renovación no pendiente");
    const { error: e1 } = await supabase
      .from("obra_renta_renovaciones")
      .update({
        estatus: "autorizada",
        autorizado_por: userId,
        autorizado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (e1) throw new Error(e1.message);
    const upd: any = { fecha_fin_programada: ren.fecha_fin_nueva };
    if (ren.tarifa_nueva != null) upd.tarifa_unitaria = ren.tarifa_nueva;
    const { error: e2 } = await supabase
      .from("obra_rentas").update(upd).eq("id", ren.renta_id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const rechazarRenovacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), motivo: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector, isSupervisor } = await getCtx(supabase, userId);
    if (!isDirector && !isSupervisor) throw new Error("Solo supervisor o director rechaza");
    const { error } = await supabase
      .from("obra_renta_renovaciones")
      .update({
        estatus: "rechazada",
        rechazo_motivo: data.motivo,
        rechazado_por: userId,
        rechazado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// EVENTOS (bitácora)
// ============================================================

export const registrarEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      rentaId: z.string().uuid(),
      tipo: z.enum(["averia", "inactividad", "nota"]),
      fechaInicio: z.string(),
      fechaFin: z.string().optional(),
      descripcion: z.string().trim().min(1).max(1000),
      evidenciaUrl: z.string().url().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("obra_renta_eventos")
      .insert({
        renta_id: data.rentaId,
        tipo: data.tipo,
        fecha_inicio: data.fechaInicio,
        fecha_fin: data.fechaFin ?? null,
        descripcion: data.descripcion,
        evidencia_url: data.evidenciaUrl ?? null,
        creado_por: userId,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("obra_renta_eventos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// PERIODOS DE PAGO (devengado)
// ============================================================

export const recalcularPeriodos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rentaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector, isAdministrativo } = await getCtx(supabase, userId);
    if (!isDirector && !isAdministrativo) {
      throw new Error("Solo el administrativo o director puede recalcular periodos");
    }
    const { data: generados, error } = await supabase
      .rpc("generar_periodos_renta", { _renta_id: data.rentaId });
    if (error) throw new Error(error.message);
    return { generados: Number(generados ?? 0) };
  });

export const eliminarPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector } = await getCtx(supabase, userId);
    if (!isDirector) throw new Error("Solo el director puede eliminar periodos");
    const { data: pago } = await supabase
      .from("obra_renta_pagos")
      .select("id, estatus, cxp_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!pago) throw new Error("Periodo no encontrado");
    if (pago.estatus === "pagado") {
      throw new Error("No se puede eliminar un periodo ya pagado; cancela el pago primero");
    }
    if (pago.cxp_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: cxp } = await supabaseAdmin
        .from("cuentas_por_pagar")
        .select("monto_pagado")
        .eq("id", pago.cxp_id)
        .maybeSingle();
      if (cxp && Number(cxp.monto_pagado) > 0) {
        throw new Error("La cuenta por pagar tiene pagos aplicados");
      }
      await supabaseAdmin.from("cuentas_por_pagar").delete().eq("id", pago.cxp_id);
    }
    const { error } = await supabase.from("obra_renta_pagos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// DELETE RENTA (solo borrador)
// ============================================================

export const eliminarRenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector } = await getCtx(supabase, userId);
    const { data: renta } = await supabase
      .from("obra_rentas").select("estatus").eq("id", data.id).maybeSingle();
    if (!renta) throw new Error("Renta no encontrada");
    if (renta.estatus !== "borrador" && !isDirector) {
      throw new Error("Solo el director puede eliminar rentas que no estén en borrador");
    }
    const { error } = await supabase.from("obra_rentas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
