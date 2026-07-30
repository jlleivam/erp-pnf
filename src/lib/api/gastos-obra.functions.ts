import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/permisos/require";

// ============================================================================
// Gastos directos de obra
// Flujo: Residente solicita -> Supervisor autoriza -> CxP para administrativo
// Tipo "servicio": el gasto pasa directo al costo de la obra.
// Tipo "material": además ingresa al almacén de la obra (semana abierta).
// Comprobante: factura -> se paga desde cuenta bancaria; nota/ninguno -> caja fuerte.
// ============================================================================

async function getCtx(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const { data: roles } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("company_id", profile.company_id);
  return {
    companyId: profile.company_id as string,
    roles: ((roles ?? []) as any[]).map((r) => r.role as string),
  };
}

const PartidaInput = z.object({
  insumo_id: z.string().uuid(),
  cantidad: z.number().positive(),
  precio_unitario: z.number().min(0),
});

const GastoInput = z.object({
  id: z.string().uuid().optional().nullable(),
  obraId: z.string().uuid(),
  tipo: z.enum(["servicio", "material"]),
  proveedorId: z.string().uuid().optional().nullable(),
  concepto: z.string().trim().min(3).max(300),
  tipoComprobante: z.enum(["factura", "nota", "ninguno"]),
  comprobantePath: z.string().trim().max(500).optional().nullable(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  montoTotal: z.number().positive(),
  notas: z.string().trim().max(1000).optional().nullable(),
  partidas: z.array(PartidaInput).default([]),
  enviar: z.boolean().default(true),
});

export const listGastosObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obraId: z.string().uuid().optional().nullable() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    let q = supabase
      .from("obra_gastos_directos")
      .select(
        "id, folio, obra_id, tipo, concepto, tipo_comprobante, comprobante_path, fecha, monto_total, estatus, motivo_rechazo, notas, solicitado_por, solicitado_at, autorizado_por, autorizado_at, creado_por, created_at, cxp_id, proveedor:terceros(id, razon_social, nombre_comercial), obra:obras(id, nombre)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (data.obraId) q = q.eq("obra_id", data.obraId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set(
        ((rows ?? []) as any[])
          .flatMap((r) => [r.solicitado_por, r.autorizado_por, r.creado_por])
          .filter(Boolean),
      ),
    );
    const nombres: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, nombre_completo").in("id", userIds);
      for (const p of (profs ?? []) as any[]) nombres[p.id] = p.nombre_completo ?? "";
    }
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      solicitante_nombre: r.solicitado_por ? (nombres[r.solicitado_por] ?? "") : "",
      autorizador_nombre: r.autorizado_por ? (nombres[r.autorizado_por] ?? "") : "",
    }));
  });

export const getGastoObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    const { data: gasto, error } = await supabase
      .from("obra_gastos_directos")
      .select("*, proveedor:terceros(id, razon_social, nombre_comercial), obra:obras(id, nombre)")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!gasto) throw new Error("Gasto no encontrado");
    const { data: partidas } = await supabase
      .from("obra_gasto_directo_partidas")
      .select("id, insumo_id, cantidad, precio_unitario, insumo:insumos(id, nombre, unidad)")
      .eq("gasto_id", data.id);
    return { gasto, partidas: partidas ?? [] };
  });

