import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getMyCompanyId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  return profile.company_id as string;
}

export const listUnidadesNegocio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("unidades_negocio")
      .select("id, nombre")
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const crearUnidadNegocio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ nombre: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getMyCompanyId(supabase, userId);
    const { data: row, error } = await supabase
      .from("unidades_negocio")
      .insert({ company_id: companyId, nombre: data.nombre })
      .select("id, nombre")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const editarUnidadNegocio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), nombre: z.string().trim().min(1).max(120) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("unidades_negocio")
      .update({ nombre: data.nombre })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const eliminarUnidadNegocio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { count, error: cErr } = await supabase
      .from("obras")
      .select("id", { count: "exact", head: true })
      .eq("unidad_negocio_id", data.id);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) {
      throw new Error("No se puede eliminar: hay obras vinculadas a esta unidad");
    }
    const { error } = await supabase
      .from("unidades_negocio")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
