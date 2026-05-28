import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["director", "residente", "auxiliar", "administrativo", "supervisor"] as const;
const roleEnum = z.enum(ROLES);

/** Verify the caller is a Director of their own company. Returns companyId. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireDirector(
  supabase: any,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa");

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("company_id", profile.company_id)
    .eq("role", "director")
    .maybeSingle();
  if (!roleRow) throw new Error("Solo el Director puede gestionar el equipo");
  return profile.company_id as string;
}

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) return [];

    const { data: members, error } = await supabase
      .from("profiles")
      .select("id, nombre_completo, email, created_at")
      .eq("company_id", profile.company_id)
      .order("nombre_completo");
    if (error) throw new Error(error.message);

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("company_id", profile.company_id);
    if (rolesError) throw new Error(rolesError.message);

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    return (members ?? []).map((m) => ({
      ...m,
      roles: rolesByUser.get(m.id) ?? [],
    }));
  });

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  nombre_completo: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(72),
  roles: z.array(roleEnum).min(1).max(5),
});

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await requireDirector(supabase, userId);

    // Create the auth user with confirmed email (no email sent).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nombre_completo: data.nombre_completo },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "No se pudo crear usuario");

    const newUserId = created.user.id;

    // The handle_new_user trigger creates the profile row. Attach to company.
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ company_id: companyId, nombre_completo: data.nombre_completo })
      .eq("id", newUserId);
    if (profErr) throw new Error(profErr.message);

    // Insert role rows.
    const uniqueRoles = Array.from(new Set(data.roles));
    const { error: rolesErr } = await supabaseAdmin.from("user_roles").insert(
      uniqueRoles.map((role) => ({ user_id: newUserId, company_id: companyId, role }))
    );
    if (rolesErr) throw new Error(rolesErr.message);

    return { userId: newUserId };
  });

const updateRolesSchema = z.object({
  user_id: z.string().uuid(),
  roles: z.array(roleEnum).min(1).max(5),
});

export const updateMemberRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateRolesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await requireDirector(supabase, userId);

    if (data.user_id === userId) {
      // Prevent the director from accidentally removing their own director role.
      if (!data.roles.includes("director")) {
        throw new Error("No puedes quitarte el rol de Director");
      }
    }

    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("company_id", companyId);
    if (delErr) throw new Error(delErr.message);

    const unique = Array.from(new Set(data.roles));
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert(unique.map((role) => ({ user_id: data.user_id, company_id: companyId, role })));
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await requireDirector(supabase, userId);

    if (data.user_id === userId) throw new Error("No puedes removerte a ti mismo");

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("company_id", companyId);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ company_id: null })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