export const guardarGastoObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    GastoInput.refine((v) => (v.tipo === "material" ? v.partidas.length > 0 : true), {
      message: "Los gastos de material requieren al menos un insumo",
      path: ["partidas"],
    })
      .refine((v) => (v.tipoComprobante === "ninguno" ? true : !!v.comprobantePath), {
        message: "Sube el archivo del comprobante",
        path: ["comprobantePath"],
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    await requirePermission(supabase, userId, "gastos_obra.crear");

    const nowIso = new Date().toISOString();
    const payload: any = {
      company_id: companyId,
      obra_id: data.obraId,
      tipo: data.tipo,
      proveedor_id: data.proveedorId || null,
      concepto: data.concepto,
      tipo_comprobante: data.tipoComprobante,
      comprobante_path: data.comprobantePath || null,
      fecha: data.fecha,
      monto_total: data.montoTotal,
      notas: data.notas || null,
      estatus: data.enviar ? "solicitado" : "borrador",
      motivo_rechazo: null,
    };

    let gastoId: string;
    if (data.id) {
      const { data: existing } = await supabase
        .from("obra_gastos_directos")
        .select("id, estatus, creado_por, company_id")
        .eq("id", data.id).maybeSingle();
      if (!existing || existing.company_id !== companyId) throw new Error("Gasto no encontrado");
      if (!["borrador", "rechazado"].includes(existing.estatus)) {
        throw new Error("Solo se pueden editar gastos en borrador o rechazados");
      }
      if (data.enviar) {
        payload.solicitado_por = userId;
        payload.solicitado_at = nowIso;
      }
      const { error } = await supabase
        .from("obra_gastos_directos").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      gastoId = data.id;
      await supabase.from("obra_gasto_directo_partidas").delete().eq("gasto_id", gastoId);
    } else {
      const { data: folio, error: fErr } = await supabase
        .rpc("siguiente_folio_gasto_obra", { _company_id: companyId });
      if (fErr) throw new Error(fErr.message);
      const { data: inserted, error } = await supabase
        .from("obra_gastos_directos")
        .insert({
          ...payload,
          folio,
          creado_por: userId,
          solicitado_por: data.enviar ? userId : null,
          solicitado_at: data.enviar ? nowIso : null,
        })
        .select("id, folio").single();
      if (error) throw new Error(error.message);
      gastoId = inserted.id;
    }

    if (data.tipo === "material" && data.partidas.length > 0) {
      const { error: pErr } = await supabase.from("obra_gasto_directo_partidas").insert(
        data.partidas.map((p) => ({
          gasto_id: gastoId,
          insumo_id: p.insumo_id,
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario,
        })),
      );
      if (pErr) throw new Error(pErr.message);
    }

    if (data.enviar) {
      await notificarGastoObra(supabase, {
        gastoId,
        obraId: data.obraId,
        companyId,
        userId,
        tipo: "gasto_obra_solicitado",
      });
    }

    return { id: gastoId };
  });

export const autorizarGastoObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    await requirePermission(supabase, userId, "gastos_obra.autorizar");

    const { data: gasto } = await supabase
      .from("obra_gastos_directos")
      .select("*, proveedor:terceros(id, razon_social)")
      .eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (!gasto) throw new Error("Gasto no encontrado");
    if (gasto.estatus !== "solicitado") throw new Error("El gasto no está pendiente de autorización");
    if (gasto.solicitado_por === userId) {
      throw new Error("No puedes autorizar un gasto que tú solicitaste");
    }

    // 1. Cuenta por pagar para el administrativo
    const { data: folioCxp, error: fErr } = await supabase
      .rpc("siguiente_folio_cxp", { _company_id: companyId });
    if (fErr) throw new Error(fErr.message);

    const origenTipo = gasto.tipo_comprobante === "factura"
      ? "gasto_obra_factura"
      : "gasto_obra_nota";

    const { data: cxp, error: cxpErr } = await supabase
      .from("cuentas_por_pagar")
      .insert({
        company_id: companyId,
        obra_id: gasto.obra_id,
        folio: folioCxp,
        fecha_emision: new Date().toISOString().slice(0, 10),
        fecha_vencimiento: gasto.fecha,
        beneficiario_tipo: "tercero",
        beneficiario_id: gasto.proveedor_id as string,
        beneficiario_nombre: (gasto as any).proveedor?.razon_social ?? "Proveedor",
        concepto: `${gasto.folio} · ${gasto.concepto}`,
        origen_tipo: origenTipo,
        origen_id: gasto.id,
        monto_total: gasto.monto_total,
        monto_pagado: 0,
        estatus: "pendiente",
        creado_por: userId,
      })
      .select("id").single();
    if (cxpErr) throw new Error(cxpErr.message);

    // 2. Material: ingresa al almacén de la obra (semana abierta)
    if (gasto.tipo === "material") {
      await ingresarMaterialAlmacen(supabase, companyId, gasto.obra_id, gasto.id);
    }

    const { error: uErr } = await supabase
      .from("obra_gastos_directos")
      .update({
        estatus: "autorizado",
        autorizado_por: userId,
        autorizado_at: new Date().toISOString(),
        cxp_id: cxp.id,
        motivo_rechazo: null,
      })
      .eq("id", gasto.id);
    if (uErr) throw new Error(uErr.message);

    await notificarGastoObra(supabase, {
      gastoId: gasto.id,
      obraId: gasto.obra_id,
      companyId,
      userId,
      tipo: "gasto_obra_autorizado",
      destinatarioDirecto: gasto.solicitado_por ?? gasto.creado_por,
    });

    return { ok: true, cxpId: cxp.id };
  });

