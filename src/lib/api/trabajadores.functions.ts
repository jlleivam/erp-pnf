import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SEXO = z.enum(["masculino", "femenino"]);
const TIPO_CONTRATO = z.enum(["eventual_urbano", "eventual_campo", "permanente"]);
const IMSS_ESTATUS = z.enum(["alta_activa", "sin_alta", "en_tramite", "baja"]);
const AUTORIZACION = z.enum(["autorizado", "pendiente"]);
const DOC_TIPO = z.enum(["ine", "curp", "domicilio", "contrato"]);
const PUESTO = z.enum([
  "oficial",
  "ayudante",
  "operador_maquinaria",
  "sobrestante",
  "residente",
  "auxiliar",
  "administrativo",
]);

const trabajadorFieldsSchema = z.object({
  nombres: z.string().trim().min(1).max(120),
  apellido_paterno: z.string().trim().min(1).max(120),
  apellido_materno: z.string().trim().min(1).max(120),
  telefono: z.string().trim().max(50).nullable().optional(),
  correo: z.string().trim().max(255).nullable().optional(),
  direccion: z.string().trim().max(1000).nullable().optional(),
  curp: z
    .string()
    .trim()
    .max(18)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  nss: z.string().trim().max(20).nullable().optional(),
  rfc: z.string().trim().max(13).nullable().optional(),
  fecha_nacimiento: z.string().nullable().optional(),
  sexo: SEXO.nullable().optional(),
  estado_civil: z.string().trim().max(50).nullable().optional(),
  puesto: PUESTO,
  sueldo_diario: z.number().positive(),
  tipo_contrato: TIPO_CONTRATO.nullable().optional(),
  fecha_ingreso: z.string().nullable().optional(),
  fecha_baja: z.string().nullable().optional(),
  imss_estatus: IMSS_ESTATUS.optional().default("sin_alta"),
  imss_fecha_alta: z.string().nullable().optional(),
  imss_nss: z.string().trim().max(20).nullable().optional(),
  imss_sbc: z.number().min(0).nullable().optional(),
  imss_tipo_trabajador: z.string().trim().max(100).nullable().optional(),
});

const SELECT_LIST =
  "id, nombre_completo, nombres, apellido_paterno, apellido_materno, curp, nss, puesto, imss_estatus, estatus_autorizacion, fecha_ingreso, trabajadores_documentos(tipo, fecha_vencimiento, url)";

const SELECT_FULL =
  "id, company_id, nombre_completo, nombres, apellido_paterno, apellido_materno, telefono, correo, direccion, curp, nss, rfc, fecha_nacimiento, sexo, estado_civil, puesto, sueldo_diario, tipo_contrato, fecha_ingreso, fecha_baja, imss_estatus, imss_fecha_alta, imss_nss, imss_sbc, imss_tipo_trabajador, estatus_autorizacion, creado_por, created_at";

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

function canManage(roles: string[]) {
  return roles.includes("director") || roles.includes("administrativo");
}
function canRequest(roles: string[]) {
  return (
    canManage(roles) || roles.includes("residente") || roles.includes("auxiliar")
  );
}

function calcDocsEstado(
  docs: Array<{ tipo: string; fecha_vencimiento: string | null; url: string | null }>,
): "al_dia" | "por_vencer" | "vencido_o_faltante" {
  const required = ["ine", "curp", "domicilio", "contrato"] as const;
  const byTipo = new Map(docs.filter((d) => d.url).map((d) => [d.tipo, d]));
  for (const r of required) {
    if (!byTipo.has(r)) return "vencido_o_faltante";
  }
  const ine = byTipo.get("ine");
  if (ine?.fecha_vencimiento) {
    const ms = new Date(ine.fecha_vencimiento).getTime();
    if (!isNaN(ms)) {
      const dias = Math.floor((ms - Date.now()) / (1000 * 60 * 60 * 24));
      if (dias < 0) return "vencido_o_faltante";
      if (dias <= 30) return "por_vencer";
    }
  }
  return "al_dia";
}

