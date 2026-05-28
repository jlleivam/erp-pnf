import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listObras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("obras")
      .select(
        "id, nombre, tipo_obra, numero_contrato, ubicacion, fecha_inicio, fecha_terminacion, cliente:clientes(razon_social)"
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getObraDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ obraId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: obra, error: obraError } = await supabase
      .from("obras")
      .select(
        "id, nombre, tipo_obra, numero_contrato, ubicacion, fecha_inicio, fecha_terminacion, presupuesto_url, cliente:clientes(id, razon_social, rfc, tipo_persona)"
      )
      .eq("id", data.obraId)
      .maybeSingle();
    if (obraError) throw new Error(obraError.message);
    if (!obra) throw new Error("Obra no encontrada");

    // Two-step fetch: obra_team has no FK to profiles (user_id -> auth.users),
    // so we resolve profiles manually instead of relying on PostgREST joins.
    const { data: teamRows, error: teamError } = await supabase
      .from("obra_team")
      .select("id, role, user_id")
      .eq("obra_id", data.obraId);
    if (teamError) throw new Error(teamError.message);

    const userIds = (teamRows ?? []).map((r) => r.user_id);
    let profiles: Array<{ id: string; nombre_completo: string; email: string }> = [];
    if (userIds.length > 0) {
      const { data: profileRows, error: profErr } = await supabase
        .from("profiles")
        .select("id, nombre_completo, email")
        .in("id", userIds);
      if (profErr) throw new Error(profErr.message);
      profiles = profileRows ?? [];
    }
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const team = (teamRows ?? []).map((r) => ({
      id: r.id,
      role: r.role,
      user: profileMap.get(r.user_id) ?? null,
    }));

    return { obra, team };
  });

const crearObraSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
  tipo_obra: z.enum([
    "industrial",
    "comercial",
    "residencial",
    "infraestructura",
    "vivienda_serie",
    "urbanizacion",
  ]),
  cliente_id: z.string().uuid().nullable(),
  numero_contrato: z.string().trim().max(100).optional(),
  ubicacion: z.string().trim().max(500).optional(),
  fecha_inicio: z.string().optional(),
  fecha_terminacion: z.string().optional(),
  presupuesto_url: z.string().max(1000).nullable().optional(),
  monto_contratado: z.number().min(0).nullable().optional(),

  team: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        role: z.enum(["director", "residente", "auxiliar", "administrativo", "supervisor"]),
      })
    )
    .default([]),
  comisiones: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        porcentaje: z.number().min(0).max(100),
        base_calculo: z.enum(["monto_contratado", "monto_cobrado"]),
      })
    )
    .default([]),
});

export const crearObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => crearObraSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("Sin empresa asociada");

    const roles = new Set(data.team.map((m) => m.role));
    if (!roles.has("residente") || !roles.has("administrativo") || !roles.has("supervisor")) {
      throw new Error("Se requiere mínimo un Residente, un Administrativo y un Supervisor");
    }

    const { data: obra, error } = await supabase
      .from("obras")
      .insert({
        company_id: profile.company_id,
        nombre: data.nombre,
        tipo_obra: data.tipo_obra,
        cliente_id: data.cliente_id,
        numero_contrato: data.numero_contrato || null,
        ubicacion: data.ubicacion || null,
        fecha_inicio: data.fecha_inicio || null,
        fecha_terminacion: data.fecha_terminacion || null,
        presupuesto_url: data.presupuesto_url || null,
        monto_contratado: data.monto_contratado ?? null,
        created_by: userId,

      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.team.length > 0) {
      const { error: teamError } = await supabase
        .from("obra_team")
        .insert(data.team.map((m) => ({ obra_id: obra.id, user_id: m.user_id, role: m.role })));
      if (teamError) throw new Error(teamError.message);
    }

    if (data.comisiones.length > 0) {
      const { error: comError } = await supabase.from("obra_comisiones").insert(
        data.comisiones.map((c) => ({
          obra_id: obra.id,
          user_id: c.user_id,
          porcentaje: c.porcentaje,
          base_calculo: c.base_calculo,
        }))
      );
      if (comError) throw new Error(comError.message);
    }

    return { obraId: obra.id };
  });

export const listCompanyUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nombre_completo, email");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
