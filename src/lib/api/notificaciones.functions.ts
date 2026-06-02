import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMisNotificaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ soloNoLeidas: z.boolean().optional(), limit: z.number().min(1).max(100).optional() }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("notificaciones")
      .select("id, tipo, titulo, mensaje, link, requisicion_id, oc_id, obra_id, leida_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 30);
    if (data.soloNoLeidas) q = q.is("leida_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { count } = await supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("leida_at", null);

    return { items: rows ?? [], noLeidas: count ?? 0 };
  });

export const marcarNotificacionLeida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notificaciones")
      .update({ leida_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarTodasLeidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notificaciones")
      .update({ leida_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("leida_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