// =============== LIST ===============
export const listTrabajadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().max(255).optional(),
        imss_estatus: IMSS_ESTATUS.optional(),
        puesto: PUESTO.optional(),
        solo_pendientes: z.boolean().optional(),
      })
      .default({})
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("trabajadores").select(SELECT_LIST).order("nombre_completo");
    if (data.imss_estatus) q = q.eq("imss_estatus", data.imss_estatus);
    if (data.puesto) q = q.eq("puesto", data.puesto);
    if (data.solo_pendientes) q = q.eq("estatus_autorizacion", "pendiente");
    if (data.search && data.search.length > 0) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(
        `nombre_completo.ilike.%${s}%,curp.ilike.%${s}%,nss.ilike.%${s}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => ({
        ...r,
        documentos_estado: calcDocsEstado(r.trabajadores_documentos ?? []),
      }),
    );
  });

// =============== GET (detail) ===============
export const getTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: trabajador, error } = await supabase
      .from("trabajadores")
      .select(SELECT_FULL)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!trabajador) throw new Error("Trabajador no encontrado");

    const { data: docs, error: dErr } = await supabase
      .from("trabajadores_documentos")
      .select("id, tipo, url, fecha_vencimiento, created_at")
      .eq("trabajador_id", data.id);
    if (dErr) throw new Error(dErr.message);

    return { trabajador, documentos: docs ?? [] };
  });

// =============== CREATE ===============
export const crearTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    trabajadorFieldsSchema.extend({ obraId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getMyContext(supabase, userId);
    if (!canRequest(roles)) {
      throw new Error("No tienes permisos para esta acción");
    }

    const curp = data.curp ? data.curp.toUpperCase() : null;
    if (curp) {
      const { data: dup } = await supabase
        .from("trabajadores")
        .select("id")
        .eq("company_id", companyId)
        .eq("curp", curp)
        .maybeSingle();
      if (dup) throw new Error(`Ya existe un trabajador con CURP ${curp}`);
    }

    const estatus_autorizacion: "autorizado" | "pendiente" = canManage(roles)
      ? "autorizado"
      : "pendiente";

    const nombreCompleto = [data.nombres, data.apellido_paterno, data.apellido_materno]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" ");

    const insertPayload = {
      company_id: companyId,
      nombre_completo: nombreCompleto,
      nombres: data.nombres,
      apellido_paterno: data.apellido_paterno,
      apellido_materno: data.apellido_materno ?? null,
      telefono: data.telefono ?? null,
      correo: data.correo ?? null,
      direccion: data.direccion ?? null,
      curp,
      nss: data.nss ?? null,
      rfc: data.rfc ? data.rfc.toUpperCase() : null,
      fecha_nacimiento: data.fecha_nacimiento || null,
      sexo: data.sexo ?? null,
      estado_civil: data.estado_civil ?? null,
      puesto: data.puesto ?? null,
      sueldo_diario: data.sueldo_diario ?? null,
      tipo_contrato: data.tipo_contrato ?? null,
      fecha_ingreso: data.fecha_ingreso || null,
      fecha_baja: data.fecha_baja || null,
      imss_estatus: data.imss_estatus ?? "sin_alta",
      imss_fecha_alta: data.imss_fecha_alta || null,
      imss_nss: data.imss_nss ?? null,
      imss_sbc: data.imss_sbc ?? null,
      imss_tipo_trabajador: data.imss_tipo_trabajador ?? null,
      estatus_autorizacion,
      creado_por: userId,
    };

    const { data: trabajador, error } = await supabase
      .from("trabajadores")
      .insert(insertPayload)
      .select(SELECT_FULL)
      .single();
    if (error) throw new Error(error.message);

    // Notificar cuando la solicitud queda pendiente de autorización
    if (estatus_autorizacion === "pendiente") {
      try {
        const destSet = new Set<string>();

        if (data.obraId) {
          // Solicitud desde una obra: solo administrativos asignados a esa obra
          const { data: admins } = await supabase
            .from("obra_team")
            .select("user_id")
            .eq("obra_id", data.obraId)
            .eq("role", "administrativo");
          (admins ?? []).forEach((a: any) => destSet.add(a.user_id as string));
        } else {
          // Solicitud desde el catálogo general: directores y administrativos de la empresa
          const { data: companyRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("company_id", companyId)
            .in("role", ["director", "administrativo"]);
          (companyRoles ?? []).forEach((r: any) => destSet.add(r.user_id as string));
        }


        destSet.delete(userId);
        const destinatarios = Array.from(destSet);

        if (destinatarios.length > 0) {
          const { data: solicitanteProfile } = await supabase
            .from("profiles")
            .select("nombre_completo")
            .eq("id", userId)
            .maybeSingle();
          const quien = solicitanteProfile?.nombre_completo ?? "Un residente";
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error: notifErr } = await supabaseAdmin.from("notificaciones").insert(
            destinatarios.map((uid) => ({
              user_id: uid,
              company_id: companyId,
              obra_id: data.obraId ?? null,
              tipo: "trabajador_alta_solicitada",
              titulo: "Solicitud de alta de trabajador",
              mensaje: `${quien} solicitó dar de alta a ${nombreCompleto}. Requiere autorización.`,
              link: `/app/catalogos/trabajadores?tab=pendientes&id=${trabajador.id}`,
            })),
          );
          if (notifErr) console.error("[notificaciones] insert failed", notifErr.message);
        }
      } catch (e: any) {
        console.error("[notificaciones] trabajador_alta_solicitada error", e?.message);
      }
    }


    return trabajador;
  });

// =============== UPDATE ===============
export const actualizarTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    trabajadorFieldsSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, roles } = await getMyContext(supabase, userId);
    if (!canManage(roles)) throw new Error("No tienes permisos para esta acción");

    const curp = data.curp ? data.curp.toUpperCase() : null;
    if (curp) {
      const { data: dup } = await supabase
        .from("trabajadores")
        .select("id")
        .eq("company_id", companyId)
        .eq("curp", curp)
        .neq("id", data.id)
        .maybeSingle();
      if (dup) throw new Error(`Ya existe otro trabajador con CURP ${curp}`);
    }

    const updatePayload = {
      nombre_completo: [data.nombres, data.apellido_paterno, data.apellido_materno]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join(" "),
      nombres: data.nombres,
      apellido_paterno: data.apellido_paterno,
      apellido_materno: data.apellido_materno ?? null,
      telefono: data.telefono ?? null,
      correo: data.correo ?? null,
      direccion: data.direccion ?? null,
      curp,
      nss: data.nss ?? null,
      rfc: data.rfc ? data.rfc.toUpperCase() : null,
      fecha_nacimiento: data.fecha_nacimiento || null,
      sexo: data.sexo ?? null,
      estado_civil: data.estado_civil ?? null,
      puesto: data.puesto ?? null,
      sueldo_diario: data.sueldo_diario ?? null,
      tipo_contrato: data.tipo_contrato ?? null,
      fecha_ingreso: data.fecha_ingreso || null,
      fecha_baja: data.fecha_baja || null,
      imss_estatus: data.imss_estatus ?? "sin_alta",
      imss_fecha_alta: data.imss_fecha_alta || null,
      imss_nss: data.imss_nss ?? null,
      imss_sbc: data.imss_sbc ?? null,
      imss_tipo_trabajador: data.imss_tipo_trabajador ?? null,
    };

    const { error } = await supabase
      .from("trabajadores")
      .update(updatePayload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== AUTORIZAR ===============
export const autorizarTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getMyContext(supabase, userId);
    if (!canManage(roles)) throw new Error("No tienes permisos para esta acción");

    const { data: tr } = await supabase
      .from("trabajadores")
      .select("creado_por, nombre_completo, company_id")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabase
      .from("trabajadores")
      .update({ estatus_autorizacion: "autorizado" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (tr?.creado_por && tr.creado_por !== userId) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: notifErr } = await supabaseAdmin.from("notificaciones").insert({
          user_id: tr.creado_por,
          company_id: tr.company_id,
          tipo: "trabajador_alta_autorizada",
          titulo: "Trabajador registrado",
          mensaje: `${tr.nombre_completo} ya fue registrado. Ya puedes asignarlo a la nómina semanal.`,
          link: `/app/catalogos/trabajadores?id=${data.id}`,
        });
        if (notifErr) console.error("[notificaciones] autorizado insert failed", notifErr.message);
      } catch (e: any) {
        console.error("[notificaciones] trabajador_alta_autorizada error", e?.message);
      }
    }

    return { ok: true };
  });

// =============== DELETE ===============
export const eliminarTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getMyContext(supabase, userId);
    if (!canManage(roles)) throw new Error("No tienes permisos para esta acción");
    const { error } = await supabase.from("trabajadores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== UPLOAD DOC ===============
export const subirDocumentoTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        trabajador_id: z.string().uuid(),
        tipo: DOC_TIPO,
        path: z.string().min(1).max(1000),
        fecha_vencimiento: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getMyContext(supabase, userId);
    if (!canManage(roles)) throw new Error("No tienes permisos para esta acción");

    const { error } = await supabase
      .from("trabajadores_documentos")
      .upsert(
        {
          trabajador_id: data.trabajador_id,
          tipo: data.tipo,
          url: data.path,
          fecha_vencimiento: data.fecha_vencimiento || null,
        },
        { onConflict: "trabajador_id,tipo" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =============== DELETE DOC ===============
export const eliminarDocumentoTrabajador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ trabajador_id: z.string().uuid(), tipo: DOC_TIPO }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await getMyContext(supabase, userId);
    if (!canManage(roles)) throw new Error("No tienes permisos para esta acción");
    const { error } = await supabase
      .from("trabajadores_documentos")
      .delete()
      .eq("trabajador_id", data.trabajador_id)
      .eq("tipo", data.tipo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
