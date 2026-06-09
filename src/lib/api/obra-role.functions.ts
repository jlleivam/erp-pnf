import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Devuelve el rol del usuario actual dentro del equipo (obra_team) de la obra.
 * Retorna null si el usuario no pertenece al equipo.
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
    return {
      role,
      isResidente: role === "residente",
      isSupervisor: role === "supervisor",
    };
  });
