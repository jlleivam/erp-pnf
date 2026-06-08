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

async function assertObraAccess(
  supabase: any,
  userId: string,
  obraId: string,
  companyId: string,
  roles: string[],
) {
  if (roles.includes("director") || roles.includes("administrativo")) return;
  const { data: member } = await supabase
    .from("obra_team").select("id").eq("obra_id", obraId).eq("user_id", userId).maybeSingle();
  if (!member) throw new Error("No tienes acceso al almacén de esta obra");
}

/** Devuelve el lunes (00:00) de la semana de la fecha dada, en YYYY-MM-DD. */
function lunesDeSemana(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = date.getUTCDay(); // 0=dom..6=sab
  const diff = (dow === 0 ? -6 : 1 - dow);
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function sabadoDeSemana(lunesIso: string): string {
  const d = new Date(lunesIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 5);
  return d.toISOString().slice(0, 10);
}

function siguienteLunes(lunesIso: string): string {
  const d = new Date(lunesIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** Encuentra o crea la semana abierta actual para una obra. */
async function getOrCreateSemanaAbierta(
  supabase: any,
  companyId: string,
  obraId: string,
): Promise<{ id: string; semana_inicio: string; semana_fin: string }> {
  // Busca cualquier semana abierta para la obra
  const { data: abierta } = await supabase
    .from("almacen_semanas")
    .select("id, semana_inicio, semana_fin")
    .eq("obra_id", obraId)
    .eq("estatus", "abierta")
    .order("semana_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (abierta) return abierta;

  // No hay abierta: crear una para la semana actual
  const lunes = lunesDeSemana(new Date());
  const sabado = sabadoDeSemana(lunes);
  const { data: nueva, error } = await supabase
    .from("almacen_semanas")
    .insert({
      company_id: companyId,
      obra_id: obraId,
      semana_inicio: lunes,
      semana_fin: sabado,
      estatus: "abierta",
    })
    .select("id, semana_inicio, semana_fin")
    .single();
  if (error) throw new Error(error.message);

  // Sembrar inv_inicial desde la última semana cerrada (si existe)
  const { data: prevCerrada } = await supabase
    .from("almacen_semanas")
    .select("id")
    .eq("obra_id", obraId)
    .eq("estatus", "cerrada")
    .lt("semana_inicio", nueva.semana_inicio)
    .order("semana_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevCerrada) {
    const { data: prevMov } = await supabase
      .from("almacen_movimientos_semana")
      .select("insumo_id, inv_inicial, recibido, utilizado, precio_unitario")
      .eq("semana_id", prevCerrada.id);
    // Trasladar un renglón por lote (insumo_id + precio_unitario) con saldo final ≠ 0
    const rows = (prevMov ?? [])
      .map((m: any) => {
        const final = Number(m.inv_inicial) + Number(m.recibido) - Number(m.utilizado);
        return {
          insumo_id: m.insumo_id,
          inv_inicial: final,
          precio_unitario: Number(m.precio_unitario),
        };
      })
      .filter((m: any) => Number(m.inv_inicial) !== 0);
    if (rows.length > 0) {
      await supabase.from("almacen_movimientos_semana").insert(
        rows.map((r: any) => ({
          semana_id: nueva.id,
          insumo_id: r.insumo_id,
          inv_inicial: r.inv_inicial,
          recibido: 0,
          utilizado: 0,
          precio_unitario: r.precio_unitario,
        })),
      );
    }
  }
  return nueva;
}

/** Lista OCs de la obra pendientes de recibir total o parcialmente. */
export const listOCsPorRecibir = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ocs, error } = await supabase
      .from("ordenes_compra")
      .select(
        "id, folio, estatus, total, enviada_proveedor_at, proveedor:terceros(razon_social), requisicion:requisiciones(folio)",
      )
      .eq("obra_id", data.obraId)
      .in("estatus", ["enviada", "recibida_parcial"])
      .order("enviada_proveedor_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ocs ?? [];
  });

/** Obtiene una OC con partidas + cantidades ya recibidas por insumo. */
export const getOCParaRecepcion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ocId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: oc, error } = await supabase
      .from("ordenes_compra")
      .select(
        "id, folio, estatus, obra_id, company_id, proveedor:terceros(id, razon_social), paquete:cotizacion_paquetes(items:cotizacion_paquete_insumos(id, cantidad, precio_unitario, insumo:insumos(id, nombre, unidad)))",
      )
      .eq("id", data.ocId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!oc) throw new Error("OC no encontrada");

    const { data: recepciones } = await supabase
      .from("almacen_recepciones")
      .select("id, partidas:almacen_recepcion_partidas(insumo_id, cantidad)")
      .eq("oc_id", data.ocId);
    const recibidoPorInsumo: Record<string, number> = {};
    for (const r of (recepciones ?? []) as any[]) {
      for (const p of (r.partidas ?? []) as any[]) {
        recibidoPorInsumo[p.insumo_id] = (recibidoPorInsumo[p.insumo_id] ?? 0) + Number(p.cantidad);
      }
    }
    return { oc, recibidoPorInsumo };
  });

