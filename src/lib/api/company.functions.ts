import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SELECT =
  "id, tipo_persona, razon_social, nombre_completo, rfc, curp, regimen_fiscal, calle, numero_exterior, numero_interior, colonia, municipio, estado, codigo_postal, registro_imss, registro_infonavit, moneda, zona_horaria, logo_url, capital_social";

async function getMyCompanyId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  return profile.company_id as string;
}

export const getCompanyConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getMyCompanyId(supabase, userId);
    const { data, error } = await supabase
      .from("companies")
      .select(SELECT)
      .eq("id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Empresa no encontrada");
    return data;
  });

const facturacionSchema = z.object({
  tipo_persona: z.enum(["moral", "fisica"]),
  razon_social: z.string().trim().min(1).max(255),
  nombre_completo: z.string().trim().max(255).nullable().optional(),
  rfc: z
    .string()
    .trim()
    .min(12)
    .max(13)
    .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i, "RFC con formato inválido"),
  curp: z.string().trim().max(18).nullable().optional(),
  regimen_fiscal: z.string().trim().max(255).nullable().optional(),
  calle: z.string().trim().max(255).nullable().optional(),
  numero_exterior: z.string().trim().max(50).nullable().optional(),
  numero_interior: z.string().trim().max(50).nullable().optional(),
  colonia: z.string().trim().max(255).nullable().optional(),
  municipio: z.string().trim().max(255).nullable().optional(),
  estado: z.string().trim().max(255).nullable().optional(),
  codigo_postal: z.string().trim().max(10).nullable().optional(),
  registro_imss: z.string().trim().max(50).nullable().optional(),
  registro_infonavit: z.string().trim().max(50).nullable().optional(),
});

export const updateCompanyFacturacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => facturacionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getMyCompanyId(supabase, userId);
    const { error } = await supabase
      .from("companies")
      .update({ ...data, rfc: data.rfc.toUpperCase() })
      .eq("id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const configSchema = z.object({
  moneda: z.string().trim().min(1).max(10),
  zona_horaria: z.string().trim().min(1).max(64),
});

export const updateCompanyConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => configSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getMyCompanyId(supabase, userId);
    const { error } = await supabase.from("companies").update(data).eq("id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setCompanyLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ logo_url: z.string().max(1000).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getMyCompanyId(supabase, userId);
    const { error } = await supabase
      .from("companies")
      .update({ logo_url: data.logo_url })
      .eq("id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getCompanyLogoSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from("company-logos")
      .createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const updateCompanyCapitalSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ capital_social: z.number().min(0).max(9_999_999_999) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getMyCompanyId(supabase, userId);
    // Solo director
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", companyId);
    if (!(roles ?? []).some((r: any) => r.role === "director")) {
      throw new Error("Solo el director puede actualizar el capital social");
    }
    const { error } = await supabase
      .from("companies")
      .update({ capital_social: data.capital_social })
      .eq("id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
