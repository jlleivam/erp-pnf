import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNotificacionPreferencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id)
      return { items: [] as Array<{ role: string; tipo: string; habilitado: boolean }> };

    const { data, error } = await supabase
      .from("notificacion_preferencias")
      .select("role, tipo, habilitado")
      .eq("company_id", profile.company_id);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

const setSchema = z.object({
  role: z.enum(["director", "residente", "auxiliar", "administrativo", "supervisor"]),
  tipo: z.string().min(1).max(100),
  habilitado: z.boolean(),
});

export const setNotificacionPreferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Sin empresa asignada");

    const { error } = await supabase
      .from("notificacion_preferencias")
      .upsert(
        {
          company_id: profile.company_id,
          role: data.role,
          tipo: data.tipo,
          habilitado: data.habilitado,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,role,tipo" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