const PartidaInput = z.object({
  insumo_id: z.string().uuid(),
  cantidad: z.number().positive(),
  precio_unitario: z.number().min(0),
});

/** Registra una recepción de OC + actualiza movimientos de la semana abierta + recalcula estatus de OC. */
export const registrarRecepcion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ocId: z.string().uuid(),
      folioRemision: z.string().trim().max(100).optional().nullable(),
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      notas: z.string().trim().max(500).optional().nullable(),
      partidas: z.array(PartidaInput).min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);

    const { data: oc } = await supabase
      .from("ordenes_compra")
      .select("id, obra_id, company_id, estatus, requisicion_id, folio, paquete:cotizacion_paquetes(items:cotizacion_paquete_insumos(insumo_id, cantidad))")
      .eq("id", data.ocId).maybeSingle();
    if (!oc) throw new Error("OC no encontrada");
    if (oc.company_id !== companyId) throw new Error("OC no válida");
    if (!["enviada", "recibida_parcial"].includes(oc.estatus)) {
      throw new Error("La OC no está disponible para recepción");
    }
    await assertObraAccess(supabase, userId, oc.obra_id, companyId, roles);

    const semana = await getOrCreateSemanaAbierta(supabase, companyId, oc.obra_id);

    // Insertar cabecera
    const { data: rec, error: recErr } = await supabase
      .from("almacen_recepciones")
      .insert({
        company_id: companyId,
        obra_id: oc.obra_id,
        oc_id: oc.id,
        folio_remision: data.folioRemision ?? null,
        fecha: data.fecha,
        recibido_por: userId,
        notas: data.notas ?? null,
      })
      .select("id").single();
    if (recErr) throw new Error(recErr.message);

    // Partidas
    const partidasRows = data.partidas.map((p) => ({
      recepcion_id: rec.id,
      insumo_id: p.insumo_id,
      cantidad: p.cantidad,
      precio_unitario: p.precio_unitario,
    }));
    const { error: partidasErr } = await supabase
      .from("almacen_recepcion_partidas").insert(partidasRows);
    if (partidasErr) throw new Error(partidasErr.message);

    // Actualizar movimientos de la semana abierta — un renglón por (insumo, precio)
    for (const p of data.partidas) {
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
          .update({
            recibido: Number(existente.recibido) + p.cantidad,
          })
          .eq("id", existente.id);
      } else {
        await supabase.from("almacen_movimientos_semana").insert({
          semana_id: semana.id,
          insumo_id: p.insumo_id,
          inv_inicial: 0,
          recibido: p.cantidad,
          utilizado: 0,
          precio_unitario: p.precio_unitario,
        });
      }
    }

    // Recalcular estatus OC: comparar total recibido vs total pedido por insumo
    const pedidoPorInsumo: Record<string, number> = {};
    for (const it of ((oc as any).paquete?.items ?? []) as any[]) {
      pedidoPorInsumo[it.insumo_id] = (pedidoPorInsumo[it.insumo_id] ?? 0) + Number(it.cantidad);
    }
    const { data: todasRec } = await supabase
      .from("almacen_recepciones")
      .select("partidas:almacen_recepcion_partidas(insumo_id, cantidad)")
      .eq("oc_id", oc.id);
    const recibidoPorInsumo: Record<string, number> = {};
    for (const r of (todasRec ?? []) as any[]) {
      for (const part of (r.partidas ?? []) as any[]) {
        recibidoPorInsumo[part.insumo_id] =
          (recibidoPorInsumo[part.insumo_id] ?? 0) + Number(part.cantidad);
      }
    }
    let completa = true;
    for (const [insumoId, pedido] of Object.entries(pedidoPorInsumo)) {
      if ((recibidoPorInsumo[insumoId] ?? 0) + 1e-6 < pedido) {
        completa = false; break;
      }
    }
    const nuevoEstatus = completa ? "recibida" : "recibida_parcial";
    await supabase.from("ordenes_compra")
      .update({ estatus: nuevoEstatus })
      .eq("id", oc.id);

    // Notificar a administrativos y supervisores en cada recepción
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("company_id", companyId)
        .in("role", ["administrativo", "supervisor", "director"]);
      const destinatarios = Array.from(
        new Set((roles ?? []).map((r: any) => r.user_id as string).filter((u) => u !== userId))
      );
      if (destinatarios.length > 0) {
        const titulo = completa
          ? `OC ${oc.folio} recibida completa`
          : `OC ${oc.folio} con recepción parcial`;
        const mensaje = completa
          ? `El material de la OC ${oc.folio} fue recibido en su totalidad en el almacén de la obra.`
          : `Se registró una recepción parcial de la OC ${oc.folio} en el almacén de la obra.`;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: notifErr } = await supabaseAdmin.from("notificaciones").insert(
          destinatarios.map((uid) => ({
            user_id: uid,
            company_id: companyId,
            obra_id: oc.obra_id,
            tipo: completa ? "oc_recibida" : "oc_recibida_parcial",
            titulo,
            mensaje,
            link: `/app/obras/${oc.obra_id}/almacen-obra`,
            requisicion_id: oc.requisicion_id,
            oc_id: oc.id,
          })),
        );
        if (notifErr) console.error("[notificaciones] insert failed", notifErr.message);
      }
    } catch (e: any) {
      console.error("[notificaciones] recepcion error", e?.message);
    }


    // Recalcular estatus requisición (puede pasar a completada)
    const { data: paquetes } = await supabase
      .from("cotizacion_paquetes").select("id").eq("requisicion_id", oc.requisicion_id);
    const { data: ocs } = await supabase
      .from("ordenes_compra").select("estatus").eq("requisicion_id", oc.requisicion_id);
    const ocList = (ocs ?? []) as Array<{ estatus: string }>;
    if (ocList.length > 0 && (paquetes ?? []).length > 0) {
      if (ocList.every((o) => o.estatus === "recibida" || o.estatus === "pagada")) {
        await supabase.from("requisiciones")
          .update({ estatus: "completada", completada_at: new Date().toISOString() })
          .eq("id", oc.requisicion_id);
      }
    }

    return { ok: true, recepcionId: rec.id, ocEstatus: nuevoEstatus };
  });

