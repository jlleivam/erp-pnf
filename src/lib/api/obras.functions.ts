import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requirePermission } from "@/lib/permisos/require";


export const listObras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("obras")
      .select(
        "id, nombre, unidad_negocio:unidades_negocio(id, nombre), numero_contrato, ubicacion, fecha_inicio, fecha_terminacion, cliente:clientes(razon_social)"
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
        "id, nombre, unidad_negocio:unidades_negocio(id, nombre), numero_contrato, ubicacion, fecha_inicio, fecha_terminacion, presupuesto_url, cliente:clientes(id, razon_social, rfc, tipo_persona)"
      )
      .eq("id", data.obraId)
      .maybeSingle();
    if (obraError) throw new Error(obraError.message);
    if (!obra) throw new Error("Obra no encontrada");

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
  unidad_negocio_id: z.string().uuid(),
  cliente_id: z.string().uuid().nullable(),
  numero_contrato: z.string().trim().max(100).optional(),
  ubicacion: z.string().trim().max(500).optional(),
  fecha_inicio: z.string().optional(),
  fecha_terminacion: z.string().optional(),
  presupuesto_url: z.string().max(1000).nullable().optional(),



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
        base_calculo: z.enum(["monto_contratado", "monto_cobrado", "utilidad"]),
      })
    )
    .default([]),
});

export const crearObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => crearObraSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "obras.crear");

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
        unidad_negocio_id: data.unidad_negocio_id,
        cliente_id: data.cliente_id,
        numero_contrato: data.numero_contrato || null,
        ubicacion: data.ubicacion || null,
        fecha_inicio: data.fecha_inicio || null,
        fecha_terminacion: data.fecha_terminacion || null,
        presupuesto_url: data.presupuesto_url || null,
        monto_contratado: null,
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

// ============================================================
// Edición de obra (permiso `obras.editar` / `obras.asignar_team`)
// ============================================================

export const getObraConfiguracion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ obraId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requirePermission(supabase, userId, "obras.editar");


    const { data: obra, error } = await supabase
      .from("obras")
      .select(
        "id, nombre, unidad_negocio_id, cliente_id, numero_contrato, ubicacion, fecha_inicio, fecha_terminacion, presupuesto_url, monto_contratado"
      )
      .eq("id", data.obraId)
      .single();
    if (error) throw new Error(error.message);

    const { data: team, error: tErr } = await supabase
      .from("obra_team")
      .select("user_id, role")
      .eq("obra_id", data.obraId);
    if (tErr) throw new Error(tErr.message);

    const { data: comisiones, error: cErr } = await supabase
      .from("obra_comisiones")
      .select("user_id, porcentaje, base_calculo")
      .eq("obra_id", data.obraId);
    if (cErr) throw new Error(cErr.message);

    return { obra, team: team ?? [], comisiones: comisiones ?? [] };
  });

const actualizarObraSchema = z.object({
  obraId: z.string().uuid(),
  nombre: z.string().trim().min(1).max(255),
  unidad_negocio_id: z.string().uuid(),
  cliente_id: z.string().uuid().nullable(),
  numero_contrato: z.string().trim().max(100).nullable().optional(),
  ubicacion: z.string().trim().max(500).nullable().optional(),
  fecha_inicio: z.string().nullable().optional(),
  fecha_terminacion: z.string().nullable().optional(),
  presupuesto_url: z.string().max(1000).nullable().optional(),
});

export const actualizarObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actualizarObraSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertDirectorDeObra(supabase, userId, data.obraId);

    const { error } = await supabase
      .from("obras")
      .update({
        nombre: data.nombre,
        unidad_negocio_id: data.unidad_negocio_id,
        cliente_id: data.cliente_id,
        numero_contrato: data.numero_contrato ?? null,
        ubicacion: data.ubicacion ?? null,
        fecha_inicio: data.fecha_inicio ?? null,
        fecha_terminacion: data.fecha_terminacion ?? null,
        presupuesto_url: data.presupuesto_url ?? null,
      })
      .eq("id", data.obraId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const actualizarObraTeamSchema = z.object({
  obraId: z.string().uuid(),
  team: z.array(
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["director", "residente", "auxiliar", "administrativo", "supervisor"]),
    })
  ),
});

export const actualizarObraTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actualizarObraTeamSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertDirectorDeObra(supabase, userId, data.obraId);

    const roles = new Set(data.team.map((m) => m.role));
    if (!roles.has("residente") || !roles.has("administrativo") || !roles.has("supervisor")) {
      throw new Error("Se requiere mínimo un Residente, un Administrativo y un Supervisor");
    }

    const { error: delErr } = await supabase
      .from("obra_team")
      .delete()
      .eq("obra_id", data.obraId);
    if (delErr) throw new Error(delErr.message);

    if (data.team.length > 0) {
      const { error: insErr } = await supabase
        .from("obra_team")
        .insert(data.team.map((m) => ({ obra_id: data.obraId, user_id: m.user_id, role: m.role })));
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

const actualizarObraComisionesSchema = z.object({
  obraId: z.string().uuid(),
  comisiones: z.array(
    z.object({
      user_id: z.string().uuid(),
      porcentaje: z.number().min(0).max(100),
      base_calculo: z.enum(["monto_contratado", "monto_cobrado", "utilidad"]),
    })
  ),
});

export const actualizarObraComisiones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => actualizarObraComisionesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertDirectorDeObra(supabase, userId, data.obraId);

    const { error: delErr } = await supabase
      .from("obra_comisiones")
      .delete()
      .eq("obra_id", data.obraId);
    if (delErr) throw new Error(delErr.message);

    if (data.comisiones.length > 0) {
      const { error: insErr } = await supabase.from("obra_comisiones").insert(
        data.comisiones.map((c) => ({
          obra_id: data.obraId,
          user_id: c.user_id,
          porcentaje: c.porcentaje,
          base_calculo: c.base_calculo,
        }))
      );
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

