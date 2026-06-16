import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCtx(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa");
  const { data: roles } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("company_id", profile.company_id);
  const roleSet = new Set<string>((roles ?? []).map((r: { role: string }) => r.role));
  return { companyId: profile.company_id as string, roles: roleSet };
}

function assertPayer(roles: Set<string>) {
  if (!roles.has("director") && !roles.has("administrativo")) {
    throw new Error("No tienes permisos para registrar pagos");
  }
}

const metodoEnum = z.enum(["efectivo", "transferencia", "cheque"]);

const registrarOCSchema = z.object({
  ocId: z.string().uuid(),
  cuentaId: z.string().uuid(),
  monto: z.number().positive(),
  metodo: metodoEnum,
  fecha: z.string().min(10).max(10),
  referencia: z.string().trim().max(120).optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
});

export const registrarPagoOC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registrarOCSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertPayer(roles);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Lee cuenta
    const { data: cuenta, error: cErr } = await supabaseAdmin
      .from("cuentas")
      .select("id, company_id, tipo, activa, saldo_actual, nombre")
      .eq("id", data.cuentaId).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cuenta || cuenta.company_id !== companyId) throw new Error("Cuenta no encontrada");
    if (!cuenta.activa) throw new Error("La cuenta está inactiva");

    if (cuenta.tipo === "caja_fuerte" && data.metodo !== "efectivo") {
      throw new Error("La caja fuerte solo admite pagos en efectivo");
    }
    if (cuenta.tipo === "bancaria" && data.metodo === "efectivo") {
      throw new Error("Las cuentas bancarias no admiten pagos en efectivo");
    }

    // Lee OC
    const { data: oc, error: ocErr } = await supabaseAdmin
      .from("ordenes_compra")
      .select("id, company_id, folio, total, monto_pagado, estatus, proveedor:terceros(razon_social)")
      .eq("id", data.ocId).maybeSingle();
    if (ocErr) throw new Error(ocErr.message);
    if (!oc || oc.company_id !== companyId) throw new Error("OC no encontrada");
    if (!["autorizada", "enviada"].includes(oc.estatus)) {
      throw new Error("Solo se pueden pagar OCs autorizadas o enviadas al proveedor");
    }

    const total = Number(oc.total);
    const pagado = Number(oc.monto_pagado);
    const pendiente = +(total - pagado).toFixed(2);
    if (data.monto > pendiente + 0.01) {
      throw new Error(`El monto (${data.monto}) excede el saldo pendiente (${pendiente})`);
    }

    const proveedorNombre = (oc.proveedor as { razon_social?: string } | null)?.razon_social ?? "Proveedor";
    const concepto = `Pago OC ${oc.folio} · ${proveedorNombre}`;

    // 1. Insert pago
    const { data: pago, error: pErr } = await supabaseAdmin
      .from("pagos")
      .insert({
        company_id: companyId,
        cuenta_id: data.cuentaId,
        fecha: data.fecha,
        monto: data.monto,
        metodo: data.metodo,
        referencia: data.referencia || null,
        concepto,
        notas: data.notas || null,
        origen_tipo: "oc",
        origen_id: data.ocId,
        creado_por: userId,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);

    // 2. Insert movimiento
    const { data: mov, error: mErr } = await supabaseAdmin
      .from("cuenta_movimientos")
      .insert({
        cuenta_id: data.cuentaId,
        company_id: companyId,
        fecha: data.fecha,
        tipo: "egreso",
        monto: data.monto,
        concepto,
        referencia: data.referencia || null,
        origen: "pago",
        origen_id: pago.id,
        creado_por: userId,
      })
      .select("id")
      .single();
    if (mErr) {
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(mErr.message);
    }

    // 3. Link movimiento al pago
    await supabaseAdmin.from("pagos").update({ cuenta_movimiento_id: mov.id }).eq("id", pago.id);

    // 4. Update saldo cuenta
    const nuevoSaldo = +(Number(cuenta.saldo_actual) - data.monto).toFixed(2);
    const { error: sErr } = await supabaseAdmin
      .from("cuentas").update({ saldo_actual: nuevoSaldo }).eq("id", data.cuentaId);
    if (sErr) {
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(sErr.message);
    }

    // 5. Update OC
    const nuevoPagado = +(pagado + data.monto).toFixed(2);
    const nuevoEstado: "parcial" | "pagado" = nuevoPagado >= total - 0.01 ? "pagado" : "parcial";
    const updateOC: {
      monto_pagado: number;
      estado_pago: "parcial" | "pagado";
      pagada_at?: string;
    } = {
      monto_pagado: nuevoPagado,
      estado_pago: nuevoEstado,
    };
    if (nuevoEstado === "pagado") updateOC.pagada_at = new Date().toISOString();

    const { error: ocUpdErr } = await supabaseAdmin
      .from("ordenes_compra").update(updateOC).eq("id", data.ocId);
    if (ocUpdErr) {
      // rollback
      await supabaseAdmin.from("cuentas").update({ saldo_actual: cuenta.saldo_actual }).eq("id", data.cuentaId);
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(ocUpdErr.message);
    }

    return { id: pago.id };
  });

