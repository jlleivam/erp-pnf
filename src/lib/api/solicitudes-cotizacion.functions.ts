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


async function recalcEstatusRequisicion(supabase: any, requisicionId: string, userId?: string) {
  // Reusar regla: si hay SC y aún no hay paquetes/OCs, requisición → en_cotizacion
  const { data: req } = await supabase
    .from("requisiciones").select("estatus").eq("id", requisicionId).maybeSingle();
  if (!req) return;
  if (req.estatus !== "enviada") return; // solo avanza desde enviada
  const { count } = await supabase
    .from("cotizacion_solicitudes")
    .select("id", { count: "exact", head: true })
    .eq("requisicion_id", requisicionId);
  if ((count ?? 0) > 0) {
    const patch: any = { estatus: "en_cotizacion", cotizacion_at: new Date().toISOString() };
    if (userId) patch.cotizacion_por = userId;
    await supabase.from("requisiciones").update(patch).eq("id", requisicionId);
  }
}

const ItemInput = z.object({
  insumo_id: z.string().uuid(),
  cantidad: z.number().positive(),
});

const RespuestaInput = z.object({
  insumo_id: z.string().uuid(),
  cantidad: z.number().positive().optional(),
  precio_unitario: z.number().min(0),
  disponible: z.boolean(),
  nota: z.string().max(500).optional().nullable(),
});

export const getSolicitudesRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requisicionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: solicitudes, error } = await supabase
      .from("cotizacion_solicitudes")
      .select(`
        id, folio, estatus, proveedor_id, enviada_at, recibida_at, notas, created_at,
        proveedor:terceros(id, razon_social, contacto_nombre, correo, telefono),
        items:cotizacion_solicitud_insumos(id, insumo_id, cantidad, precio_unitario, disponible, nota, subtotal, insumo:insumos(nombre, unidad))
      `)
      .eq("requisicion_id", data.requisicionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return solicitudes ?? [];
  });

export const crearSolicitud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      requisicionId: z.string().uuid(),
      proveedorId: z.string().uuid(),
      insumos: z.array(ItemInput).min(1),
      notas: z.string().max(1000).optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "cotizaciones.gestionar");
    const { companyId } = await getCtx(supabase, userId);

    const { data: req } = await supabase
      .from("requisiciones").select("id, company_id").eq("id", data.requisicionId).maybeSingle();
    if (!req || req.company_id !== companyId) throw new Error("Requisición no válida");

    const { data: folioRow, error: folioErr } = await supabase
      .rpc("siguiente_folio_sc", { _company_id: companyId });
    if (folioErr) throw new Error(folioErr.message);

    const { data: nueva, error: insErr } = await supabase
      .from("cotizacion_solicitudes")
      .insert({
        requisicion_id: data.requisicionId,
        company_id: companyId,
        proveedor_id: data.proveedorId,
        folio: folioRow,
        creado_por: userId,
        notas: data.notas ?? null,
      })
      .select("id").single();
    if (insErr) throw new Error(insErr.message);

    const rows = data.insumos.map((i) => ({
      solicitud_id: nueva.id,
      insumo_id: i.insumo_id,
      cantidad: i.cantidad,
    }));
    const { error: itemsErr } = await supabase
      .from("cotizacion_solicitud_insumos").insert(rows);
    if (itemsErr) throw new Error(itemsErr.message);

    await recalcEstatusRequisicion(supabase, data.requisicionId, userId);
    return { id: nueva.id, folio: folioRow };
  });

