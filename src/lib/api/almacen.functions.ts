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

/** Devuelve el domingo (fin de semana lun–dom) del lunes dado, en YYYY-MM-DD. */
function sabadoDeSemana(lunesIso: string): string {
  const d = new Date(lunesIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function siguienteLunes(lunesIso: string): string {
  const d = new Date(lunesIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** Traslada saldos finales (inv_inicial + recibido − utilizado) de una semana a otra. */
async function trasladarSaldos(
  supabase: any,
  semanaOrigenId: string,
  semanaDestinoId: string,
) {
  const { data: movs } = await supabase
    .from("almacen_movimientos_semana")
    .select("insumo_id, inv_inicial, recibido, utilizado, precio_unitario")
    .eq("semana_id", semanaOrigenId);
  const traslados = ((movs ?? []) as any[])
    .map((m) => {
      const final = Number(m.inv_inicial) + Number(m.recibido) - Number(m.utilizado);
      return { insumo_id: m.insumo_id, inv_inicial: final, precio_unitario: Number(m.precio_unitario) };
    })
    .filter((m) => Number(m.inv_inicial) !== 0);
  for (const t of traslados) {
    const { data: existe } = await supabase
      .from("almacen_movimientos_semana")
      .select("id, inv_inicial")
      .eq("semana_id", semanaDestinoId)
      .eq("insumo_id", t.insumo_id)
      .eq("precio_unitario", t.precio_unitario)
      .maybeSingle();
    if (existe) {
      await supabase
        .from("almacen_movimientos_semana")
        .update({ inv_inicial: Number(existe.inv_inicial) + t.inv_inicial })
        .eq("id", existe.id);
    } else {
      await supabase.from("almacen_movimientos_semana").insert({
        semana_id: semanaDestinoId,
        insumo_id: t.insumo_id,
        inv_inicial: t.inv_inicial,
        recibido: 0,
        utilizado: 0,
        precio_unitario: t.precio_unitario,
      });
    }
  }
}

/** Cierra todas las semanas abiertas vencidas y elimina semanas futuras fantasma sin movimientos. */
async function autoCerrarSemanasVencidas(
  supabase: any,
  _companyId: string,
  obraId: string,
) {
  const hoy = new Date().toISOString().slice(0, 10);

  // 1. Cerrar (definitivamente) semanas abiertas/bloqueadas con fin < hoy
  await supabase
    .from("almacen_semanas")
    .update({ estatus: "cerrada", cerrada_at: new Date().toISOString(), cerrada_por: null })
    .eq("obra_id", obraId)
    .in("estatus", ["abierta", "bloqueada"])
    .lt("semana_fin", hoy);

  // 2. Eliminar semanas abiertas futuras sin movimientos (fantasma)
  const { data: futuras } = await supabase
    .from("almacen_semanas")
    .select("id")
    .eq("obra_id", obraId)
    .eq("estatus", "abierta")
    .gt("semana_inicio", hoy);
  for (const f of (futuras ?? []) as Array<{ id: string }>) {
    const { count } = await supabase
      .from("almacen_movimientos_semana")
      .select("id", { count: "exact", head: true })
      .eq("semana_id", f.id);
    if (!count || count === 0) {
      await supabase.from("almacen_semanas").delete().eq("id", f.id);
    }
  }
}


/** Encuentra o crea la semana (abierta o bloqueada) que contiene a hoy. */
async function getOrCreateSemanaAbierta(
  supabase: any,
  companyId: string,
  obraId: string,
): Promise<{ id: string; semana_inicio: string; semana_fin: string; estatus: string }> {
  await autoCerrarSemanasVencidas(supabase, companyId, obraId);

  const hoy = new Date().toISOString().slice(0, 10);

  // Buscar la semana (abierta o bloqueada) cuyo rango contenga hoy
  const { data: actual } = await supabase
    .from("almacen_semanas")
    .select("id, semana_inicio, semana_fin, estatus")
    .eq("obra_id", obraId)
    .in("estatus", ["abierta", "bloqueada"])
    .lte("semana_inicio", hoy)
    .gte("semana_fin", hoy)
    .maybeSingle();
  if (actual) return actual;

  // No hay semana actual: crear con lunes/domingo de hoy
  const lunes = lunesDeSemana(new Date());
  const sabado = sabadoDeSemana(lunes);

  const { data: existente } = await supabase
    .from("almacen_semanas")
    .select("id, semana_inicio, semana_fin, estatus")
    .eq("obra_id", obraId)
    .eq("semana_inicio", lunes)
    .maybeSingle();

  let nueva: { id: string; semana_inicio: string; semana_fin: string; estatus: string };
  let yaTeniaMovimientos = false;

  if (existente) {
    const { count } = await supabase
      .from("almacen_movimientos_semana")
      .select("id", { count: "exact", head: true })
      .eq("semana_id", existente.id);
    yaTeniaMovimientos = (count ?? 0) > 0;

    const { data: reabierta, error: updErr } = await supabase
      .from("almacen_semanas")
      .update({
        estatus: "abierta",
        semana_fin: sabado,
        cerrada_at: null,
        cerrada_por: null,
      })
      .eq("id", existente.id)
      .select("id, semana_inicio, semana_fin, estatus")
      .single();
    if (updErr) throw new Error(updErr.message);
    nueva = reabierta;
  } else {
    const { data: insertada, error } = await supabase
      .from("almacen_semanas")
      .insert({
        company_id: companyId,
        obra_id: obraId,
        semana_inicio: lunes,
        semana_fin: sabado,
        estatus: "abierta",
      })
      .select("id, semana_inicio, semana_fin, estatus")
      .single();
    if (error) throw new Error(error.message);
    nueva = insertada;
  }

  if (yaTeniaMovimientos) return nueva;

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
    if (!roles.includes("director")) {
      const { data: member } = await supabase
        .from("obra_team").select("id")
        .eq("obra_id", oc.obra_id).eq("user_id", userId).eq("role", "residente").maybeSingle();
      if (!member) {
        throw new Error("Solo el director o el residente de la obra pueden registrar recepciones");
      }
    }

    const semana = await getOrCreateSemanaAbierta(supabase, companyId, oc.obra_id);
    if (semana.estatus !== "abierta") {
      throw new Error("La semana está bloqueada. Solicita al supervisor que la desbloquee para registrar recepciones.");
    }


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
          .update({ estatus: "completada", completada_at: new Date().toISOString(), completada_por: userId })
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
    if (s.estatus !== "abierta") throw new Error("La semana está bloqueada o cerrada");
    await assertObraAccess(supabase, userId, s.obra_id, companyId, roles);

    const { error } = await supabase
      .from("almacen_movimientos_semana")
      .update({ utilizado: data.utilizado })
      .eq("id", data.movimientoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertPuedeEditarAlmacen(
  supabase: any,
  userId: string,
  obraId: string,
  roles: string[],
) {
  if (roles.includes("director")) return;
  const { data: member } = await supabase
    .from("obra_team").select("role")
    .eq("obra_id", obraId).eq("user_id", userId).maybeSingle();
  if (!member || !["residente", "supervisor"].includes(member.role)) {
    throw new Error("Solo residente, supervisor o director pueden modificar el almacén");
  }
}


/** Bloquea la semana actual (no editable hasta que el supervisor la desbloquee). */
export const bloquearSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ semanaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);

    const { data: sem } = await supabase
      .from("almacen_semanas")
      .select("id, obra_id, company_id, semana_inicio, semana_fin, estatus")
      .eq("id", data.semanaId).maybeSingle();
    if (!sem) throw new Error("Semana no encontrada");
    if (sem.company_id !== companyId) throw new Error("Semana no válida");
    if (sem.estatus !== "abierta") throw new Error("La semana no está abierta");
    const hoy = new Date().toISOString().slice(0, 10);
    if (sem.semana_inicio > hoy || sem.semana_fin < hoy) {
      throw new Error("Solo puedes bloquear la semana actual");
    }
    await assertPuedeEditarAlmacen(supabase, userId, sem.obra_id, roles);

    const { error } = await supabase
      .from("almacen_semanas")
      .update({ estatus: "bloqueada" })
      .eq("id", sem.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Solicita al supervisor/director que desbloquee la semana. */
export const solicitarDesbloqueoSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      semanaId: z.string().uuid(),
      motivo: z.string().trim().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);

    const { data: sem } = await supabase
      .from("almacen_semanas")
      .select("id, obra_id, company_id, estatus")
      .eq("id", data.semanaId).maybeSingle();
    if (!sem) throw new Error("Semana no encontrada");
    if (sem.company_id !== companyId) throw new Error("Semana no válida");
    if (sem.estatus !== "bloqueada") throw new Error("Solo se pueden desbloquear semanas bloqueadas");
    await assertPuedeEditarAlmacen(supabase, userId, sem.obra_id, roles);

    // No permitir solicitudes duplicadas pendientes
    const { data: pendiente } = await supabase
      .from("almacen_semana_desbloqueo_solicitudes")
      .select("id")
      .eq("semana_id", sem.id)
      .eq("estatus", "pendiente")
      .maybeSingle();
    if (pendiente) throw new Error("Ya hay una solicitud pendiente para esta semana");

    const { data: sol, error } = await supabase
      .from("almacen_semana_desbloqueo_solicitudes")
      .insert({
        company_id: companyId,
        obra_id: sem.obra_id,
        semana_id: sem.id,
        solicitado_por: userId,
        motivo: data.motivo,
        estatus: "pendiente",
      })
      .select("id").single();
    if (error) throw new Error(error.message);

    // Notificar a supervisor de la obra + directores
    try {
      const { data: superv } = await supabase
        .from("obra_team")
        .select("user_id")
        .eq("obra_id", sem.obra_id)
        .eq("role", "supervisor");
      const { data: directores } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", companyId)
        .eq("role", "director");
      const destinatarios = Array.from(new Set([
        ...((superv ?? []) as any[]).map((r) => r.user_id),
        ...((directores ?? []) as any[]).map((r) => r.user_id),
      ].filter((u) => u && u !== userId)));
      if (destinatarios.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("notificaciones").insert(
          destinatarios.map((uid) => ({
            user_id: uid,
            company_id: companyId,
            obra_id: sem.obra_id,
            tipo: "almacen_desbloqueo_solicitado",
            titulo: "Solicitud de desbloqueo de semana",
            mensaje: `Se solicitó desbloquear una semana del almacén. Motivo: ${data.motivo}`,
            link: `/app/obras/${sem.obra_id}/almacen-obra`,
          })),
        );
      }
    } catch (e: any) {
      console.error("[notificaciones] desbloqueo solicitud", e?.message);
    }

    return { ok: true, solicitudId: sol.id };
  });

/** Lista solicitudes de desbloqueo de una obra (opcionalmente filtradas por estatus). */
export const listSolicitudesDesbloqueo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      estatus: z.enum(["pendiente", "aprobada", "rechazada"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("almacen_semana_desbloqueo_solicitudes")
      .select("id, semana_id, motivo, estatus, respuesta, solicitado_por, resuelto_por, resuelto_at, created_at, semana:almacen_semanas(semana_inicio, semana_fin), solicitante:profiles!almacen_semana_desbloqueo_solicitudes_solicitado_por_fkey(nombre_completo, email)")
      .eq("obra_id", data.obraId)
      .order("created_at", { ascending: false });
    if (data.estatus) q = q.eq("estatus", data.estatus);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Aprueba o rechaza una solicitud de desbloqueo. */
export const resolverSolicitudDesbloqueo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      solicitudId: z.string().uuid(),
      accion: z.enum(["aprobar", "rechazar"]),
      respuesta: z.string().trim().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);

    const { data: sol } = await supabase
      .from("almacen_semana_desbloqueo_solicitudes")
      .select("id, semana_id, obra_id, company_id, estatus, solicitado_por")
      .eq("id", data.solicitudId).maybeSingle();
    if (!sol) throw new Error("Solicitud no encontrada");
    if (sol.company_id !== companyId) throw new Error("Solicitud no válida");
    if (sol.estatus !== "pendiente") throw new Error("La solicitud ya fue resuelta");

    // Solo supervisor de la obra o director de la company
    const esDirector = roles.includes("director");
    if (!esDirector) {
      const { data: member } = await supabase
        .from("obra_team").select("role")
        .eq("obra_id", sol.obra_id).eq("user_id", userId).maybeSingle();
      if (!member || member.role !== "supervisor") {
        throw new Error("Solo supervisor o director pueden resolver solicitudes");
      }
    }

    const nuevoEstatus = data.accion === "aprobar" ? "aprobada" : "rechazada";
    const { error: updSolErr } = await supabase
      .from("almacen_semana_desbloqueo_solicitudes")
      .update({
        estatus: nuevoEstatus,
        respuesta: data.respuesta ?? null,
        resuelto_por: userId,
        resuelto_at: new Date().toISOString(),
      })
      .eq("id", sol.id);
    if (updSolErr) throw new Error(updSolErr.message);

    if (data.accion === "aprobar") {
      // Desbloquear la semana (solo si sigue bloqueada y es la semana actual)
      const hoy = new Date().toISOString().slice(0, 10);
      const { data: sem } = await supabase
        .from("almacen_semanas")
        .select("id, estatus, semana_inicio, semana_fin")
        .eq("id", sol.semana_id).maybeSingle();
      if (sem && sem.estatus === "bloqueada" && sem.semana_inicio <= hoy && sem.semana_fin >= hoy) {
        await supabase
          .from("almacen_semanas")
          .update({ estatus: "abierta" })
          .eq("id", sem.id);
      }
    }

    // Notificar al solicitante
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("notificaciones").insert({
        user_id: sol.solicitado_por,
        company_id: companyId,
        obra_id: sol.obra_id,
        tipo: data.accion === "aprobar" ? "almacen_desbloqueo_aprobado" : "almacen_desbloqueo_rechazado",
        titulo: data.accion === "aprobar" ? "Desbloqueo aprobado" : "Desbloqueo rechazado",
        mensaje: data.accion === "aprobar"
          ? "Tu solicitud de desbloqueo fue aprobada. Ya puedes editar la semana."
          : `Tu solicitud de desbloqueo fue rechazada.${data.respuesta ? ` Motivo: ${data.respuesta}` : ""}`,
        link: `/app/obras/${sol.obra_id}/almacen-obra`,
      });
    } catch (e: any) {
      console.error("[notificaciones] resolucion desbloqueo", e?.message);
    }

    return { ok: true };
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