/** Devuelve la semana abierta de la obra con sus movimientos enriquecidos. */
export const getSemanaActual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    await assertObraAccess(supabase, userId, data.obraId, companyId, roles);

    const semana = await getOrCreateSemanaAbierta(supabase, companyId, data.obraId);

    const { data: movs, error } = await supabase
      .from("almacen_movimientos_semana")
      .select("id, insumo_id, inv_inicial, recibido, utilizado, precio_unitario, insumo:insumos(id, nombre, unidad)")
      .eq("semana_id", semana.id);
    if (error) throw new Error(error.message);

    // Proveedor más reciente por insumo (de la última partida recibida en esta obra)
    const insumoIds = (movs ?? []).map((m: any) => m.insumo_id);
    const proveedorPorInsumo: Record<string, string> = {};
    if (insumoIds.length > 0) {
      const { data: ultimasParts } = await supabase
        .from("almacen_recepcion_partidas")
        .select("insumo_id, recepcion:almacen_recepciones!inner(obra_id, fecha, oc:ordenes_compra(proveedor:terceros(razon_social)))")
        .in("insumo_id", insumoIds)
        .eq("recepcion.obra_id", data.obraId)
        .order("created_at", { ascending: false });
      for (const p of (ultimasParts ?? []) as any[]) {
        if (!proveedorPorInsumo[p.insumo_id]) {
          proveedorPorInsumo[p.insumo_id] = p.recepcion?.oc?.proveedor?.razon_social ?? "";
        }
      }
    }

    const items = (movs ?? []).map((m: any) => ({
      ...m,
      proveedor: proveedorPorInsumo[m.insumo_id] ?? "",
    }));
    items.sort((a: any, b: any) => {
      const byName = (a.insumo?.nombre ?? "").localeCompare(b.insumo?.nombre ?? "");
      if (byName !== 0) return byName;
      return Number(a.precio_unitario) - Number(b.precio_unitario);
    });

    return { semana, items };
  });

