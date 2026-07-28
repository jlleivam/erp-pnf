import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/permisos/require";

async function getCtx(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const { data: roles } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("company_id", profile.company_id);
  const r = (roles ?? []).map((x: any) => x.role as string);
  return { companyId: profile.company_id as string, roles: r };
}

function assertAdmin(roles: string[]) {
  if (!roles.includes("director") && !roles.includes("administrativo")) {
    throw new Error("Solo Director o Administrativo pueden gestionar cotizaciones");
  }
}

async function recalcEstatusRequisicion(supabase: any, requisicionId: string, userId?: string) {
  const { data: paquetes } = await supabase
    .from("cotizacion_paquetes").select("id").eq("requisicion_id", requisicionId);
  const { data: ocs } = await supabase
    .from("ordenes_compra").select("estatus").eq("requisicion_id", requisicionId);

  const ocList = (ocs ?? []) as Array<{ estatus: string }>;
  const enOC = ["autorizada", "enviada", "recibida_parcial", "recibida", "pagada"];
  let nuevo: string | null = null;
  if (ocList.length > 0) {
    if (ocList.every((o) => o.estatus === "recibida" || o.estatus === "pagada"))
      nuevo = "completada";
    else if (ocList.every((o) => enOC.includes(o.estatus)))
      nuevo = "oc_generada";
    else if (ocList.some((o) => o.estatus === "pendiente_autorizacion"))
      nuevo = "pendiente_autorizacion";
    else if (ocList.some((o) => o.estatus === "borrador"))
      nuevo = "en_cotizacion";
  } else if ((paquetes ?? []).length > 0) {
    nuevo = "en_cotizacion";
  }
  if (!nuevo) return;
  const nowIso = new Date().toISOString();
  const patch: any = { estatus: nuevo };
  if (nuevo === "en_cotizacion") { patch.cotizacion_at = nowIso; if (userId) patch.cotizacion_por = userId; }
  if (nuevo === "pendiente_autorizacion") { patch.autorizacion_at = nowIso; if (userId) patch.autorizacion_por = userId; }
  if (nuevo === "oc_generada") { patch.oc_at = nowIso; if (userId) patch.oc_por = userId; }
  if (nuevo === "completada") { patch.completada_at = nowIso; if (userId) patch.completada_por = userId; }
  await supabase.from("requisiciones").update(patch).eq("id", requisicionId);
}



export const getCotizacionRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requisicionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId: _userId } = context;
    void _userId;



    const { data: req, error: reqErr } = await supabase
      .from("requisiciones")
      .select("id, folio, obra_id, company_id, estatus, notas, created_at, enviada_at, creado_por, items:requisicion_insumos(id, cantidad, fecha_requerida, nota, insumo:insumos(id, nombre, unidad))")
      .eq("id", data.requisicionId).maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Requisición no encontrada");

    let solicitanteNombre: string | null = null;
    if ((req as any).creado_por) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nombre_completo, email")
        .eq("id", (req as any).creado_por)
        .maybeSingle();
      solicitanteNombre = (prof as any)?.nombre_completo || (prof as any)?.email || null;
    }
    (req as any).solicitante = solicitanteNombre;

    const { data: paquetes, error: paqErr } = await supabase
      .from("cotizacion_paquetes")
      .select("id, numero, proveedor_id, created_at, proveedor:terceros(id, razon_social), items:cotizacion_paquete_insumos(id, insumo_id, cantidad, precio_unitario, subtotal)")
      .eq("requisicion_id", data.requisicionId)
      .order("numero", { ascending: true });
    if (paqErr) throw new Error(paqErr.message);

    const { data: ocs, error: ocsErr } = await supabase
      .from("ordenes_compra")
      .select("id, paquete_id, folio, estatus, total, monto_pagado, estado_pago, pagada_at, enviada_supervisor_at, enviada_proveedor_at, autorizada_at, rechazada_at, notas_supervisor, created_at, proveedor:terceros(id, razon_social), paquete:cotizacion_paquetes(id, numero, items:cotizacion_paquete_insumos(id, cantidad, precio_unitario, subtotal, insumo:insumos(id, nombre, unidad)))")
      .eq("requisicion_id", data.requisicionId)
      .order("created_at", { ascending: true });
    if (ocsErr) throw new Error(ocsErr.message);

    // Recepciones por OC para mostrar cantidad recibida por insumo
    const ocIds = (ocs ?? []).map((o: any) => o.id);
    const recByOc: Record<string, Record<string, number>> = {};
    const lastRecAt: Record<string, string | null> = {};
    if (ocIds.length > 0) {
      const { data: recs } = await supabase
        .from("almacen_recepciones")
        .select("id, oc_id, fecha, partidas:almacen_recepcion_partidas(insumo_id, cantidad)")
        .in("oc_id", ocIds);
      for (const r of (recs ?? []) as any[]) {
        const map = (recByOc[r.oc_id] ??= {});
        for (const p of (r.partidas ?? []) as any[]) {
          map[p.insumo_id] = (map[p.insumo_id] ?? 0) + Number(p.cantidad);
        }
        const prev = lastRecAt[r.oc_id];
        if (!prev || (r.fecha && r.fecha > prev)) lastRecAt[r.oc_id] = r.fecha ?? prev ?? null;
      }
    }
    const ocsEnriquecidas = (ocs ?? []).map((o: any) => {
      const recibido = recByOc[o.id] ?? {};
      const items = o.paquete?.items ?? [];
      let completa = items.length > 0;
      for (const it of items) {
        const ped = Number(it.cantidad);
        const rec = Number(recibido[it.insumo?.id] ?? 0);
        if (rec + 1e-6 < ped) { completa = false; break; }
      }
      return {
        ...o,
        recibido_por_insumo: recibido,
        recepcion_completa: completa,
        ultima_recepcion_at: lastRecAt[o.id] ?? null,
      };
    });

    return { requisicion: req, paquetes: paquetes ?? [], ocs: ocsEnriquecidas };
  });

