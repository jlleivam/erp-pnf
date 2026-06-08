import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tipoEnum = z.enum(["bancaria", "caja_fuerte"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCompanyId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa");
  return profile.company_id as string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureRole(supabase: any, userId: string, companyId: string, roles: string[]): Promise<void> {
  const { data: rows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .in("role", roles);
  if (!rows || rows.length === 0) {
    throw new Error("No tienes permisos para esta acción");
  }
}

export const listCuentas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    await ensureRole(supabase, userId, companyId, ["director", "administrativo"]);

    const { data, error } = await supabase
      .from("cuentas")
      .select("id, nombre, tipo, moneda, banco, numero_cuenta, clabe, saldo_inicial, saldo_actual, activa, notas, created_at")
      .eq("company_id", companyId)
      .order("activa", { ascending: false })
      .order("nombre");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const crearSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  tipo: tipoEnum,
  moneda: z.string().trim().min(3).max(3).default("MXN"),
  banco: z.string().trim().max(120).optional().nullable(),
  numero_cuenta: z.string().trim().max(60).optional().nullable(),
  clabe: z.string().trim().max(40).optional().nullable(),
  saldo_inicial: z.number().min(0),
  notas: z.string().trim().max(500).optional().nullable(),
});

export const crearCuenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => crearSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    await ensureRole(supabase, userId, companyId, ["director"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isCaja = data.tipo === "caja_fuerte";
    const insert = {
      company_id: companyId,
      nombre: data.nombre,
      tipo: data.tipo,
      moneda: data.moneda || "MXN",
      banco: isCaja ? null : (data.banco || null),
      numero_cuenta: isCaja ? null : (data.numero_cuenta || null),
      clabe: isCaja ? null : (data.clabe || null),
      saldo_inicial: data.saldo_inicial,
      saldo_actual: data.saldo_inicial,
      notas: data.notas || null,
      created_by: userId,
    };

    const { data: cuenta, error } = await supabaseAdmin
      .from("cuentas")
      .insert(insert)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.saldo_inicial > 0) {
      const { error: movErr } = await supabaseAdmin
        .from("cuenta_movimientos")
        .insert({
          cuenta_id: cuenta.id,
          company_id: companyId,
          tipo: "ingreso",
          monto: data.saldo_inicial,
          concepto: "Apertura de cuenta",
          origen: "apertura",
          creado_por: userId,
        });
      if (movErr) {
        // rollback
        await supabaseAdmin.from("cuentas").delete().eq("id", cuenta.id);
        throw new Error(movErr.message);
      }
    }

    return { id: cuenta.id };
  });

const actualizarSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().trim().min(1).max(120),
  banco: z.string().trim().max(120).optional().nullable(),
  numero_cuenta: z.string().trim().max(60).optional().nullable(),
  clabe: z.string().trim().max(40).optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
});

export const actualizarCuenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => actualizarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    await ensureRole(supabase, userId, companyId, ["director"]);

    const { error } = await supabase
      .from("cuentas")
      .update({
        nombre: data.nombre,
        banco: data.banco || null,
        numero_cuenta: data.numero_cuenta || null,
        clabe: data.clabe || null,
        notas: data.notas || null,
      })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCuentaActiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), activa: z.boolean() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    await ensureRole(supabase, userId, companyId, ["director"]);

    const { error } = await supabase
      .from("cuentas")
      .update({ activa: data.activa })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMovimientos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cuentaId: z.string().uuid(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getCompanyId(supabase, userId);
    await ensureRole(supabase, userId, companyId, ["director", "administrativo"]);

    let q = supabase
      .from("cuenta_movimientos")
      .select("id, fecha, tipo, monto, concepto, referencia, origen, creado_por, created_at")
      .eq("cuenta_id", data.cuentaId)
      .eq("company_id", companyId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.from) q = q.gte("fecha", data.from);
    if (data.to) q = q.lte("fecha", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
