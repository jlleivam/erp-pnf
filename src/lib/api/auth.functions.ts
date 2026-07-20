import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getSessionContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, nombre_completo, company_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    const { data: roleRows, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError) throw new Error(rolesError.message);

    return {
      userId,
      profile: profile ?? null,
      roles: (roleRows ?? []).map((r) => r.role),
    };
  });

const completeOnboardingSchema = z.object({
  tipo_persona: z.enum(["moral", "fisica"]),
  razon_social: z.string().trim().min(1).max(255),
  rfc: z.string().trim().min(12).max(13),
  nombre_completo: z.string().trim().min(1).max(255),
});

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => completeOnboardingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Already has a company?
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();

    if (existing?.company_id) {
      return { companyId: existing.company_id };
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        tipo_persona: data.tipo_persona,
        razon_social: data.razon_social,
        rfc: data.rfc.toUpperCase(),
      })
      .select("id")
      .single();

    if (companyError) throw new Error(companyError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        company_id: company.id,
        nombre_completo: data.nombre_completo,
        email: context.claims.email ?? "",
      });

    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, company_id: company.id, role: "director" });

    if (roleError) throw new Error(roleError.message);

    const { error: notifError } = await supabaseAdmin
      .from("notificaciones")
      .insert({
        user_id: userId,
        company_id: company.id,
        tipo: "bienvenida",
        titulo: "¡Bienvenido!",
        mensaje: "Configura los datos de tu empresa para comenzar.",
        link: "/app/configuracion",
      });
    if (notifError) console.error("welcome notification failed:", notifError.message);

    return { companyId: company.id };
  });

const updateProfileSchema = z.object({
  nombre_completo: z.string().trim().min(1).max(255),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateProfileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ nombre_completo: data.nombre_completo })
      .eq("id", userId)
      .select("id, email, nombre_completo, company_id")
      .single();
    if (error) throw new Error(error.message);
    return profile;
  });
