import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tipoPersona = z.enum(["moral", "fisica"]);
const categoria = z.enum(["proveedor", "contratista", "ambos"]);
const docTipo = z.enum([
  "constancia_fiscal",
  "opinion_sat",
  "domicilio_fiscal",
  "repse",
]);

const fieldsSchema = z.object({
  tipo_persona: tipoPersona,
  razon_social: z.string().trim().min(1).max(255),
  nombre_comercial: z.string().trim().max(255).nullable().optional(),
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
  codigo_postal: z.string().trim().max(5).nullable().optional(),
  telefono: z.string().trim().max(50).nullable().optional(),
  correo: z.string().trim().max(255).nullable().optional(),
  contacto_nombre: z.string().trim().max(255).nullable().optional(),
  contacto_telefono: z.string().trim().max(50).nullable().optional(),
  categoria: categoria,
  categoria_productos: z.string().trim().max(500).nullable().optional(),
  credito_disponible: z.number().min(0).nullable().optional(),
  dias_credito: z.number().int().min(0).max(365).nullable().optional(),
  requiere_factura: z.boolean().optional().default(true),
  banco: z.string().trim().max(100).nullable().optional(),
  clabe: z
    .string()
    .trim()
    .regex(/^\d{18}$/, "CLABE debe ser 18 dígitos")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  beneficiario: z.string().trim().max(255).nullable().optional(),
  retencion_iva: z.boolean().optional().default(false),
  retencion_iva_pct: z.number().min(0).max(100).nullable().optional(),
  retencion_isr: z.boolean().optional().default(false),
  retencion_isr_pct: z.number().min(0).max(100).nullable().optional(),
  tipo_trabajos: z.string().trim().max(1000).nullable().optional(),
  fondo_garantia: z.boolean().optional().default(false),
  fondo_garantia_pct: z.number().min(0).max(100).nullable().optional(),
  disponible_renta: z.boolean().optional().default(false),
});

const SELECT_FULL = "*";
const SELECT_LIST = "id, razon_social, nombre_comercial, rfc, tipo_persona, categoria, dias_credito, disponible_renta, estatus_autorizacion, creado_por";

