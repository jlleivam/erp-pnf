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

async function notify(rows: Array<{
  user_id: string; company_id: string; obra_id?: string | null;
  tipo: string; titulo: string; mensaje: string; link?: string | null;
}>) {
  if (rows.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("notificaciones").insert(rows);
}

const TIPO = z.enum(["magna", "premium", "diesel"]);

// ============================================================
// LIST / GET
// ============================================================

export const listValesGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid().optional(),
      estatus: z.string().optional(),
    }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("vales_gasolina")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.obraId) q = q.eq("obra_id", data.obraId);
    if (data.estatus) q = q.eq("estatus", data.estatus);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const arr = rows ?? [];

    const userIds = Array.from(new Set(
      arr.flatMap((r: any) =>
        [r.solicitado_por, r.autorizado_por, r.rechazado_por, r.ligado_por, r.confirmado_por, r.cancelado_por]
      ).filter(Boolean)
    ));
    let profiles: any[] = [];
    if (userIds.length) {
      const { data: p } = await supabase
        .from("profiles").select("id, nombre_completo, email").in("id", userIds);
      profiles = p ?? [];
    }
    const obraIds = Array.from(new Set(arr.map((r: any) => r.obra_id).filter(Boolean)));
    let obras: any[] = [];
    if (obraIds.length) {
      const { data: o } = await supabase
        .from("obras").select("id, nombre").in("id", obraIds);
      obras = o ?? [];
    }

    const nameOf = (id: string | null) => {
      if (!id) return null;
      const p = profiles.find((x) => x.id === id);
      return p?.nombre_completo || p?.email || null;
    };
    const obraOf = (id: string | null) => {
      if (!id) return null;
      return obras.find((o) => o.id === id)?.nombre ?? null;
    };

    return arr.map((r: any) => ({
      ...r,
      solicitado_nombre: nameOf(r.solicitado_por),
      autorizado_nombre: nameOf(r.autorizado_por),
      rechazado_nombre: nameOf(r.rechazado_por),
      ligado_nombre: nameOf(r.ligado_por),
      confirmado_nombre: nameOf(r.confirmado_por),
      cancelado_nombre: nameOf(r.cancelado_por),
      obra_nombre: obraOf(r.obra_id),
    }));
  });

// ============================================================
// CREAR
// ============================================================

export const crearValeGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid().nullable().optional(),
      tipoCombustible: TIPO,
      monto: z.number().positive(),
      descripcion: z.string().trim().min(3).max(500),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    const obraId = data.obraId ?? null;

    if (obraId) {
      const allowed = ctx.isDirector || ctx.isAdministrativo || ctx.isSupervisor
        || await isMemberObra(supabase, userId, obraId);
      if (!allowed) throw new Error("Sin acceso a esa obra");
    } else {
      if (!ctx.isDirector && !ctx.isAdministrativo) {
        throw new Error("Solo director o administrativo pueden crear vales generales");
      }
    }

    const { data: folio, error: folioErr } = await supabase
      .rpc("siguiente_folio_vale_gasolina", { _company_id: ctx.companyId });
    if (folioErr) throw new Error(folioErr.message);

    const { data: inserted, error } = await supabase
      .from("vales_gasolina")
      .insert({
        folio,
        company_id: ctx.companyId,
        obra_id: obraId,
        tipo_combustible: data.tipoCombustible,
        monto_solicitado: data.monto,
        descripcion: data.descripcion,
        solicitado_por: userId,
      })
      .select("id, folio")
      .single();
    if (error) throw new Error(error.message);

    // Notificar a supervisores y director(es)
    const { data: supers } = await supabase
      .from("user_roles").select("user_id")
      .eq("company_id", ctx.companyId)
      .in("role", ["supervisor", "director"]);
    const targets = Array.from(new Set((supers ?? []).map((s: any) => s.user_id as string)))
      .filter((id) => id !== userId);
    await notify(targets.map((uid) => ({
      user_id: uid,
      company_id: ctx.companyId,
      obra_id: obraId,
      tipo: "vale_gasolina_solicitud",
      titulo: `Nuevo vale ${inserted.folio}`,
      mensaje: `Se solicitó un vale de gasolina por $${data.monto.toFixed(2)}`,
      link: `/app/admin/gasolinas`,
    })));

    return { ok: true, id: inserted.id, folio: inserted.folio };
  });

// ============================================================
// AUTORIZAR
// ============================================================

