import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Schema for all editable cliente fields
const datosContactoSchema = z
  .object({
    nombre_contacto: z.string().trim().max(255).optional().default(""),
    email: z.string().trim().max(255).optional().default(""),
    telefono: z.string().trim().max(50).optional().default(""),
  })
  .optional();

const clienteFieldsSchema = z.object({
  tipo_persona: z.enum(["moral", "fisica"]),
  razon_social: z.string().trim().min(1).max(255),
  rfc: z
    .string()
    .trim()
    .min(12)
    .max(13)
    .regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i, "RFC con formato inválido"),
  regimen_fiscal: z.string().trim().max(255).nullable().optional(),
  direccion_fiscal: z.string().trim().max(1000).nullable().optional(),
  telefono: z.string().trim().max(50).nullable().optional(),
  correo: z.string().trim().max(255).nullable().optional(),
  contacto_nombre: z.string().trim().max(255).nullable().optional(),
  contacto_telefono: z.string().trim().max(50).nullable().optional(),
  curp: z.string().trim().max(18).nullable().optional(),
  condiciones_pago: z.number().int().min(0).max(365).nullable().optional(),
  limite_credito: z.number().min(0).nullable().optional(),
  banco: z.string().trim().max(100).nullable().optional(),
  clabe: z
    .string()
    .trim()
    .regex(/^\d{18}$/, "CLABE debe ser 18 dígitos")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  beneficiario: z.string().trim().max(255).nullable().optional(),
  // Kept for backward compat with quick-create from obra form
  datos_contacto: datosContactoSchema,
});

const SELECT_FULL =
  "id, company_id, tipo_persona, razon_social, rfc, regimen_fiscal, direccion_fiscal, telefono, correo, contacto_nombre, contacto_telefono, curp, condiciones_pago, limite_credito, banco, clabe, beneficiario, constancia_fiscal_url, constancia_fiscal_vencimiento, opinion_sat_url, opinion_sat_vencimiento, datos_contacto, created_at";

const SELECT_LIST =
  "id, tipo_persona, razon_social, rfc, telefono, correo, datos_contacto, constancia_fiscal_url, constancia_fiscal_vencimiento, opinion_sat_url, opinion_sat_vencimiento";

async function getMyContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<{ companyId: string; roles: string[] }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", profile.company_id);
  const roles = ((roleRows ?? []) as Array<{ role: string }>).map((r) => r.role);
  return { companyId: profile.company_id as string, roles };
}

function assertCanManage(roles: string[]) {
  if (!roles.includes("director") && !roles.includes("administrativo")) {
    throw new Error("No tienes permisos para esta acción");
  }
}

