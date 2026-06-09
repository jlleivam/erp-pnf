import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DevSwitchableUser = {
  id: string;
  nombre_completo: string | null;
  email: string | null;
  roles: string[];
};

export const listSwitchableUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .single();
    const companyId = me?.company_id;
    if (!companyId) return [] as DevSwitchableUser[];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nombre_completo, email")
      .eq("company_id", companyId)
      .order("nombre_completo", { ascending: true });
    if (error) throw error;

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("company_id", companyId);

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as string);
      rolesByUser.set(r.user_id, arr);
    }

    return (profiles ?? []).map((p) => ({
      id: p.id,
      nombre_completo: p.nombre_completo,
      email: p.email,
      roles: rolesByUser.get(p.id) ?? [],
    })) as DevSwitchableUser[];
  });

export const impersonateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Confirm target user shares the same company as the caller.
    const { data: me } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", context.userId)
      .single();
    const companyId = me?.company_id;
    if (!companyId) throw new Error("No company");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error: tErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, company_id")
      .eq("id", data.userId)
      .single();
    if (tErr || !target) throw new Error("Usuario no encontrado");
    if (target.company_id !== companyId) throw new Error("Fuera de la empresa");
    if (!target.email) throw new Error("Usuario sin email");

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
    });
    if (linkErr || !link) throw linkErr ?? new Error("No se pudo generar el enlace");

    const tokenHash =
      (link.properties as { hashed_token?: string } | null)?.hashed_token ?? null;
    if (!tokenHash) throw new Error("Sin token_hash");

    return { token_hash: tokenHash, email: target.email };
  });