export const listPagosOC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ocId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    if (!roles.has("director") && !roles.has("administrativo")) {
      throw new Error("No tienes permisos");
    }

    const { data: rows, error } = await supabase
      .from("pagos")
      .select("id, fecha, monto, metodo, referencia, concepto, notas, cancelado_at, created_at, cuenta:cuentas(id, nombre, tipo)")
      .eq("company_id", companyId)
      .eq("origen_tipo", "oc")
      .eq("origen_id", data.ocId)
      .is("cancelado_at", null)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const cancelarPagoOC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pagoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    if (!roles.has("director")) throw new Error("Solo el director puede cancelar pagos");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pago, error } = await supabase
      .from("pagos")
      .select("id, company_id, cuenta_id, monto, origen_tipo, origen_id, cuenta_movimiento_id, cancelado_at")
      .eq("id", data.pagoId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!pago || pago.company_id !== companyId) throw new Error("Pago no encontrado");
    if (pago.cancelado_at) throw new Error("El pago ya está cancelado");
    if (pago.origen_tipo !== "oc") throw new Error("Tipo de pago no soportado para cancelación");

    // Restaurar saldo
    const { data: cuenta } = await supabaseAdmin
      .from("cuentas").select("saldo_actual").eq("id", pago.cuenta_id).maybeSingle();
    if (cuenta) {
      const nuevoSaldo = +(Number(cuenta.saldo_actual) + Number(pago.monto)).toFixed(2);
      await supabaseAdmin.from("cuentas").update({ saldo_actual: nuevoSaldo }).eq("id", pago.cuenta_id);
    }

    // Borrar movimiento
    if (pago.cuenta_movimiento_id) {
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", pago.cuenta_movimiento_id);
    }

    // Restaurar OC
    const { data: oc } = await supabaseAdmin
      .from("ordenes_compra").select("total, monto_pagado").eq("id", pago.origen_id).maybeSingle();
    if (oc) {
      const nuevoPagado = +(Number(oc.monto_pagado) - Number(pago.monto)).toFixed(2);
      const total = Number(oc.total);
      const nuevoEstado = nuevoPagado <= 0.01 ? "pendiente" : (nuevoPagado >= total - 0.01 ? "pagado" : "parcial");
      await supabaseAdmin.from("ordenes_compra").update({
        monto_pagado: Math.max(0, nuevoPagado),
        estado_pago: nuevoEstado,
        pagada_at: nuevoEstado === "pagado" ? new Date().toISOString() : null,
      }).eq("id", pago.origen_id);
    }

    // Marcar pago como cancelado (mantenemos historial)
    await supabaseAdmin.from("pagos").update({
      cancelado_at: new Date().toISOString(),
      cancelado_por: userId,
    }).eq("id", pago.id);

    return { ok: true };
  });

// ============================================================
// Saldos por proveedor
// ============================================================

