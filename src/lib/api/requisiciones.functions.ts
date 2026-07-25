import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InsumoInput = z.object({
  insumo_id: z.string().uuid(),
  cantidad: z.number().positive(),
  fecha_requerida: z.string().min(1),
  nota: z.string().trim().max(500).optional().nullable(),
});

const BorradorInsumoInput = z.object({
  insumo_id: z.string().uuid().nullable().optional(),
  cantidad: z.number().min(0).nullable().optional(),
  fecha_requerida: z.string().nullable().optional(),
  nota: z.string().trim().max(500).optional().nullable(),
});

export const listRequisiciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      soloActivas: z.boolean().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("requisiciones")
      .select("id, folio, estatus, notas, created_at, creado_por, items:requisicion_insumos(id, cantidad, fecha_requerida, nota, insumo:insumos(id, nombre, unidad))")
      .eq("obra_id", data.obraId)
      .order("created_at", { ascending: false });
    if (data.soloActivas === true) {
      q = q.not("estatus", "in", "(completada,rechazada)");
    } else if (data.soloActivas === false) {
      q = q.in("estatus", ["completada", "rechazada"]);
    }
    const { data: rowsRaw, error } = await q;
    if (error) throw new Error(error.message);
    // Borradores solo visibles para su creador
    const rows = (rowsRaw ?? []).filter(
      (r: any) => r.estatus !== "borrador" || r.creado_por === userId,
    );

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.creado_por).filter(Boolean)));
    let profileMap = new Map<string, { nombre_completo: string; email: string }>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, nombre_completo, email").in("id", userIds);
      for (const p of profs ?? []) profileMap.set(p.id, p);
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      solicitante: r.creado_por ? profileMap.get(r.creado_por) ?? null : null,
    }));
  });

export const listRequisicionesAsignadas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ soloActivas: z.boolean().optional() }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!profile?.company_id) return [];

    const { data: dirRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", profile.company_id)
      .eq("role", "director")
      .maybeSingle();
    const isDirector = !!dirRow;

    let obraIds: string[] | null = null;
    if (!isDirector) {
      const { data: teamRows } = await supabase
        .from("obra_team").select("obra_id").eq("user_id", userId);
      obraIds = Array.from(new Set((teamRows ?? []).map((t: any) => t.obra_id)));
      if (obraIds.length === 0) return [];
    }

    let q = supabase
      .from("requisiciones")
      .select("id, folio, estatus, notas, enviada_at, created_at, creado_por, obra_id, items:requisicion_insumos(id)")
      .neq("estatus", "borrador")
      .order("created_at", { ascending: false });
    if (obraIds) q = q.in("obra_id", obraIds);
    if (data.soloActivas === true) q = q.not("estatus", "in", "(completada,rechazada)");
    else if (data.soloActivas === false) q = q.in("estatus", ["completada", "rechazada"]);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.creado_por).filter(Boolean)));
    const profileMap = new Map<string, { nombre_completo: string }>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, nombre_completo").in("id", userIds);
      for (const p of profs ?? []) profileMap.set(p.id, p);
    }

    const obraIdsRows = Array.from(new Set((rows ?? []).map((r: any) => r.obra_id).filter(Boolean)));
    const obraMap = new Map<string, { id: string; nombre: string }>();
    if (obraIdsRows.length > 0) {
      const { data: obs } = await supabase
        .from("obras").select("id, nombre").in("id", obraIdsRows);
      for (const o of obs ?? []) obraMap.set(o.id, o);
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      folio: r.folio,
      estatus: r.estatus,
      notas: r.notas,
      enviada_at: r.enviada_at,
      created_at: r.created_at,
      obra: obraMap.get(r.obra_id) ?? null,
      insumos_count: (r.items ?? []).length,
      solicitante: r.creado_por ? profileMap.get(r.creado_por)?.nombre_completo ?? null : null,
    }));
  });

