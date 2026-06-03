import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TAREA_ESTATUS = ["pendiente", "en_progreso", "completada", "cancelada"] as const;
export type TareaEstatus = (typeof TAREA_ESTATUS)[number];

export type Tarea = {
  id: string;
  obra_id: string;
  titulo: string;
  descripcion: string | null;
  asignado_a: string;
  asignado_nombre: string | null;
  creado_por: string;
  creado_por_nombre: string | null;
  fecha_limite: string | null;
  estatus: TareaEstatus;
  completada_at: string | null;
  created_at: string;
};

async function hydrateProfiles(
  supabase: any,
  rows: Array<any>,
): Promise<Tarea[]> {
  const ids = Array.from(new Set(rows.flatMap((r) => [r.asignado_a, r.creado_por])));
  let nameMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, nombre_completo")
      .in("id", ids);
    if (error) throw new Error(error.message);
    nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.nombre_completo]));
  }
  return rows.map((r) => ({
    id: r.id,
    obra_id: r.obra_id,
    titulo: r.titulo,
    descripcion: r.descripcion,
    asignado_a: r.asignado_a,
    creado_por: r.creado_por,
    fecha_limite: r.fecha_limite,
    estatus: r.estatus as TareaEstatus,
    completada_at: r.completada_at,
    created_at: r.created_at,
    asignado_nombre: nameMap.get(r.asignado_a) ?? null,
    creado_por_nombre: nameMap.get(r.creado_por) ?? null,
  }));
}

export const listMisTareasObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("obra_tareas")
      .select("id, obra_id, titulo, descripcion, asignado_a, creado_por, fecha_limite, estatus, completada_at, created_at")
      .eq("obra_id", data.obraId)
      .eq("asignado_a", userId)
      .in("estatus", ["pendiente", "en_progreso"])
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return hydrateProfiles(supabase, rows ?? []);
  });

export const listTareasObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("obra_tareas")
      .select("id, obra_id, titulo, descripcion, asignado_a, creado_por, fecha_limite, estatus, completada_at, created_at")
      .eq("obra_id", data.obraId)
      .order("estatus", { ascending: true })
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return hydrateProfiles(supabase, rows ?? []);
  });

const crearTareaSchema = z.object({
  obraId: z.string().uuid(),
  titulo: z.string().trim().min(1).max(255),
  descripcion: z.string().trim().max(2000).optional().nullable(),
  asignado_a: z.string().uuid(),
  fecha_limite: z.string().optional().nullable(),
});

export const crearTarea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => crearTareaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Sin empresa asociada");

    const { data: tarea, error } = await supabase
      .from("obra_tareas")
      .insert({
        company_id: profile.company_id,
        obra_id: data.obraId,
        titulo: data.titulo,
        descripcion: data.descripcion || null,
        asignado_a: data.asignado_a,
        creado_por: userId,
        fecha_limite: data.fecha_limite || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: tarea.id };
  });

export const actualizarTareaEstatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), estatus: z.enum(TAREA_ESTATUS) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch = {
      estatus: data.estatus,
      completada_at: data.estatus === "completada" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("obra_tareas").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarTarea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("obra_tareas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