export const listProveedores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);
    const { data, error } = await supabase
      .from("terceros")
      .select("id, razon_social, categoria")
      .eq("company_id", companyId)
      .in("categoria", ["proveedor", "ambos"])
      .order("razon_social", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const InsumoInput = z.object({
  insumo_id: z.string().uuid(),
  cantidad: z.number().positive(),
  precio_unitario: z.number().min(0),
});

export const guardarPaquete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      requisicionId: z.string().uuid(),
      paqueteId: z.string().uuid().optional().nullable(),
      proveedorId: z.string().uuid().nullable(),
      insumos: z.array(InsumoInput),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertAdmin(roles);

    const { data: req } = await supabase
      .from("requisiciones").select("id, company_id").eq("id", data.requisicionId).maybeSingle();
    if (!req || req.company_id !== companyId) throw new Error("Requisición no válida");

    // Nota: se permite que un mismo insumo esté en varios paquetes de la misma
    // requisición, porque la asignación puede repartirse entre varios proveedores.



    let paqueteId = data.paqueteId ?? null;
    if (!paqueteId && data.proveedorId) {
      // Buscar un paquete existente reusable para (requisicion, proveedor):
      // sin OC, o con OC en borrador/rechazada. Evita crear duplicados.
      const { data: existentes } = await supabase
        .from("cotizacion_paquetes")
        .select("id, ordenes_compra(id, estatus)")
        .eq("requisicion_id", data.requisicionId)
        .eq("proveedor_id", data.proveedorId);
      const reusables = (existentes ?? []).filter((p: any) => {
        const ocs = (p.ordenes_compra ?? []) as Array<{ estatus: string }>;
        if (ocs.length === 0) return true;
        return ocs.every((o) => o.estatus === "borrador" || o.estatus === "rechazada");
      });
      const bloqueados = (existentes ?? []).length - reusables.length;
      if (reusables.length > 0) {
        paqueteId = reusables[0].id;
      } else if (bloqueados > 0) {
        throw new Error(
          "Ya existe una OC pendiente o autorizada para este proveedor en esta requisición",
        );
      }
    }

    if (!paqueteId) {
      const { data: maxRow } = await supabase
        .from("cotizacion_paquetes").select("numero")
        .eq("requisicion_id", data.requisicionId)
        .order("numero", { ascending: false }).limit(1).maybeSingle();
      const numero = (maxRow?.numero ?? 0) + 1;
      const { data: nuevo, error } = await supabase
        .from("cotizacion_paquetes")
        .insert({
          requisicion_id: data.requisicionId,
          company_id: companyId,
          proveedor_id: data.proveedorId,
          numero,
        })
        .select("id").single();
      if (error) throw new Error(error.message);
      paqueteId = nuevo.id;
    } else {
      // verificar que no tenga OC enviada
      const { data: ocBloqueante } = await supabase
        .from("ordenes_compra").select("id, estatus").eq("paquete_id", paqueteId).neq("estatus", "borrador").neq("estatus", "rechazada").maybeSingle();
      if (ocBloqueante) throw new Error("El paquete tiene una OC enviada y no puede editarse");
      const { error: updErr } = await supabase
        .from("cotizacion_paquetes")
        .update({ proveedor_id: data.proveedorId })
        .eq("id", paqueteId);
      if (updErr) throw new Error(updErr.message);
      await supabase.from("cotizacion_paquete_insumos").delete().eq("paquete_id", paqueteId);
    }


    if (data.insumos.length > 0) {
      const rows = data.insumos.map((i) => ({
        paquete_id: paqueteId!,
        insumo_id: i.insumo_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      }));
      const { error: insErr } = await supabase.from("cotizacion_paquete_insumos").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    await recalcEstatusRequisicion(supabase, data.requisicionId, userId);
    return { id: paqueteId };
  });

