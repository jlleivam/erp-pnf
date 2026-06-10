import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Devuelve el rol del usuario actual dentro del equipo (obra_team) de la obra.
 * Retorna null si el usuario no pertenece al equipo.
 * Incluye también flags de roles de empresa (director, administrativo).
 */
export const getMiRolEnObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obraId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("obra_team")
      .select("role")
      .eq("obra_id", data.obraId)
      .eq("user_id", userId)
      .maybeSingle();
    const role = (row?.role ?? null) as
      | "director"
      | "residente"
      | "auxiliar"
      | "administrativo"
      | "supervisor"
      | null;

    // Roles de empresa
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = (profile as any)?.company_id as string | null;
    let isDirector = false;
    let isAdministrativo = false;
    if (companyId) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("company_id", companyId);
      const set = new Set((roles ?? []).map((r: any) => r.role as string));
      isDirector = set.has("director");
      isAdministrativo = set.has("administrativo");
    }

    return {
      role,
      isResidente: role === "residente",
      isSupervisor: role === "supervisor",
      isDirector,
      isAdministrativo,
    };
  });