/** Actualiza el material utilizado de un movimiento (solo si la semana está abierta). */
export const actualizarUtilizado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ movimientoId: z.string().uuid(), utilizado: z.number().min(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);

    const { data: mov } = await supabase
      .from("almacen_movimientos_semana")
      .select("id, semana:almacen_semanas(id, obra_id, company_id, estatus)")
      .eq("id", data.movimientoId).maybeSingle();
    if (!mov) throw new Error("Movimiento no encontrado");
    const s = (mov as any).semana;
    if (!s || s.company_id !== companyId) throw new Error("Movimiento no válido");
    if (s.estatus !== "abierta") throw new Error("La semana ya está cerrada");
    await assertObraAccess(supabase, userId, s.obra_id, companyId, roles);

    const { error } = await supabase
      .from("almacen_movimientos_semana")
      .update({ utilizado: data.utilizado })
      .eq("id", data.movimientoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Cierra la semana abierta: marca cerrada, crea siguiente, traslada saldos. */
export const cerrarSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ semanaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);

    const { data: sem } = await supabase
      .from("almacen_semanas")
      .select("id, obra_id, company_id, semana_inicio, semana_fin, estatus")
      .eq("id", data.semanaId).maybeSingle();
    if (!sem) throw new Error("Semana no encontrada");
    if (sem.company_id !== companyId) throw new Error("Semana no válida");
    if (sem.estatus !== "abierta") throw new Error("La semana ya estaba cerrada");
    await assertObraAccess(supabase, userId, sem.obra_id, companyId, roles);

    // Marcar como cerrada
    const { error: closeErr } = await supabase
      .from("almacen_semanas")
      .update({
        estatus: "cerrada",
        cerrada_at: new Date().toISOString(),
        cerrada_por: userId,
      })
      .eq("id", sem.id);
    if (closeErr) throw new Error(closeErr.message);

    // Crear siguiente semana (o reutilizar si ya existía)
    const nextLunes = siguienteLunes(sem.semana_inicio);
    const nextSabado = sabadoDeSemana(nextLunes);
    let nextSemanaId: string;
    const { data: existSig } = await supabase
      .from("almacen_semanas")
      .select("id")
      .eq("obra_id", sem.obra_id)
      .eq("semana_inicio", nextLunes)
      .maybeSingle();
    if (existSig) {
      nextSemanaId = existSig.id;
    } else {
      const { data: nueva, error: nuevaErr } = await supabase
        .from("almacen_semanas")
        .insert({
          company_id: companyId,
          obra_id: sem.obra_id,
          semana_inicio: nextLunes,
          semana_fin: nextSabado,
          estatus: "abierta",
        })
        .select("id").single();
      if (nuevaErr) throw new Error(nuevaErr.message);
      nextSemanaId = nueva.id;
    }

    // Trasladar saldos
    const { data: movs } = await supabase
      .from("almacen_movimientos_semana")
      .select("insumo_id, inv_inicial, recibido, utilizado, precio_unitario")
      .eq("semana_id", sem.id);
    const traslados = ((movs ?? []) as any[])
      .map((m) => {
        const final = Number(m.inv_inicial) + Number(m.recibido) - Number(m.utilizado);
        return { insumo_id: m.insumo_id, inv_inicial: final, precio_unitario: m.precio_unitario };
      })
      .filter((m) => Number(m.inv_inicial) !== 0);

    for (const t of traslados) {
      const { data: existe } = await supabase
        .from("almacen_movimientos_semana")
        .select("id, inv_inicial")
        .eq("semana_id", nextSemanaId)
        .eq("insumo_id", t.insumo_id)
        .maybeSingle();
      if (existe) {
        await supabase
          .from("almacen_movimientos_semana")
          .update({ inv_inicial: Number(existe.inv_inicial) + t.inv_inicial })
          .eq("id", existe.id);
      } else {
        await supabase.from("almacen_movimientos_semana").insert({
          semana_id: nextSemanaId,
          insumo_id: t.insumo_id,
          inv_inicial: t.inv_inicial,
          recibido: 0,
          utilizado: 0,
          precio_unitario: t.precio_unitario,
        });
      }
    }
    return { ok: true, siguienteSemanaId: nextSemanaId };
  });

/** Historial de semanas cerradas. */
export const listHistorialSemanas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("almacen_semanas")
      .select("id, semana_inicio, semana_fin, estatus, cerrada_at")
      .eq("obra_id", data.obraId)
      .eq("estatus", "cerrada")
      .order("semana_inicio", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Detalle de una semana (apta para vista de solo lectura). */
export const getSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ semanaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sem, error } = await supabase
      .from("almacen_semanas")
      .select("id, obra_id, semana_inicio, semana_fin, estatus, cerrada_at")
      .eq("id", data.semanaId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!sem) throw new Error("Semana no encontrada");
    const { data: movs } = await supabase
      .from("almacen_movimientos_semana")
      .select("id, insumo_id, inv_inicial, recibido, utilizado, precio_unitario, insumo:insumos(id, nombre, unidad)")
      .eq("semana_id", data.semanaId);
    const items = (movs ?? []).slice().sort((a: any, b: any) =>
      (a.insumo?.nombre ?? "").localeCompare(b.insumo?.nombre ?? ""),
    );
    return { semana: sem, items };
  });