export const actualizarSolicitud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      solicitudId: z.string().uuid(),
      proveedorId: z.string().uuid().optional(),
      insumos: z.array(ItemInput).optional(),
      notas: z.string().max(1000).optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "cotizaciones.gestionar");

    const { data: sc } = await supabase
      .from("cotizacion_solicitudes").select("id, estatus").eq("id", data.solicitudId).maybeSingle();
    if (!sc) throw new Error("Solicitud no encontrada");
    if (sc.estatus !== "borrador") throw new Error("Solo solicitudes en borrador pueden editarse");

    const patch: any = {};
    if (data.proveedorId) patch.proveedor_id = data.proveedorId;
    if (data.notas !== undefined) patch.notas = data.notas;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("cotizacion_solicitudes").update(patch).eq("id", data.solicitudId);
      if (error) throw new Error(error.message);
    }
    if (data.insumos) {
      await supabase.from("cotizacion_solicitud_insumos").delete().eq("solicitud_id", data.solicitudId);
      const rows = data.insumos.map((i) => ({
        solicitud_id: data.solicitudId,
        insumo_id: i.insumo_id,
        cantidad: i.cantidad,
      }));
      const { error } = await supabase
        .from("cotizacion_solicitud_insumos").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const eliminarSolicitud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ solicitudId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "cotizaciones.gestionar");
    const { data: sc } = await supabase
      .from("cotizacion_solicitudes").select("id, estatus, requisicion_id").eq("id", data.solicitudId).maybeSingle();
    if (!sc) throw new Error("Solicitud no encontrada");
    if (sc.estatus !== "borrador" && sc.estatus !== "descartada") {
      throw new Error("Solo se pueden eliminar solicitudes en borrador o descartadas");
    }
    const { error } = await supabase
      .from("cotizacion_solicitudes").delete().eq("id", data.solicitudId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarSCEnviada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ solicitudId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "cotizaciones.gestionar");
    const { data: sc } = await supabase
      .from("cotizacion_solicitudes").select("id, estatus").eq("id", data.solicitudId).maybeSingle();
    if (!sc) throw new Error("Solicitud no encontrada");
    if (sc.estatus !== "borrador") throw new Error("Solo borradores pueden enviarse");
    const { error } = await supabase
      .from("cotizacion_solicitudes")
      .update({ estatus: "enviada", enviada_at: new Date().toISOString() })
      .eq("id", data.solicitudId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const capturarRespuesta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      solicitudId: z.string().uuid(),
      items: z.array(RespuestaInput).min(1),
      notas: z.string().nullable().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "cotizaciones.gestionar");
    const { data: sc } = await supabase
      .from("cotizacion_solicitudes").select("id, estatus").eq("id", data.solicitudId).maybeSingle();
    if (!sc) throw new Error("Solicitud no encontrada");
    if (sc.estatus === "descartada") throw new Error("La solicitud está descartada");

    for (const it of data.items) {
      const patch: any = {
        precio_unitario: it.precio_unitario,
        disponible: it.disponible,
        nota: it.nota ?? null,
      };
      if (it.cantidad !== undefined) patch.cantidad = it.cantidad;
      const { error } = await supabase
        .from("cotizacion_solicitud_insumos")
        .update(patch)
        .eq("solicitud_id", data.solicitudId)
        .eq("insumo_id", it.insumo_id);
      if (error) throw new Error(error.message);
    }

    const scPatch: any = { estatus: "recibida", recibida_at: new Date().toISOString() };
    if (data.notas !== undefined) scPatch.notas = data.notas;
    const { error: updErr } = await supabase
      .from("cotizacion_solicitudes")
      .update(scPatch)
      .eq("id", data.solicitudId);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

export const descartarSolicitud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ solicitudId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "cotizaciones.gestionar");
    const { error } = await supabase
      .from("cotizacion_solicitudes")
      .update({ estatus: "descartada" })
      .eq("id", data.solicitudId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDatosPDF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ solicitudId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);

    const { data: sc, error: scErr } = await supabase
      .from("cotizacion_solicitudes")
      .select(`
        id, folio, notas, created_at, requisicion_id, company_id,
        proveedor:terceros(razon_social, rfc, contacto_nombre, correo, telefono, direccion_fiscal),
        items:cotizacion_solicitud_insumos(insumo_id, cantidad, insumo:insumos(nombre, unidad))
      `)
      .eq("id", data.solicitudId).maybeSingle();
    if (scErr) throw new Error(`SC query: ${scErr.message}`);
    if (!sc) throw new Error("Solicitud no encontrada");
    if (sc.company_id !== companyId) throw new Error("Solicitud de otra empresa");

    const { data: company } = await supabase
      .from("companies").select("razon_social, rfc, datos_facturacion").eq("id", companyId).maybeSingle();

    const { data: req } = await supabase
      .from("requisiciones")
      .select("folio, obra:obras(id, nombre, ubicacion)")
      .eq("id", sc.requisicion_id).maybeSingle();

    const { data: reqItems } = await supabase
      .from("requisicion_insumos")
      .select("insumo_id, fecha_requerida")
      .eq("requisicion_id", sc.requisicion_id);
    const fechaMap = new Map<string, string>(
      (reqItems ?? []).map((r: any) => [r.insumo_id, r.fecha_requerida])
    );
    (sc as any).items = ((sc as any).items ?? []).map((it: any) => ({
      ...it,
      fecha_requerida: fechaMap.get(it.insumo_id) ?? null,
    }));

    let residente: any = null;
    const obraId = (req as any)?.obra?.id;
    if (obraId) {
      const { data: r } = await supabase
        .from("obra_team")
        .select("user_id, profile:profiles(nombre_completo, email)")
        .eq("obra_id", obraId)
        .eq("role", "residente")
        .maybeSingle();
      residente = r;
    }

    const { data: profile } = await supabase
      .from("profiles").select("nombre_completo, email").eq("id", userId).maybeSingle();

    return { sc, company, requisicion: req, solicitante: profile, residente };
  });