export const eliminarPaquete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paqueteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getCtx(supabase, userId);
    assertAdmin(roles);
    const { data: paquete } = await supabase
      .from("cotizacion_paquetes").select("id, requisicion_id").eq("id", data.paqueteId).maybeSingle();
    if (!paquete) throw new Error("Paquete no encontrado");
    const { data: oc } = await supabase
      .from("ordenes_compra").select("id, estatus").eq("paquete_id", data.paqueteId).maybeSingle();
    if (oc && oc.estatus !== "borrador") throw new Error("No se puede eliminar: tiene OC enviada");
    if (oc) await supabase.from("ordenes_compra").delete().eq("id", oc.id);
    const { error } = await supabase.from("cotizacion_paquetes").delete().eq("id", data.paqueteId);
    if (error) throw new Error(error.message);
    await recalcEstatusRequisicion(supabase, paquete.requisicion_id, userId);
    return { ok: true };
  });

export const generarOC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paqueteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertAdmin(roles);

    const { data: paquete } = await supabase
      .from("cotizacion_paquetes")
      .select("id, requisicion_id, company_id, proveedor_id, items:cotizacion_paquete_insumos(id, precio_unitario, subtotal)")
      .eq("id", data.paqueteId).maybeSingle();
    if (!paquete) throw new Error("Paquete no encontrado");
    if (!paquete.proveedor_id) throw new Error("Selecciona un proveedor");
    const items = (paquete as any).items ?? [];
    if (items.length === 0) throw new Error("El paquete no tiene insumos");
    const total = items.reduce((s: number, it: any) => s + Number(it.subtotal ?? 0), 0);
    if (total <= 0) throw new Error("Captura precios unitarios antes de generar la OC");

    const { data: existing } = await supabase
      .from("ordenes_compra").select("id, estatus").eq("paquete_id", data.paqueteId).maybeSingle();
    if (existing) {
      if (existing.estatus !== "borrador" && existing.estatus !== "rechazada") {
        throw new Error("Ya existe una OC para este paquete");
      }
      const { error: updErr } = await supabase
        .from("ordenes_compra")
        .update({ total, estatus: "borrador", rechazada_at: null, rechazada_por: null, notas_supervisor: null })
        .eq("id", existing.id);
      if (updErr) throw new Error(updErr.message);
      await recalcEstatusRequisicion(supabase, paquete.requisicion_id, userId);
      return { id: existing.id };
    }

    const { data: req } = await supabase
      .from("requisiciones").select("obra_id").eq("id", paquete.requisicion_id).single();
    if (!req) throw new Error("Requisición no encontrada");

    const { data: folio, error: folioErr } = await supabase
      .rpc("siguiente_folio_oc", { _company_id: companyId });
    if (folioErr) throw new Error(folioErr.message);

    const { data: nueva, error: insErr } = await supabase
      .from("ordenes_compra")
      .insert({
        paquete_id: paquete.id,
        requisicion_id: paquete.requisicion_id,
        company_id: companyId,
        obra_id: req.obra_id,
        proveedor_id: paquete.proveedor_id,
        folio: folio as string,
        estatus: "borrador",
        total,
        creado_por: userId,
      })
      .select("id").single();
    if (insErr) throw new Error(insErr.message);
    await recalcEstatusRequisicion(supabase, paquete.requisicion_id, userId);
    return { id: nueva.id };
  });