async function getCtx(
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
export const listTerceros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().max(255).optional(),
        categoria: categoria.optional(),
        tipo_persona: tipoPersona.optional(),
      })
      .default({})
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("terceros").select(SELECT_LIST).order("razon_social");
    if (data.categoria) q = q.eq("categoria", data.categoria);
    if (data.tipo_persona) q = q.eq("tipo_persona", data.tipo_persona);
    if (data.search && data.search.length > 0) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`razon_social.ilike.%${s}%,nombre_comercial.ilike.%${s}%,rfc.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: { id: string }) => r.id);
    type DocRow = {
      id: string;
      tercero_id: string;
      tipo: string;
      url: string;
      fecha_vencimiento: string | null;
      created_at: string;
    };
    let docsByTercero: Record<string, DocRow[]> = {};
    if (ids.length > 0) {
      const { data: docs, error: dErr } = await supabase
        .from("terceros_documentos")
        .select("id, tercero_id, tipo, url, fecha_vencimiento, created_at")
        .in("tercero_id", ids);
      if (dErr) throw new Error(dErr.message);
      docsByTercero = ((docs ?? []) as DocRow[]).reduce(
        (acc: Record<string, DocRow[]>, d) => {
          (acc[d.tercero_id] ??= []).push(d);
          return acc;
        },
        {},
      );
    }

    return (rows ?? []).map((r: { id: string }) => ({
      ...r,
      documentos: docsByTercero[r.id] ?? [],
    }));
  });


// =============== GET ===============
export const getTercero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tercero, error } = await supabase
      .from("terceros")
      .select(SELECT_FULL)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tercero) throw new Error("Proveedor o contratista no encontrado");

    const { data: documentos, error: dErr } = await supabase
      .from("terceros_documentos")
      .select("id, tipo, url, fecha_vencimiento, created_at")
      .eq("tercero_id", data.id)
      .order("created_at", { ascending: false });
    if (dErr) throw new Error(dErr.message);

    return { tercero, documentos: documentos ?? [] };
  });

function buildPayload(data: z.infer<typeof fieldsSchema>) {
  return {
    tipo_persona: data.tipo_persona,
    razon_social: data.razon_social,
    nombre_comercial: data.nombre_comercial?.trim() || null,
    rfc: data.rfc.toUpperCase(),
    curp:
      data.tipo_persona === "fisica" ? (data.curp?.toUpperCase() ?? null) : null,
    regimen_fiscal: data.regimen_fiscal ?? null,
    calle: data.calle ?? null,
    numero_exterior: data.numero_exterior ?? null,
    numero_interior: data.numero_interior ?? null,
    colonia: data.colonia ?? null,
    municipio: data.municipio ?? null,
    estado: data.estado ?? null,
    codigo_postal: data.codigo_postal ?? null,
    telefono: data.telefono ?? null,
    correo: data.correo ?? null,
    contacto_nombre:
      data.tipo_persona === "moral" ? (data.contacto_nombre ?? null) : null,
    contacto_telefono:
      data.tipo_persona === "moral" ? (data.contacto_telefono ?? null) : null,
    categoria: data.categoria,
    categoria_productos:
      data.categoria === "contratista" ? null : (data.categoria_productos ?? null),
    credito_disponible: data.credito_disponible ?? null,
    dias_credito: data.dias_credito ?? null,
    requiere_factura: data.requiere_factura ?? true,
    banco: data.banco ?? null,
    clabe: data.clabe ?? null,
    beneficiario: data.beneficiario ?? null,
    retencion_iva: data.retencion_iva ?? false,
    retencion_iva_pct: data.retencion_iva ? (data.retencion_iva_pct ?? null) : null,
    retencion_isr: data.retencion_isr ?? false,
    retencion_isr_pct: data.retencion_isr ? (data.retencion_isr_pct ?? null) : null,
    tipo_trabajos:
      data.categoria === "proveedor" ? null : (data.tipo_trabajos ?? null),
    fondo_garantia:
      data.categoria === "proveedor" ? false : (data.fondo_garantia ?? false),
    fondo_garantia_pct:
      data.categoria === "proveedor"
        ? null
        : data.fondo_garantia
          ? (data.fondo_garantia_pct ?? null)
          : null,
    disponible_renta:
      data.categoria === "contratista" ? false : !!data.disponible_renta,
  };
}

// =============== CREATE ===============
export const crearTercero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fieldsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertCanManage(roles);

    const rfcUpper = data.rfc.toUpperCase();
    const { data: dup } = await supabase
      .from("terceros")
      .select("id")
      .eq("company_id", companyId)
      .eq("rfc", rfcUpper)
      .maybeSingle();
    if (dup) throw new Error(`Ya existe un proveedor o contratista con RFC ${rfcUpper}`);

    const payload = {
      company_id: companyId,
      creado_por: userId,
      ...buildPayload(data),
    };

    const { data: tercero, error } = await supabase
      .from("terceros")
      .insert(payload)
      .select(SELECT_FULL)
      .single();
    if (error) throw new Error(error.message);
    return tercero;
  });

// =============== UPDATE ===============
export const actualizarTercero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    fieldsSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getCtx(supabase, userId);
    assertCanManage(roles);

    const rfcUpper = data.rfc.toUpperCase();
    const { data: dup } = await supabase
      .from("terceros")
      .select("id")
      .eq("company_id", companyId)
      .eq("rfc", rfcUpper)
      .neq("id", data.id)
      .maybeSingle();
    if (dup) throw new Error(`Ya existe otro proveedor o contratista con RFC ${rfcUpper}`);

    const { error } = await supabase
      .from("terceros")
      .update(buildPayload(data))
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== DELETE ===============
export const eliminarTercero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getCtx(supabase, userId);
    assertCanManage(roles);

    // TODO: cuando existan órdenes de compra y subcontratos, validar
    // que no haya documentos vinculados antes de eliminar.

    const { error } = await supabase.from("terceros").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== UPLOAD DOC ===============
export const subirDocumentoTercero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tercero_id: z.string().uuid(),
        tipo: docTipo,
        path: z.string().min(1).max(1000),
        fecha_vencimiento: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getCtx(supabase, userId);
    assertCanManage(roles);

    const { error } = await supabase
      .from("terceros_documentos")
      .upsert(
        {
          tercero_id: data.tercero_id,
          tipo: data.tipo,
          url: data.path,
          fecha_vencimiento: data.fecha_vencimiento || null,
        },
        { onConflict: "tercero_id,tipo" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== DELETE DOC ===============
export const eliminarDocumentoTercero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tercero_id: z.string().uuid(),
        tipo: docTipo,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getCtx(supabase, userId);
    assertCanManage(roles);

    const { error } = await supabase
      .from("terceros_documentos")
      .delete()
      .eq("tercero_id", data.tercero_id)
      .eq("tipo", data.tipo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== ESTADO DE CUENTA (PROVEEDOR) ===============
export type EstadoCuentaMovimiento = {
  fecha: string;
  tipo: "cargo" | "abono";
  folio: string;
  concepto: string;
  referencia: string | null;
  obraNombre: string | null;
  ocId: string | null;
  ocFolio: string | null;
  cargo: number;
  abono: number;
  saldo: number;
};

export const getEstadoCuentaProveedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ terceroId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);

    // OCs del proveedor (cargos)
    const { data: ocs, error: ocsErr } = await supabase
      .from("ordenes_compra")
      .select("id, folio, created_at, total, monto_pagado, estado_pago, obra:obras(id, nombre)")
      .eq("company_id", companyId)
      .eq("proveedor_id", data.terceroId)
      .in("estatus", ["autorizada", "enviada", "recibida_parcial", "recibida"]);
    if (ocsErr) throw new Error(ocsErr.message);

    const ocList = (ocs ?? []) as Array<{
      id: string;
      folio: string;
      created_at: string;
      total: number | string;
      monto_pagado: number | string;
      estado_pago: string;
      obra: { id: string; nombre: string } | null;
    }>;

    const ocIds = ocList.map((o) => o.id);
    let pagosList: Array<{
      id: string;
      fecha: string;
      monto: number | string;
      metodo: string;
      referencia: string | null;
      origen_id: string;
      cuenta: { nombre: string } | null;
    }> = [];

    if (ocIds.length > 0) {
      const { data: pagos, error: pagosErr } = await supabase
        .from("pagos")
        .select("id, fecha, monto, metodo, referencia, origen_id, cuenta:cuentas(nombre)")
        .eq("company_id", companyId)
        .eq("origen_tipo", "oc")
        .is("cancelado_at", null)
        .in("origen_id", ocIds);
      if (pagosErr) throw new Error(pagosErr.message);
      pagosList = (pagos ?? []) as typeof pagosList;
    }

    const ocById = new Map(ocList.map((o) => [o.id, o]));

    type Mov = Omit<EstadoCuentaMovimiento, "saldo">;
    const movs: Mov[] = [];

    for (const oc of ocList) {
      movs.push({
        fecha: oc.created_at,
        tipo: "cargo",
        folio: oc.folio,
        concepto: `Orden de compra${oc.obra?.nombre ? ` · ${oc.obra.nombre}` : ""}`,
        referencia: null,
        obraNombre: oc.obra?.nombre ?? null,
        ocId: oc.id,
        ocFolio: oc.folio,
        cargo: Number(oc.total) || 0,
        abono: 0,
      });
    }
    for (const p of pagosList) {
      const oc = ocById.get(p.origen_id);
      movs.push({
        fecha: p.fecha,
        tipo: "abono",
        folio: oc?.folio ?? "—",
        concepto: `Pago ${p.metodo}${p.cuenta?.nombre ? ` · ${p.cuenta.nombre}` : ""}${oc?.folio ? ` · ${oc.folio}` : ""}`,
        referencia: p.referencia,
        obraNombre: oc?.obra?.nombre ?? null,
        ocId: oc?.id ?? null,
        ocFolio: oc?.folio ?? null,
        cargo: 0,
        abono: Number(p.monto) || 0,
      });
    }

    movs.sort((a, b) => {
      if (a.fecha === b.fecha) {
        // cargos antes que abonos del mismo día
        return a.tipo === b.tipo ? 0 : a.tipo === "cargo" ? -1 : 1;
      }
      return a.fecha < b.fecha ? -1 : 1;
    });

    let saldo = 0;
    const movimientos: EstadoCuentaMovimiento[] = movs.map((m) => {
      saldo += m.cargo - m.abono;
      return { ...m, saldo: +saldo.toFixed(2) };
    });

    const totalOrdenado = ocList.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const totalPagado = pagosList.reduce((s, p) => s + (Number(p.monto) || 0), 0);

    return {
      totales: {
        ordenado: +totalOrdenado.toFixed(2),
        pagado: +totalPagado.toFixed(2),
        saldo: +(totalOrdenado - totalPagado).toFixed(2),
      },
      movimientos,
    };
  });