export const getRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: req, error } = await supabase
      .from("requisiciones")
      .select("*, items:requisicion_insumos(id, cantidad, fecha_requerida, nota, insumo:insumos(id, nombre, unidad))")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Requisición no encontrada");

    const userIds = Array.from(new Set([
      req.creado_por, req.cotizacion_por, req.autorizacion_por, req.oc_por, req.completada_por, req.rechazada_por,
    ].filter(Boolean))) as string[];
    let profileMap = new Map<string, { nombre_completo: string }>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, nombre_completo").in("id", userIds);
      for (const p of profs ?? []) profileMap.set(p.id, p);
    }
    const nameOf = (id: string | null | undefined) => (id ? profileMap.get(id)?.nombre_completo ?? null : null);

    // Pedido (cantidad en OC) y Recibido (cantidad en almacén) por insumo
    const pedidoPorInsumo = new Map<string, number>();
    const recibidoPorInsumo = new Map<string, number>();
    const { data: ocs } = await supabase
      .from("ordenes_compra")
      .select("id, estatus, paquete:cotizacion_paquetes(insumos:cotizacion_paquete_insumos(insumo_id, cantidad))")
      .eq("requisicion_id", data.id)
      .not("estatus", "in", "(borrador,rechazada)");
    const ocIds: string[] = [];
    for (const oc of (ocs ?? []) as any[]) {
      ocIds.push(oc.id);
      const insumos = oc.paquete?.insumos ?? [];
      for (const pi of insumos) {
        pedidoPorInsumo.set(pi.insumo_id, (pedidoPorInsumo.get(pi.insumo_id) ?? 0) + Number(pi.cantidad));
      }
    }
    if (ocIds.length > 0) {
      const { data: parts } = await supabase
        .from("almacen_recepcion_partidas")
        .select("insumo_id, cantidad, recepcion:almacen_recepciones!inner(oc_id)")
        .in("recepcion.oc_id", ocIds);
      for (const p of (parts ?? []) as any[]) {
        recibidoPorInsumo.set(p.insumo_id, (recibidoPorInsumo.get(p.insumo_id) ?? 0) + Number(p.cantidad));
      }
    }
    const itemsEnriched = (req.items ?? []).map((it: any) => ({
      ...it,
      pedido: pedidoPorInsumo.get(it.insumo?.id) ?? 0,
      recibido: recibidoPorInsumo.get(it.insumo?.id) ?? 0,
    }));

    return {
      ...req,
      items: itemsEnriched,
      solicitante: nameOf(req.creado_por),
      cotizacion_responsable: nameOf(req.cotizacion_por),
      autorizacion_responsable: nameOf(req.autorizacion_por),
      oc_responsable: nameOf(req.oc_por),
      completada_responsable: nameOf(req.completada_por),
      rechazada_responsable: nameOf(req.rechazada_por),
    };
  });


export const crearRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      notas: z.string().trim().max(1000).optional().nullable(),
      insumos: z.array(InsumoInput).min(1),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sin empresa asociada");
    const companyId = profile.company_id;

    const { data: folioData, error: folioErr } = await supabase
      .rpc("siguiente_folio_requisicion", { _company_id: profile.company_id });
    if (folioErr) throw new Error(folioErr.message);

    const { data: req, error: insErr } = await supabase
      .from("requisiciones")
      .insert({
        obra_id: data.obraId,
        company_id: profile.company_id,
        folio: folioData as string,
        creado_por: userId,
        estatus: "enviada",
        enviada_at: new Date().toISOString(),
        notas: data.notas ?? null,
      })
      .select("id, folio")
      .single();
    if (insErr) throw new Error(insErr.message);

    const items = data.insumos.map((i) => ({
      requisicion_id: req.id,
      insumo_id: i.insumo_id,
      cantidad: i.cantidad,
      fecha_requerida: i.fecha_requerida,
      nota: i.nota ?? null,
    }));
    const { error: itemsErr } = await supabase.from("requisicion_insumos").insert(items);
    if (itemsErr) {
      await supabase.from("requisiciones").delete().eq("id", req.id);
      throw new Error(itemsErr.message);
    }

    // Notificar a administrativos de la empresa
    try {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", profile.company_id)
        .in("role", ["administrativo", "director"]);
      const destinatarios = Array.from(
        new Set((admins ?? []).map((a: any) => a.user_id as string).filter((u) => u !== userId))
      );
      if (destinatarios.length > 0) {
        const [{ data: solicitanteProfile }, { data: obra }] = await Promise.all([
          supabase.from("profiles").select("nombre_completo").eq("id", userId).maybeSingle(),
          supabase.from("obras").select("nombre").eq("id", data.obraId).maybeSingle(),
        ]);
        const quien = solicitanteProfile?.nombre_completo
          ? `${solicitanteProfile.nombre_completo} envió`
          : "Se envió";
        const dondeStr = obra?.nombre ? ` de la obra ${obra.nombre}` : "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: notifErr } = await supabaseAdmin.from("notificaciones").insert(
          destinatarios.map((uid) => ({
            user_id: uid,
            company_id: companyId,
            obra_id: data.obraId,
            tipo: "requisicion_enviada",
            titulo: `Nueva requisición ${req.folio}`,
            mensaje: `${quien} una nueva requisición${dondeStr}.`,
            link: `/app/admin/requisiciones`,
            requisicion_id: req.id,
          })),
        );
        if (notifErr) console.error("[notificaciones] insert failed", notifErr.message);
      }
    } catch (e: any) {
      console.error("[notificaciones] requisicion_enviada error", e?.message);
    }

    return { id: req.id, folio: req.folio };
  });