export const enviarOCASupervisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ocId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertAdmin(roles);
    const { data: oc } = await supabase
      .from("ordenes_compra").select("id, folio, requisicion_id, obra_id, estatus").eq("id", data.ocId).maybeSingle();
    if (!oc) throw new Error("OC no encontrada");
    if (oc.estatus !== "borrador") throw new Error("La OC ya fue enviada");
    const { error } = await supabase
      .from("ordenes_compra")
      .update({ estatus: "pendiente_autorizacion", enviada_supervisor_at: new Date().toISOString() })
      .eq("id", data.ocId);
    if (error) throw new Error(error.message);

    // Notificar a supervisores de la empresa
    try {
      const { data: sups } = await supabase
        .from("user_roles").select("user_id").eq("company_id", companyId).in("role", ["supervisor", "director"]);
      const destinatarios = Array.from(new Set((sups ?? []).map((s: any) => s.user_id as string).filter((u) => u !== userId)));
      if (destinatarios.length > 0) {
        const { data: req } = await supabase
          .from("requisiciones").select("folio").eq("id", oc.requisicion_id).maybeSingle();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: notifErr } = await supabaseAdmin.from("notificaciones").insert(
          destinatarios.map((uid) => ({
            user_id: uid,
            company_id: companyId,
            obra_id: oc.obra_id,
            tipo: "oc_pendiente_autorizacion",
            titulo: `OC ${oc.folio} pendiente de autorizar`,
            mensaje: `Hay una OC esperando tu autorización${req?.folio ? ` (req. ${req.folio})` : ""}.`,
            link: `/app/supervisor/requisiciones`,
            requisicion_id: oc.requisicion_id,
            oc_id: oc.id,
          })),
        );
        if (notifErr) console.error("[notificaciones] insert failed", notifErr.message);
      }
    } catch (e: any) {
      console.error("[notificaciones] oc_pendiente error", e?.message);
    }

    await recalcEstatusRequisicion(supabase, oc.requisicion_id, userId);
    return { ok: true };
  });

export const reabrirOC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ocId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getCtx(supabase, userId);
    assertAdmin(roles);
    const { data: oc } = await supabase
      .from("ordenes_compra").select("id, requisicion_id, estatus").eq("id", data.ocId).maybeSingle();
    if (!oc) throw new Error("OC no encontrada");
    if (oc.estatus !== "rechazada") throw new Error("Solo se pueden reabrir OCs rechazadas");
    const { error } = await supabase
      .from("ordenes_compra")
      .update({ estatus: "borrador", enviada_supervisor_at: null })
      .eq("id", data.ocId);
    if (error) throw new Error(error.message);
    await recalcEstatusRequisicion(supabase, oc.requisicion_id, userId);
    return { ok: true };
  });

function assertSupervisor(roles: string[]) {
  if (!roles.includes("director") && !roles.includes("supervisor")) {
    throw new Error("Solo Director o Supervisor pueden autorizar OCs");
  }
}

export const autorizarOC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ocId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "requisiciones.aprobar");
    const { companyId } = await getCtx(supabase, userId);
    const { data: oc } = await supabase
      .from("ordenes_compra").select("id, folio, requisicion_id, obra_id, estatus").eq("id", data.ocId).maybeSingle();
    if (!oc) throw new Error("OC no encontrada");
    if (oc.estatus !== "pendiente_autorizacion") throw new Error("La OC no está pendiente de autorización");
    const { error } = await supabase
      .from("ordenes_compra")
      .update({ estatus: "autorizada", autorizada_at: new Date().toISOString(), autorizada_por: userId })
      .eq("id", data.ocId);
    if (error) throw new Error(error.message);

    // Notificar a administrativos de la empresa
    try {
      const { data: admins } = await supabase
        .from("user_roles").select("user_id").eq("company_id", companyId).in("role", ["administrativo", "director"]);
      const destinatarios = Array.from(new Set((admins ?? []).map((a: any) => a.user_id as string).filter((u) => u !== userId)));
      if (destinatarios.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: notifErr } = await supabaseAdmin.from("notificaciones").insert(
          destinatarios.map((uid) => ({
            user_id: uid,
            company_id: companyId,
            obra_id: oc.obra_id,
            tipo: "oc_autorizada",
            titulo: `OC ${oc.folio} autorizada`,
            mensaje: `La OC fue autorizada. Puedes enviarla al proveedor.`,
            link: `/app/admin/requisiciones`,
            requisicion_id: oc.requisicion_id,
            oc_id: oc.id,
          })),
        );
        if (notifErr) console.error("[notificaciones] insert failed", notifErr.message);
      }
    } catch (e: any) {
      console.error("[notificaciones] oc_autorizada error", e?.message);
    }

    await recalcEstatusRequisicion(supabase, oc.requisicion_id, userId);
    return { ok: true };
  });

