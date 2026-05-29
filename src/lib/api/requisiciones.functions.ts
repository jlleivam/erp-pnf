import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InsumoInput = z.object({
  insumo_id: z.string().uuid(),
  cantidad: z.number().positive(),
  fecha_requerida: z.string().min(1),
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
    const { supabase } = context;
    let q = supabase
      .from("requisiciones")
      .select("id, folio, estatus, notas, created_at, creado_por, items:requisicion_insumos(id, cantidad, fecha_requerida, nota, insumo:insumos(id, nombre, unidad))")
      .eq("obra_id", data.obraId)
      .order("created_at", { ascending: false });
    if (data.soloActivas) {
      q = q.not("estatus", "in", "(completada,rechazada)");
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

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
    return {
      ...req,
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