export const agregarInsumoRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      requisicionId: z.string().uuid(),
      insumo_id: z.string().uuid(),
      cantidad: z.number().positive(),
      fecha_requerida: z.string().min(1),
      nota: z.string().trim().max(500).optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("requisicion_insumos").insert({
      requisicion_id: data.requisicionId,
      insumo_id: data.insumo_id,
      cantidad: data.cantidad,
      fecha_requerida: data.fecha_requerida,
      nota: data.nota ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelarRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req } = await supabase
      .from("requisiciones").select("id, estatus, creado_por").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("No encontrada");
    if (req.creado_por !== userId) throw new Error("Solo el creador puede cancelar");
    if (req.estatus !== "enviada") throw new Error("Solo se puede cancelar si está enviada");
    const { error } = await supabase.from("requisiciones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// BORRADORES
// ============================================================================

async function notificarRequisicionEnviada(
  supabase: any,
  args: { requisicionId: string; folio: string; obraId: string; userId: string; companyId: string },
) {
  try {
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("company_id", args.companyId)
      .in("role", ["administrativo", "director"]);
    const destinatarios: string[] = Array.from(
      new Set((admins ?? []).map((a: any) => a.user_id as string).filter((u: string) => u !== args.userId)),
    );
    if (destinatarios.length === 0) return;
    const [{ data: solicitanteProfile }, { data: obra }] = await Promise.all([
      supabase.from("profiles").select("nombre_completo").eq("id", args.userId).maybeSingle(),
      supabase.from("obras").select("nombre").eq("id", args.obraId).maybeSingle(),
    ]);
    const quien = solicitanteProfile?.nombre_completo
      ? `${solicitanteProfile.nombre_completo} envió`
      : "Se envió";
    const dondeStr = obra?.nombre ? ` de la obra ${obra.nombre}` : "";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: notifErr } = await supabaseAdmin.from("notificaciones").insert(
      destinatarios.map((uid: string) => ({
        user_id: uid,
        company_id: args.companyId,
        obra_id: args.obraId,
        tipo: "requisicion_enviada",
        titulo: `Nueva requisición ${args.folio}`,
        mensaje: `${quien} una nueva requisición${dondeStr}.`,
        link: `/app/admin/requisiciones`,
        requisicion_id: args.requisicionId,
      })),
    );
    if (notifErr) console.error("[notificaciones] insert failed", notifErr.message);
  } catch (e: any) {
    console.error("[notificaciones] requisicion_enviada error", e?.message);
  }
}

export const guardarBorradorRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      borradorId: z.string().uuid().optional().nullable(),
      obraId: z.string().uuid(),
      notas: z.string().trim().max(1000).optional().nullable(),
      insumos: z.array(BorradorInsumoInput),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    if (!profile?.company_id) throw new Error("Sin empresa asociada");

    let reqId: string;
    if (data.borradorId) {
      const { data: existing } = await supabase
        .from("requisiciones")
        .select("id, estatus, creado_por")
        .eq("id", data.borradorId)
        .maybeSingle();
      if (!existing) throw new Error("Borrador no encontrado");
      if (existing.creado_por !== userId) throw new Error("Solo el creador puede editar");
      if (existing.estatus !== "borrador") throw new Error("Ya no es un borrador");
      const { error: updErr } = await supabase
        .from("requisiciones")
        .update({ notas: data.notas ?? null })
        .eq("id", data.borradorId);
      if (updErr) throw new Error(updErr.message);
      await supabase.from("requisicion_insumos").delete().eq("requisicion_id", data.borradorId);
      reqId = data.borradorId;
    } else {
      const shortId = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data: created, error: insErr } = await supabase
        .from("requisiciones")
        .insert({
          obra_id: data.obraId,
          company_id: profile.company_id,
          folio: `BORRADOR-${shortId}`,
          creado_por: userId,
          estatus: "borrador",
          notas: data.notas ?? null,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      reqId = created.id;
    }

    const items = data.insumos.map((i) => ({
      requisicion_id: reqId,
      insumo_id: i.insumo_id ?? null,
      cantidad: i.cantidad ?? null,
      fecha_requerida: i.fecha_requerida || null,
      nota: i.nota ?? null,
    }));
    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from("requisicion_insumos").insert(items);
      if (itemsErr) throw new Error(itemsErr.message);
    }
    return { id: reqId };
  });

