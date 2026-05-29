import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

async function recalcEstatusRequisicion(supabase: any, requisicionId: string) {
  const { data: paquetes } = await supabase
    .from("cotizacion_paquetes").select("id").eq("requisicion_id", requisicionId);
  const { data: ocs } = await supabase
    .from("ordenes_compra").select("estatus").eq("requisicion_id", requisicionId);

  const ocList = (ocs ?? []) as Array<{ estatus: string }>;
  let nuevo: string | null = null;
  if (ocList.length > 0) {
    if (ocList.every((o) => o.estatus === "pagada")) nuevo = "completada";
    else if (ocList.every((o) => o.estatus === "autorizada" || o.estatus === "pagada"))
      nuevo = "oc_generada";
    else if (ocList.some((o) => o.estatus === "pendiente_autorizacion"))
      nuevo = "pendiente_autorizacion";
    else if (ocList.some((o) => o.estatus === "borrador"))
      nuevo = "en_cotizacion";
  } else if ((paquetes ?? []).length > 0) {
    nuevo = "en_cotizacion";
  }
  if (!nuevo) return;
  const patch: any = { estatus: nuevo };
  if (nuevo === "en_cotizacion") patch.cotizacion_at = new Date().toISOString();
  if (nuevo === "pendiente_autorizacion") patch.autorizacion_at = new Date().toISOString();
  if (nuevo === "oc_generada") patch.oc_at = new Date().toISOString();
  if (nuevo === "completada") patch.completada_at = new Date().toISOString();
  await supabase.from("requisiciones").update(patch).eq("id", requisicionId);
}

export const getCotizacionRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requisicionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: req, error: reqErr } = await supabase
      .from("requisiciones")
      .select("id, folio, obra_id, company_id, estatus, notas, items:requisicion_insumos(id, cantidad, fecha_requerida, insumo:insumos(id, nombre, unidad))")
      .eq("id", data.requisicionId).maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Requisición no encontrada");

    const { data: paquetes } = await supabase
      .from("cotizacion_paquetes")
      .select("id, numero, proveedor_id, created_at, proveedor:terceros(id, razon_social), items:cotizacion_paquete_insumos(id, insumo_id, cantidad, precio_unitario, subtotal)")
      .eq("requisicion_id", data.requisicionId)
      .order("numero", { ascending: true });

    const { data: ocs } = await supabase
      .from("ordenes_compra")
      .select("id, paquete_id, folio, estatus, total, enviada_at, autorizada_at, rechazada_at, notas_supervisor, created_at, proveedor:terceros(id, razon_social)")
      .eq("requisicion_id", data.requisicionId)
      .order("created_at", { ascending: true });

    return { requisicion: req, paquetes: paquetes ?? [], ocs: ocs ?? [] };
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

    // Validar duplicados entre paquetes (ignora paquetes huérfanos sin items)
    const { data: existingPaquetes } = await supabase
      .from("cotizacion_paquetes")
      .select("id, items:cotizacion_paquete_insumos(insumo_id)")
      .eq("requisicion_id", data.requisicionId);
    const usados = new Set<string>();
    for (const p of existingPaquetes ?? []) {
      if (data.paqueteId && p.id === data.paqueteId) continue;
      const items = (p as any).items ?? [];
      if (items.length === 0) continue;
      for (const it of items) usados.add(it.insumo_id);
    }
    const conflictivos = data.insumos.filter((it) => usados.has(it.insumo_id));
    if (conflictivos.length > 0) {
      const { data: insumosInfo } = await supabase
        .from("insumos")
        .select("id, nombre")
        .in("id", conflictivos.map((c) => c.insumo_id));
      const nombres = (insumosInfo ?? []).map((i: any) => i.nombre).join(", ");
      throw new Error(
        `Estos insumos ya están en otro paquete de esta requisición: ${nombres || conflictivos.length + " insumo(s)"}. Quítalos del otro paquete primero.`
      );
    }

    let paqueteId = data.paqueteId ?? null;
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
        .from("ordenes_compra").select("id, estatus").eq("paquete_id", paqueteId).neq("estatus", "borrador").maybeSingle();
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

    await recalcEstatusRequisicion(supabase, data.requisicionId);
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
    await recalcEstatusRequisicion(supabase, paquete.requisicion_id);
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
      await recalcEstatusRequisicion(supabase, paquete.requisicion_id);
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
    await recalcEstatusRequisicion(supabase, paquete.requisicion_id);
    return { id: nueva.id };
  });

export const enviarOCASupervisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ocId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getCtx(supabase, userId);
    assertAdmin(roles);
    const { data: oc } = await supabase
      .from("ordenes_compra").select("id, requisicion_id, estatus").eq("id", data.ocId).maybeSingle();
    if (!oc) throw new Error("OC no encontrada");
    if (oc.estatus !== "borrador") throw new Error("La OC ya fue enviada");
    const { error } = await supabase
      .from("ordenes_compra")
      .update({ estatus: "pendiente_autorizacion", enviada_at: new Date().toISOString() })
      .eq("id", data.ocId);
    if (error) throw new Error(error.message);
    await recalcEstatusRequisicion(supabase, oc.requisicion_id);
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
      .update({ estatus: "borrador", enviada_at: null })
      .eq("id", data.ocId);
    if (error) throw new Error(error.message);
    await recalcEstatusRequisicion(supabase, oc.requisicion_id);
    return { ok: true };
  });

export const listOCsRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ requisicionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ocs, error } = await supabase
      .from("ordenes_compra")
      .select("id, paquete_id, folio, estatus, total, enviada_at, autorizada_at, rechazada_at, notas_supervisor, created_at, proveedor:terceros(id, razon_social), paquete:cotizacion_paquetes(items:cotizacion_paquete_insumos(id, cantidad, precio_unitario, subtotal, insumo:insumos(id, nombre, unidad)))")
      .eq("requisicion_id", data.requisicionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ocs ?? [];
  });