export const rechazarGastoObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), motivo: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    await requirePermission(supabase, userId, "gastos_obra.autorizar");

    const { data: gasto } = await supabase
      .from("obra_gastos_directos")
      .select("id, estatus, obra_id, solicitado_por, creado_por")
      .eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (!gasto) throw new Error("Gasto no encontrado");
    if (gasto.estatus !== "solicitado") throw new Error("El gasto no está pendiente de autorización");

    const { error } = await supabase
      .from("obra_gastos_directos")
      .update({
        estatus: "rechazado",
        motivo_rechazo: data.motivo,
        autorizado_por: userId,
        autorizado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await notificarGastoObra(supabase, {
      gastoId: gasto.id,
      obraId: gasto.obra_id,
      companyId,
      userId,
      tipo: "gasto_obra_rechazado",
      destinatarioDirecto: gasto.solicitado_por ?? gasto.creado_por,
      extra: data.motivo,
    });

    return { ok: true };
  });

export const cancelarGastoObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    const { data: gasto } = await supabase
      .from("obra_gastos_directos")
      .select("id, estatus, creado_por, solicitado_por")
      .eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (!gasto) throw new Error("Gasto no encontrado");
    if (!["borrador", "solicitado", "rechazado"].includes(gasto.estatus)) {
      throw new Error("Solo se pueden cancelar gastos que aún no han sido autorizados");
    }
    const { error } = await supabase
      .from("obra_gastos_directos").update({ estatus: "cancelado" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** CxP pendientes originadas en gastos directos de obra. */
export const listCxPGastosObra = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    const { data, error } = await supabase
      .from("cuentas_por_pagar")
      .select(
        "id, folio, fecha_emision, fecha_vencimiento, obra_id, beneficiario_nombre, concepto, monto_total, monto_pagado, estatus, origen_tipo, origen_id, obra:obras(id, nombre)",
      )
      .eq("company_id", companyId)
      .in("origen_tipo", ["gasto_obra_factura", "gasto_obra_nota"])
      .neq("estatus", "cancelada")
      .is("cancelado_at", null)
      .order("fecha_emision", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      ...r,
      obra_nombre: r.obra?.nombre ?? null,
      pendiente: +(Number(r.monto_total) - Number(r.monto_pagado)).toFixed(2),
      requiere_banco: r.origen_tipo === "gasto_obra_factura",
    }));
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Suma las partidas del gasto a los movimientos de la semana abierta del almacén. */
async function ingresarMaterialAlmacen(
  supabase: any,
  companyId: string,
  obraId: string,
  gastoId: string,
) {
  const { data: partidas } = await supabase
    .from("obra_gasto_directo_partidas")
    .select("insumo_id, cantidad, precio_unitario")
    .eq("gasto_id", gastoId);
  if (!partidas || partidas.length === 0) return;

  const hoy = new Date().toISOString().slice(0, 10);
  let { data: semana } = await supabase
    .from("almacen_semanas")
    .select("id, estatus")
    .eq("obra_id", obraId)
    .in("estatus", ["abierta", "bloqueada"])
    .lte("semana_inicio", hoy)
    .gte("semana_fin", hoy)
    .maybeSingle();

  if (!semana) {
    const d = new Date(hoy + "T00:00:00Z");
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
    const lunes = d.toISOString().slice(0, 10);
    const fin = new Date(lunes + "T00:00:00Z");
    fin.setUTCDate(fin.getUTCDate() + 6);
    const { data: nueva, error: sErr } = await supabase
      .from("almacen_semanas")
      .insert({
        company_id: companyId,
        obra_id: obraId,
        semana_inicio: lunes,
        semana_fin: fin.toISOString().slice(0, 10),
        estatus: "abierta",
      })
      .select("id, estatus").single();
    if (sErr) throw new Error(`No se pudo abrir la semana de almacén: ${sErr.message}`);
    semana = nueva;
  }
  if (semana.estatus !== "abierta") {
    throw new Error("La semana de almacén está bloqueada; desbloquéala para ingresar el material");
  }

  for (const p of partidas as any[]) {
    const { data: existente } = await supabase
      .from("almacen_movimientos_semana")
      .select("id, recibido")
      .eq("semana_id", semana.id)
      .eq("insumo_id", p.insumo_id)
      .eq("precio_unitario", p.precio_unitario)
      .maybeSingle();
    if (existente) {
      await supabase
        .from("almacen_movimientos_semana")
        .update({ recibido: Number(existente.recibido) + Number(p.cantidad) })
        .eq("id", existente.id);
    } else {
      await supabase.from("almacen_movimientos_semana").insert({
        semana_id: semana.id,
        insumo_id: p.insumo_id,
        inv_inicial: 0,
        recibido: Number(p.cantidad),
        utilizado: 0,
        precio_unitario: Number(p.precio_unitario),
      });
    }
  }
}