export const autorizarValeGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      montoAutorizado: z.number().positive(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isSupervisor) {
      throw new Error("Solo supervisor o director autoriza");
    }
    const { data: vale } = await supabase
      .from("vales_gasolina").select("estatus, folio, solicitado_por, obra_id, company_id")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "pendiente_autorizacion") {
      throw new Error("Solo se autoriza un vale pendiente");
    }
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "autorizado",
        autorizado_por: userId,
        autorizado_at: new Date().toISOString(),
        monto_autorizado: data.montoAutorizado,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Notificar a administrativos
    const { data: admins } = await supabase
      .from("user_roles").select("user_id")
      .eq("company_id", vale.company_id)
      .in("role", ["administrativo", "director"]);
    const targets = Array.from(new Set((admins ?? []).map((s: any) => s.user_id as string)));
    await notify(targets.map((uid) => ({
      user_id: uid,
      company_id: vale.company_id,
      obra_id: vale.obra_id,
      tipo: "vale_gasolina_autorizado",
      titulo: `Vale ${vale.folio} autorizado`,
      mensaje: `Liga el código físico del vale por $${data.montoAutorizado.toFixed(2)}`,
      link: `/app/admin/gasolinas`,
    })));
    // También al solicitante
    await notify([{
      user_id: vale.solicitado_por,
      company_id: vale.company_id,
      obra_id: vale.obra_id,
      tipo: "vale_gasolina_autorizado",
      titulo: `Tu vale ${vale.folio} fue autorizado`,
      mensaje: `Monto autorizado: $${data.montoAutorizado.toFixed(2)}`,
      link: `/app/admin/gasolinas`,
    }]);

    return { ok: true };
  });

// ============================================================
// RECHAZAR
// ============================================================

export const rechazarValeGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      motivo: z.string().trim().min(3).max(500),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isSupervisor) {
      throw new Error("Solo supervisor o director rechaza");
    }
    const { data: vale } = await supabase
      .from("vales_gasolina").select("estatus, folio, solicitado_por, obra_id, company_id")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "pendiente_autorizacion") {
      throw new Error("Solo se rechaza un vale pendiente");
    }
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "rechazado",
        rechazado_por: userId,
        rechazado_at: new Date().toISOString(),
        motivo_rechazo: data.motivo,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await notify([{
      user_id: vale.solicitado_por,
      company_id: vale.company_id,
      obra_id: vale.obra_id,
      tipo: "vale_gasolina_rechazado",
      titulo: `Vale ${vale.folio} rechazado`,
      mensaje: data.motivo,
      link: `/app/admin/gasolinas`,
    }]);
    return { ok: true };
  });

// ============================================================
// CANCELAR (solicitante)
// ============================================================

export const cancelarValeGasolina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    const { data: vale } = await supabase
      .from("vales_gasolina").select("estatus, solicitado_por")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "pendiente_autorizacion") {
      throw new Error("Solo puedes cancelar un vale pendiente");
    }
    if (vale.solicitado_por !== userId && !ctx.isDirector) {
      throw new Error("Solo el solicitante o director puede cancelar");
    }
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "cancelado",
        cancelado_por: userId,
        cancelado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// LIGAR CÓDIGO FÍSICO (administrativo)
// ============================================================

export const ligarCodigoVale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      codigoVale: z.string().trim().min(1).max(100),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    if (!ctx.isDirector && !ctx.isAdministrativo) {
      throw new Error("Solo administrativo o director liga el código");
    }
    const { data: vale } = await supabase
      .from("vales_gasolina").select("estatus, folio, solicitado_por, obra_id, company_id")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "autorizado") {
      throw new Error("Solo se liga un vale autorizado");
    }
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "entregado",
        codigo_vale: data.codigoVale,
        ligado_por: userId,
        ligado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await notify([{
      user_id: vale.solicitado_por,
      company_id: vale.company_id,
      obra_id: vale.obra_id,
      tipo: "vale_gasolina_entregado",
      titulo: `Vale ${vale.folio} entregado`,
      mensaje: `Código: ${data.codigoVale}. Confirma la recepción.`,
      link: `/app/admin/gasolinas`,
    }]);
    return { ok: true };
  });

// ============================================================
// CONFIRMAR RECEPCIÓN
// ============================================================

export const confirmarRecepcionVale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await getCtx(supabase, userId);
    const { data: vale } = await supabase
      .from("vales_gasolina").select("estatus, solicitado_por")
      .eq("id", data.id).maybeSingle();
    if (!vale) throw new Error("Vale no encontrado");
    if (vale.estatus !== "entregado") {
      throw new Error("Solo se confirma un vale entregado");
    }
    if (vale.solicitado_por !== userId && !ctx.isDirector) {
      throw new Error("Solo el solicitante o director confirma");
    }
    const { error } = await supabase
      .from("vales_gasolina")
      .update({
        estatus: "confirmado",
        confirmado_por: userId,
        confirmado_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