export const enviarBorradorRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      borradorId: z.string().uuid(),
      notas: z.string().trim().max(1000).optional().nullable(),
      insumos: z.array(InsumoInput).min(1),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("requisiciones")
      .select("id, estatus, creado_por, obra_id, company_id")
      .eq("id", data.borradorId)
      .maybeSingle();
    if (!existing) throw new Error("Borrador no encontrado");
    if (existing.creado_por !== userId) throw new Error("Solo el creador puede enviar");
    if (existing.estatus !== "borrador") throw new Error("Ya no es un borrador");

    const { data: folioData, error: folioErr } = await supabase
      .rpc("siguiente_folio_requisicion", { _company_id: existing.company_id });
    if (folioErr) throw new Error(folioErr.message);

    // Reemplazar items con la versión completa/validada
    await supabase.from("requisicion_insumos").delete().eq("requisicion_id", data.borradorId);
    const items = data.insumos.map((i) => ({
      requisicion_id: data.borradorId,
      insumo_id: i.insumo_id,
      cantidad: i.cantidad,
      fecha_requerida: i.fecha_requerida,
      nota: i.nota ?? null,
    }));
    const { error: itemsErr } = await supabase.from("requisicion_insumos").insert(items);
    if (itemsErr) throw new Error(itemsErr.message);

    const { error: updErr } = await supabase
      .from("requisiciones")
      .update({
        folio: folioData as string,
        estatus: "enviada",
        enviada_at: new Date().toISOString(),
        notas: data.notas ?? null,
      })
      .eq("id", data.borradorId);
    if (updErr) throw new Error(updErr.message);

    await notificarRequisicionEnviada(supabase, {
      requisicionId: data.borradorId,
      folio: folioData as string,
      obraId: existing.obra_id,
      userId,
      companyId: existing.company_id,
    });

    return { id: data.borradorId, folio: folioData as string };
  });

export const eliminarBorradorRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req } = await supabase
      .from("requisiciones").select("id, estatus, creado_por").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("No encontrada");
    if (req.creado_por !== userId) throw new Error("Solo el creador puede eliminar");
    if (req.estatus !== "borrador") throw new Error("Solo se puede eliminar un borrador");
    const { error } = await supabase.from("requisiciones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBorradorRequisicion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req, error } = await supabase
      .from("requisiciones")
      .select("id, obra_id, estatus, notas, creado_por, items:requisicion_insumos(id, insumo_id, cantidad, fecha_requerida, nota)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("No encontrada");
    if (req.creado_por !== userId) throw new Error("Sin acceso");
    return req;
  });