async function notificarGastoObra(
  supabase: any,
  args: {
    gastoId: string;
    obraId: string;
    companyId: string;
    userId: string;
    tipo: "gasto_obra_solicitado" | "gasto_obra_autorizado" | "gasto_obra_rechazado";
    destinatarioDirecto?: string | null;
    extra?: string;
  },
) {
  try {
    const { data: gasto } = await supabase
      .from("obra_gastos_directos")
      .select("folio, concepto, monto_total")
      .eq("id", args.gastoId).maybeSingle();
    const { data: obra } = await supabase
      .from("obras").select("nombre").eq("id", args.obraId).maybeSingle();
    const donde = obra?.nombre ? ` · ${obra.nombre}` : "";
    const link = `/app/obras/${args.obraId}/gastos-obra`;

    let destinatarios: string[] = [];
    if (args.destinatarioDirecto) {
      destinatarios = [args.destinatarioDirecto].filter((u) => u && u !== args.userId) as string[];
    } else {
      const { data: team } = await supabase
        .from("obra_team").select("user_id").eq("obra_id", args.obraId).eq("role", "supervisor");
      const { data: dirs } = await supabase
        .from("user_roles").select("user_id")
        .eq("company_id", args.companyId).eq("role", "director");
      destinatarios = Array.from(
        new Set([
          ...((team ?? []) as any[]).map((t) => t.user_id as string),
          ...((dirs ?? []) as any[]).map((t) => t.user_id as string),
        ]),
      ).filter((u) => u !== args.userId);
    }
    if (destinatarios.length === 0) return;

    const titulo =
      args.tipo === "gasto_obra_solicitado"
        ? "Gasto de obra por autorizar"
        : args.tipo === "gasto_obra_autorizado"
          ? "Gasto de obra autorizado"
          : "Gasto de obra rechazado";
    const mensaje =
      args.tipo === "gasto_obra_rechazado"
        ? `${gasto?.folio ?? ""} · ${gasto?.concepto ?? ""}${donde}. Motivo: ${args.extra ?? ""}`
        : `${gasto?.folio ?? ""} · ${gasto?.concepto ?? ""}${donde}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notificaciones").insert(
      destinatarios.map((uid) => ({
        user_id: uid,
        company_id: args.companyId,
        obra_id: args.obraId,
        tipo: args.tipo,
        titulo,
        mensaje,
        link,
      })),
    );
  } catch (e: any) {
    console.error("[notificaciones] gasto_obra", e?.message);
  }
}