export const getSaldosProveedores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    if (!roles.has("director") && !roles.has("administrativo")) {
      throw new Error("No tienes permisos");
    }

    // OCs con saldo pendiente
    const { data: ocs, error } = await supabase
      .from("ordenes_compra")
      .select("id, proveedor_id, total, monto_pagado, estado_pago, estatus, proveedor:terceros(id, razon_social)")
      .eq("company_id", companyId)
      .in("estatus", ["autorizada", "enviada", "recibida_parcial", "recibida"])
      .neq("estado_pago", "pagado");
    if (error) throw new Error(error.message);

    const map = new Map<string, {
      proveedor_id: string;
      razon_social: string;
      total_ordenado: number;
      total_pagado: number;
      saldo_pendiente: number;
      oc_pendientes_count: number;
    }>();

    for (const oc of ocs ?? []) {
      const prov = oc.proveedor as { id: string; razon_social: string } | null;
      if (!prov) continue;
      const key = prov.id;
      const cur = map.get(key) ?? {
        proveedor_id: prov.id,
        razon_social: prov.razon_social,
        total_ordenado: 0,
        total_pagado: 0,
        saldo_pendiente: 0,
        oc_pendientes_count: 0,
      };
      const total = Number(oc.total);
      const pagado = Number(oc.monto_pagado);
      cur.total_ordenado += total;
      cur.total_pagado += pagado;
      cur.saldo_pendiente += (total - pagado);
      if (oc.estado_pago !== "pagado") cur.oc_pendientes_count += 1;
      map.set(key, cur);
    }

    return Array.from(map.values())
      .map((r) => ({
        ...r,
        total_ordenado: +r.total_ordenado.toFixed(2),
        total_pagado: +r.total_pagado.toFixed(2),
        saldo_pendiente: +r.saldo_pendiente.toFixed(2),
      }))
      .sort((a, b) => b.saldo_pendiente - a.saldo_pendiente);
  });

export const getDetalleSaldoProveedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ proveedorId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    if (!roles.has("director") && !roles.has("administrativo")) {
      throw new Error("No tienes permisos");
    }

    const { data: ocs, error } = await supabase
      .from("ordenes_compra")
      .select("id, folio, total, monto_pagado, estado_pago, estatus, pagada_at, created_at, obra:obras(id, nombre)")
      .eq("company_id", companyId)
      .eq("proveedor_id", data.proveedorId)
      .in("estatus", ["autorizada", "enviada", "recibida_parcial", "recibida"])
      .neq("estado_pago", "pagado")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ocs ?? [];
  });

// ============================================================
// Cuentas por pagar (destajo estimaciones, etc.)
// ============================================================

export const listCxPDestajoPendientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertPayer(roles);

    const { data, error } = await supabase
      .from("cuentas_por_pagar")
      .select("id, folio, fecha_emision, obra_id, beneficiario_nombre, concepto, monto_total, monto_pagado, estatus, origen_tipo, origen_id, obra:obras(id, nombre)")
      .eq("company_id", companyId)
      .eq("beneficiario_tipo", "trabajador")
      .eq("origen_tipo", "destajo_estimacion")
      .in("estatus", ["pendiente", "parcial"])
      .is("cancelado_at", null)
      .order("fecha_emision", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      folio: r.folio,
      fecha_emision: r.fecha_emision,
      obra_id: r.obra_id,
      obra_nombre: r.obra?.nombre ?? null,
      beneficiario_nombre: r.beneficiario_nombre,
      concepto: r.concepto,
      monto_total: Number(r.monto_total),
      monto_pagado: Number(r.monto_pagado),
      saldo: +(Number(r.monto_total) - Number(r.monto_pagado)).toFixed(2),
      estatus: r.estatus,
      origen_tipo: r.origen_tipo,
      origen_id: r.origen_id,
    }));
  });

export const listCxPSubcontratoPendientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertPayer(roles);

    const { data, error } = await supabase
      .from("cuentas_por_pagar")
      .select("id, folio, fecha_emision, obra_id, beneficiario_nombre, concepto, monto_total, monto_pagado, estatus, origen_tipo, origen_id, obra:obras(id, nombre)")
      .eq("company_id", companyId)
      .eq("beneficiario_tipo", "tercero")
      .eq("origen_tipo", "subcontrato_estimacion")
      .in("estatus", ["pendiente", "parcial"])
      .is("cancelado_at", null)
      .order("fecha_emision", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      folio: r.folio,
      fecha_emision: r.fecha_emision,
      obra_id: r.obra_id,
      obra_nombre: r.obra?.nombre ?? null,
      beneficiario_nombre: r.beneficiario_nombre,
      concepto: r.concepto,
      monto_total: Number(r.monto_total),
      monto_pagado: Number(r.monto_pagado),
      saldo: +(Number(r.monto_total) - Number(r.monto_pagado)).toFixed(2),
      estatus: r.estatus,
      origen_tipo: r.origen_tipo,
      origen_id: r.origen_id,
    }));
  });