export const rechazarOC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ocId: z.string().uuid(), motivo: z.string().trim().min(1).max(1000) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "requisiciones.rechazar");
    const { data: oc } = await supabase
      .from("ordenes_compra").select("id, requisicion_id, estatus").eq("id", data.ocId).maybeSingle();
    if (!oc) throw new Error("OC no encontrada");
    if (oc.estatus !== "pendiente_autorizacion") throw new Error("La OC no está pendiente de autorización");
    const { error } = await supabase
      .from("ordenes_compra")
      .update({
        estatus: "rechazada",
        rechazada_at: new Date().toISOString(),
        rechazada_por: userId,
        notas_supervisor: data.motivo,
      })
      .eq("id", data.ocId);
    if (error) throw new Error(error.message);
    await recalcEstatusRequisicion(supabase, oc.requisicion_id, userId);
    return { ok: true };
  });

export const listOCsRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requisicionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ocs, error } = await supabase
      .from("ordenes_compra")
      .select("id, paquete_id, folio, estatus, total, monto_pagado, estado_pago, pagada_at, enviada_supervisor_at, enviada_proveedor_at, autorizada_at, rechazada_at, notas_supervisor, created_at, proveedor:terceros(id, razon_social), paquete:cotizacion_paquetes(items:cotizacion_paquete_insumos(id, cantidad, precio_unitario, subtotal, insumo:insumos(id, nombre, unidad)))")
      .eq("requisicion_id", data.requisicionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ocs ?? [];
  });

export const enviarOCAProveedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ocId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getCtx(supabase, userId);
    assertAdmin(roles);

    const { data: oc } = await supabase
      .from("ordenes_compra")
      .select("id, folio, requisicion_id, obra_id, company_id, estatus, enviada_proveedor_at, proveedor:terceros(razon_social)")
      .eq("id", data.ocId).maybeSingle();
    if (!oc) throw new Error("OC no encontrada");
    if (oc.estatus !== "autorizada") throw new Error("Solo se pueden enviar al proveedor OCs autorizadas");
    if (oc.enviada_proveedor_at) throw new Error("La OC ya fue marcada como enviada al proveedor");

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("ordenes_compra")
      .update({
        estatus: "enviada",
        enviada_proveedor_at: nowIso,
        enviada_proveedor_por: userId,
      })
      .eq("id", data.ocId);
    if (error) throw new Error(error.message);

    // Datos para la notificación
    const { data: req } = await supabase
      .from("requisiciones").select("folio").eq("id", oc.requisicion_id).maybeSingle();
    const proveedorNombre = (oc as any).proveedor?.razon_social ?? "Proveedor";

    // Destinatarios: residentes asignados a la obra
    const { data: team } = await supabase
      .from("obra_team")
      .select("user_id, role")
      .eq("obra_id", oc.obra_id)
      .eq("role", "residente");
    const destinatarios = (team ?? []).map((t: any) => t.user_id as string);

    if (destinatarios.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const rows = destinatarios.map((uid) => ({
        user_id: uid,
        company_id: oc.company_id,
        obra_id: oc.obra_id,
        tipo: "oc_enviada_proveedor",
        titulo: `OC ${oc.folio} enviada al proveedor`,
        mensaje: `${proveedorNombre} fue notificado. Prepara la recepción del material${req?.folio ? ` (req. ${req.folio})` : ""}.`,
        link: `/app/obras/${oc.obra_id}/requisiciones`,
        requisicion_id: oc.requisicion_id,
        oc_id: oc.id,
      }));
      const { error: notifErr } = await supabaseAdmin.from("notificaciones").insert(rows);
      if (notifErr) console.error("[notificaciones] insert failed", notifErr.message);
    }

    await recalcEstatusRequisicion(supabase, oc.requisicion_id, userId);
    return { ok: true };
  });

