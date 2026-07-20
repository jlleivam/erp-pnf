import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) return { items: [] as Array<{ role: string; action_key: string; allowed: boolean }> };

    const { data, error } = await supabase
      .from("role_permissions")
      .select("role, action_key, allowed")
      .eq("company_id", profile.company_id);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

const setSchema = z.object({
  role: z.enum(["residente", "auxiliar", "administrativo", "supervisor"]),
  action_key: z.string().min(1).max(100),
  allowed: z.boolean(),
});

export const setRolePermission = createServerFn({ method: "POST" })
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
      .from("role_permissions")
      .upsert(
        {
          company_id: profile.company_id,
          role: data.role,
          action_key: data.action_key,
          allowed: data.allowed,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,role,action_key" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