const registrarCxPSchema = z.object({
  cxpId: z.string().uuid(),
  cuentaId: z.string().uuid(),
  monto: z.number().positive(),
  metodo: metodoEnum,
  fecha: z.string().min(10).max(10),
  referencia: z.string().trim().max(120).optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
});

export const registrarPagoCxP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registrarCxPSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertPayer(roles);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Lee cuenta
    const { data: cuenta, error: cErr } = await supabaseAdmin
      .from("cuentas")
      .select("id, company_id, tipo, activa, saldo_actual, nombre")
      .eq("id", data.cuentaId).maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cuenta || cuenta.company_id !== companyId) throw new Error("Cuenta no encontrada");
    if (!cuenta.activa) throw new Error("La cuenta está inactiva");

    if (cuenta.tipo === "caja_fuerte" && data.metodo !== "efectivo") {
      throw new Error("La caja fuerte solo admite pagos en efectivo");
    }
    if (cuenta.tipo === "bancaria" && data.metodo === "efectivo") {
      throw new Error("Las cuentas bancarias no admiten pagos en efectivo");
    }

    // Lee CxP
    const { data: cxp, error: cxpErr } = await supabaseAdmin
      .from("cuentas_por_pagar")
      .select("id, company_id, obra_id, folio, beneficiario_nombre, beneficiario_tipo, beneficiario_id, origen_tipo, origen_id, monto_total, monto_pagado, estatus, cancelado_at")
      .eq("id", data.cxpId).maybeSingle();
    if (cxpErr) throw new Error(cxpErr.message);
    if (!cxp || cxp.company_id !== companyId) throw new Error("Cuenta por pagar no encontrada");
    if (cxp.cancelado_at) throw new Error("La cuenta por pagar está cancelada");
    if (cxp.estatus === "pagada") throw new Error("La cuenta por pagar ya está pagada");

    // Fondo de caja chica: solo se paga en efectivo desde caja fuerte
    if (cxp.origen_tipo === "caja_chica_fondo") {
      if (cuenta.tipo !== "caja_fuerte" || data.metodo !== "efectivo") {
        throw new Error("El fondo de caja chica solo se entrega en efectivo desde caja fuerte");
      }
    }

    const total = Number(cxp.monto_total);
    const pagado = Number(cxp.monto_pagado);
    const pendiente = +(total - pagado).toFixed(2);
    if (data.monto > pendiente + 0.01) {
      throw new Error(`El monto (${data.monto}) excede el saldo pendiente (${pendiente})`);
    }

    const concepto = `Pago CxP ${cxp.folio} · ${cxp.beneficiario_nombre}`;

    // 1. Insert pago
    const { data: pago, error: pErr } = await supabaseAdmin
      .from("pagos")
      .insert({
        company_id: companyId,
        cuenta_id: data.cuentaId,
        fecha: data.fecha,
        monto: data.monto,
        metodo: data.metodo,
        referencia: data.referencia || null,
        concepto,
        notas: data.notas || null,
        origen_tipo: "cxp",
        origen_id: data.cxpId,
        creado_por: userId,
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);

    // 2. Insert movimiento
    const { data: mov, error: mErr } = await supabaseAdmin
      .from("cuenta_movimientos")
      .insert({
        cuenta_id: data.cuentaId,
        company_id: companyId,
        fecha: data.fecha,
        tipo: "egreso",
        monto: data.monto,
        concepto,
        referencia: data.referencia || null,
        origen: "pago",
        origen_id: pago.id,
        creado_por: userId,
      })
      .select("id")
      .single();
    if (mErr) {
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(mErr.message);
    }

    // 3. Link movimiento al pago
    await supabaseAdmin.from("pagos").update({ cuenta_movimiento_id: mov.id }).eq("id", pago.id);

    // 4. Update saldo cuenta
    const nuevoSaldo = +(Number(cuenta.saldo_actual) - data.monto).toFixed(2);
    const { error: sErr } = await supabaseAdmin
      .from("cuentas").update({ saldo_actual: nuevoSaldo }).eq("id", data.cuentaId);
    if (sErr) {
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(sErr.message);
    }

    // 5. Update CxP
    const nuevoPagado = +(pagado + data.monto).toFixed(2);
    const nuevoEstado: "parcial" | "pagada" = nuevoPagado >= total - 0.01 ? "pagada" : "parcial";
    const { error: cxpUpdErr } = await supabaseAdmin
      .from("cuentas_por_pagar")
      .update({ monto_pagado: nuevoPagado, estatus: nuevoEstado })
      .eq("id", data.cxpId);
    if (cxpUpdErr) {
      await supabaseAdmin.from("cuentas").update({ saldo_actual: cuenta.saldo_actual }).eq("id", data.cuentaId);
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(cxpUpdErr.message);
    }

    // 6. Asiento contable doble partida: cargo a pasivo, abono a cuenta (banco / caja fuerte)
    const cuentaPasivo =
      cxp.beneficiario_tipo === "trabajador" && cxp.origen_tipo === "destajo_estimacion"
        ? "Cuentas por pagar - Contratistas destajo"
        : cxp.origen_tipo === "subcontrato_estimacion"
          ? "Cuentas por pagar - Subcontratistas"
          : cxp.origen_tipo === "nomina"
            ? "Nómina por pagar"
            : cxp.origen_tipo === "caja_chica_fondo"
              ? "Cuentas por pagar - Caja chica"
              : "Cuentas por pagar";
    const cuentaActivo = cuenta.tipo === "bancaria" ? "Bancos" : "Caja fuerte";

    const asientoId = crypto.randomUUID();
    const renglones = [
      {
        company_id: companyId,
        asiento_id: asientoId,
        fecha: data.fecha,
        concepto,
        referencia: cxp.folio,
        origen_tipo: "pago_cxp",
        origen_id: pago.id,
        tipo_movimiento: "cargo",
        cuenta_contable: cuentaPasivo,
        monto: data.monto,
        creado_por: userId,
      },
      {
        company_id: companyId,
        asiento_id: asientoId,
        fecha: data.fecha,
        concepto,
        referencia: cxp.folio,
        origen_tipo: "pago_cxp",
        origen_id: pago.id,
        tipo_movimiento: "abono",
        cuenta_contable: cuentaActivo,
        monto: data.monto,
        creado_por: userId,
      },
    ];
    await supabaseAdmin.from("asientos_contables").insert(renglones);

    // 7. Hook por origen: caja chica fondo → marcar fondo como entregado y notificar
    if (cxp.origen_tipo === "caja_chica_fondo" && nuevoEstado === "pagada" && cxp.origen_id) {
      await supabaseAdmin
        .from("caja_chica_fondos")
        .update({
          estatus: "entregado",
          monto_entregado: nuevoPagado,
          entregado_por: userId,
          entregado_at: new Date().toISOString(),
        })
        .eq("id", cxp.origen_id);

      if (cxp.beneficiario_id) {
        await supabaseAdmin.from("notificaciones").insert({
          user_id: cxp.beneficiario_id,
          company_id: companyId,
          obra_id: cxp.obra_id,
          tipo: "caja_chica_fondo_entregado",
          titulo: "Fondo de caja chica entregado",
          mensaje: `Recibiste $${data.monto.toFixed(2)} en efectivo (${cxp.folio})`,
          link: cxp.obra_id ? `/app/obras/${cxp.obra_id}/caja-chica` : "/app",
        });
      }
    }

    return { id: pago.id };
  });

// ============================================================
// CxP de fondo de caja chica pendientes
// ============================================================

export const listCxPCajaChicaFondoPendientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertPayer(roles);

    const { data, error } = await supabase
      .from("cuentas_por_pagar")
      .select("id, folio, fecha_emision, obra_id, beneficiario_id, beneficiario_nombre, concepto, monto_total, monto_pagado, estatus, origen_tipo, origen_id, obra:obras(id, nombre)")
      .eq("company_id", companyId)
      .eq("origen_tipo", "caja_chica_fondo")
      .in("estatus", ["pendiente", "parcial"])
      .is("cancelado_at", null)
      .order("fecha_emision", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      folio: r.folio,
      fecha_emision: r.fecha_emision,
      obra_id: r.obra_id,
      obra_nombre: r.obra?.nombre ?? null,
      beneficiario_id: r.beneficiario_id,
      beneficiario_nombre: r.beneficiario_nombre,
      concepto: r.concepto,
      monto_total: Number(r.monto_total),
      monto_pagado: Number(r.monto_pagado),
      saldo: +(Number(r.monto_total) - Number(r.monto_pagado)).toFixed(2),
      estatus: r.estatus,
      origen_tipo: r.origen_tipo,
      origen_id: r.origen_id,
    }));
  });