// =============== LIST ===============
export const listClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])

  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().max(255).optional(),
        tipo_persona: z.enum(["moral", "fisica"]).optional(),
      })
      .default({})
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("clientes").select(SELECT_LIST).order("razon_social");
    if (data.tipo_persona) q = q.eq("tipo_persona", data.tipo_persona);
    if (data.search && data.search.length > 0) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`razon_social.ilike.%${s}%,rfc.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// =============== GET (detail) ===============
export const getCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select(SELECT_FULL)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cliente) throw new Error("Cliente no encontrado");

    const { data: obrasRows, error: oErr } = await supabase
      .from("obras")
      .select("id, nombre, numero_contrato, fecha_inicio, fecha_terminacion, monto_contratado")
      .eq("cliente_id", data.id)
      .order("created_at", { ascending: false });
    if (oErr) throw new Error(oErr.message);

    const obras = obrasRows ?? [];
    const monto_total_contratado = obras.reduce(
      (acc, o) => acc + (Number(o.monto_contratado) || 0),
      0,
    );

    return { cliente, obras, monto_total_contratado };
  });

// =============== CREATE ===============
export const crearCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => clienteFieldsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getMyContext(supabase, userId);
    assertCanManage(roles);

    const rfcUpper = data.rfc.toUpperCase();

    // RFC unique per company
    const { data: dup } = await supabase
      .from("clientes")
      .select("id")
      .eq("company_id", companyId)
      .eq("rfc", rfcUpper)
      .maybeSingle();
    if (dup) throw new Error(`Ya existe un cliente con RFC ${rfcUpper}`);

    const insertPayload = {
      company_id: companyId,
      tipo_persona: data.tipo_persona,
      razon_social: data.razon_social,
      rfc: rfcUpper,
      regimen_fiscal: data.regimen_fiscal ?? null,
      direccion_fiscal: data.direccion_fiscal ?? null,
      telefono: data.telefono ?? null,
      correo: data.correo ?? null,
      contacto_nombre: data.tipo_persona === "moral" ? (data.contacto_nombre ?? null) : null,
      contacto_telefono: data.tipo_persona === "moral" ? (data.contacto_telefono ?? null) : null,
      curp: data.tipo_persona === "fisica" ? (data.curp ?? null) : null,
      condiciones_pago: data.condiciones_pago ?? null,
      limite_credito: data.limite_credito ?? null,
      banco: data.banco ?? null,
      clabe: data.clabe ?? null,
      beneficiario: data.beneficiario ?? null,
      datos_contacto: data.datos_contacto ?? {},
    };

    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert(insertPayload)
      .select(SELECT_FULL)
      .single();
    if (error) throw new Error(error.message);
    return cliente;
  });

// =============== UPDATE ===============
export const actualizarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    clienteFieldsSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getMyContext(supabase, userId);
    assertCanManage(roles);

    const rfcUpper = data.rfc.toUpperCase();
    const { data: dup } = await supabase
      .from("clientes")
      .select("id")
      .eq("company_id", companyId)
      .eq("rfc", rfcUpper)
      .neq("id", data.id)
      .maybeSingle();
    if (dup) throw new Error(`Ya existe otro cliente con RFC ${rfcUpper}`);

    const updatePayload = {
      tipo_persona: data.tipo_persona,
      razon_social: data.razon_social,
      rfc: rfcUpper,
      regimen_fiscal: data.regimen_fiscal ?? null,
      direccion_fiscal: data.direccion_fiscal ?? null,
      telefono: data.telefono ?? null,
      correo: data.correo ?? null,
      contacto_nombre: data.tipo_persona === "moral" ? (data.contacto_nombre ?? null) : null,
      contacto_telefono: data.tipo_persona === "moral" ? (data.contacto_telefono ?? null) : null,
      curp: data.tipo_persona === "fisica" ? (data.curp ?? null) : null,
      condiciones_pago: data.condiciones_pago ?? null,
      limite_credito: data.limite_credito ?? null,
      banco: data.banco ?? null,
      clabe: data.clabe ?? null,
      beneficiario: data.beneficiario ?? null,
    };

    const { error } = await supabase
      .from("clientes")
      .update(updatePayload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== DELETE ===============
export const eliminarCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getMyContext(supabase, userId);
    assertCanManage(roles);

    const { count, error: cErr } = await supabase
      .from("obras")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", data.id);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) {
      throw new Error(
        `No se puede eliminar: el cliente tiene ${count} obra(s) vinculada(s).`,
      );
    }

    const { error } = await supabase.from("clientes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== UPLOAD DOCUMENT (record metadata) ===============
export const subirDocumentoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        tipo: z.enum(["constancia", "opinion"]),
        path: z.string().min(1).max(1000),
        vencimiento: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getMyContext(supabase, userId);
    assertCanManage(roles);

    const payload =
      data.tipo === "constancia"
        ? {
            constancia_fiscal_url: data.path,
            constancia_fiscal_vencimiento: data.vencimiento || null,
          }
        : {
            opinion_sat_url: data.path,
            opinion_sat_vencimiento: data.vencimiento || null,
          };

    const { error } = await supabase
      .from("clientes")
      .update(payload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== DELETE DOCUMENT METADATA ===============
export const eliminarDocumentoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        tipo: z.enum(["constancia", "opinion"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getMyContext(supabase, userId);
    assertCanManage(roles);

    const payload =
      data.tipo === "constancia"
        ? { constancia_fiscal_url: null, constancia_fiscal_vencimiento: null }
        : { opinion_sat_url: null, opinion_sat_vencimiento: null };

    const { error } = await supabase
      .from("clientes")
      .update(payload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
