import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifySupervisoresOC } from "./_oc-notify.server";
import {
  procesarRenglones,
  procesarOrdenCambio,
  reconstruirVigente,
  type RenglonInput,
  type RenglonBase,
  type RenglonOC,
  type OCInput,
} from "@/lib/presupuesto-utils";
import { calcularSemana } from "@/lib/estimacion-utils";

async function getRoles(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const companyId = profile.company_id as string;
  const { data: roles } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("company_id", companyId);
  const set = new Set((roles ?? []).map((r: any) => r.role as string));
  return {
    companyId,
    isDirector: set.has("director"),
    isSupervisor: set.has("supervisor"),
  };
}

async function isMemberObra(supabase: any, userId: string, obraId: string) {
  const { data } = await supabase
    .from("obra_team").select("id")
    .eq("obra_id", obraId).eq("user_id", userId).maybeSingle();
  return !!data;
}

async function getObraRole(supabase: any, userId: string, obraId: string) {
  const { data } = await supabase
    .from("obra_team").select("role")
    .eq("obra_id", obraId).eq("user_id", userId).maybeSingle();
  const role = (data?.role ?? null) as string | null;
  return {
    isResidente: role === "residente",
    isSupervisor: role === "supervisor",
    role,
  };
}

// ============================================================
// CRUD SUBCONTRATOS
// ============================================================

export const listSubcontratos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: subs, error } = await supabase
      .from("obra_subcontratos")
      .select("id, obra_id, contratista_id, numero, nombre, descripcion, estatus, monto_total, created_at")
      .eq("obra_id", data.obraId)
      .order("numero", { ascending: true });
    if (error) throw new Error(error.message);
    const sbc = subs ?? [];
    const tIds = Array.from(new Set(sbc.map((d: any) => d.contratista_id)));
    let ts: any[] = [];
    if (tIds.length > 0) {
      const { data: t } = await supabase
        .from("terceros").select("id, razon_social").in("id", tIds);
      ts = t ?? [];
    }
    const tMap = new Map(ts.map((t: any) => [t.id, t.razon_social]));

    const ids = sbc.map((d: any) => d.id);
    let pagadosMap = new Map<string, number>();
    let baseEstatusMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: ests } = await supabase
        .from("obra_subcontrato_estimaciones")
        .select("subcontrato_id, monto_total, estatus")
        .in("subcontrato_id", ids).eq("estatus", "cerrada");
      for (const e of ests ?? []) {
        pagadosMap.set(e.subcontrato_id, (pagadosMap.get(e.subcontrato_id) ?? 0) + Number(e.monto_total));
      }
      const { data: bases } = await supabase
        .from("obra_subcontrato_presupuestos")
        .select("subcontrato_id, estatus")
        .in("subcontrato_id", ids).eq("tipo", "base");
      for (const b of bases ?? []) {
        baseEstatusMap.set(b.subcontrato_id, b.estatus);
      }
    }

    return sbc.map((d: any) => ({
      ...d,
      contratista_nombre: tMap.get(d.contratista_id) ?? "—",
      pagado_acumulado: pagadosMap.get(d.id) ?? 0,
      estatus_base: baseEstatusMap.get(d.id) ?? "borrador",
    }));
  });

export const getSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: subcontrato, error } = await supabase
      .from("obra_subcontratos").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: presupuestos } = await supabase
      .from("obra_subcontrato_presupuestos")
      .select("id, tipo, numero, nombre, descripcion, estatus, monto_total, enviado_at, autorizado_at, rechazado_at, rechazo_motivo, created_at")
      .eq("subcontrato_id", data.id)
      .order("tipo", { ascending: true })
      .order("numero", { ascending: true });
    const { data: contratista } = await supabase
      .from("terceros").select("id, razon_social, rfc, categoria").eq("id", subcontrato.contratista_id).maybeSingle();
    return {
      subcontrato: { ...subcontrato, contratista },
      presupuestos: presupuestos ?? [],
    };
  });

export const crearSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      contratistaId: z.string().uuid(),
      nombre: z.string().trim().min(1).max(255),
      descripcion: z.string().trim().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, data.obraId);
    if (!isDirector && !member) throw new Error("Sin permisos para crear subcontratos en esta obra");

    // Validar contratista
    const { data: tercero } = await supabase
      .from("terceros").select("id, categoria, company_id").eq("id", data.contratistaId).maybeSingle();
    if (!tercero) throw new Error("Contratista no encontrado");
    if (tercero.company_id !== companyId) throw new Error("Contratista no pertenece a tu empresa");
    if (tercero.categoria !== "contratista" && tercero.categoria !== "ambos")
      throw new Error("El tercero seleccionado no es un contratista");

    const { data: maxRow } = await supabase
      .from("obra_subcontratos").select("numero")
      .eq("obra_id", data.obraId)
      .order("numero", { ascending: false }).limit(1).maybeSingle();
    const numero = (maxRow?.numero ?? 0) + 1;

    const { data: created, error } = await supabase
      .from("obra_subcontratos")
      .insert({
        obra_id: data.obraId,
        company_id: companyId,
        contratista_id: data.contratistaId,
        numero,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        creado_por: userId,
      })
      .select("id").single();
    if (error) throw new Error(error.message);

    const { data: presBase, error: pbErr } = await supabase
      .from("obra_subcontrato_presupuestos")
      .insert({
        subcontrato_id: created.id,
        tipo: "base",
        numero: 0,
        nombre: "Presupuesto base",
        estatus: "borrador",
        creado_por: userId,
      })
      .select("id").single();
    if (pbErr) throw new Error(pbErr.message);

    return { id: created.id as string, presupuestoBaseId: presBase.id as string };
  });

export const eliminarSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("estatus, obra_id, company_id").eq("id", data.id).single();
    if (!d0) throw new Error("Subcontrato no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    const { data: ests } = await supabase
      .from("obra_subcontrato_estimaciones").select("id, estatus")
      .eq("subcontrato_id", data.id).eq("estatus", "cerrada").limit(1);
    if ((ests ?? []).length > 0)
      throw new Error("No se puede eliminar: hay estimaciones cerradas");
    const { data: base } = await supabase
      .from("obra_subcontrato_presupuestos")
      .select("estatus").eq("subcontrato_id", data.id).eq("tipo", "base").maybeSingle();
    if (base && base.estatus !== "borrador")
      throw new Error("No se puede eliminar: el presupuesto ya fue enviado a autorización");
    const { error } = await supabase
      .from("obra_subcontratos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Presupuestos del subcontrato (base + adendas) + flujo autorización
// ============================================================

export const getSubcontratoPresupuesto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: presupuesto, error } = await supabase
      .from("obra_subcontrato_presupuestos")
      .select("*, obra_subcontratos!inner(id, obra_id, company_id, contratista_id, nombre, numero)")
      .eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: renglones } = await supabase
      .from("obra_subcontrato_renglones")
      .select("*")
      .eq("presupuesto_subcontrato_id", data.id)
      .order("orden", { ascending: true });
    return { presupuesto, renglones: renglones ?? [] };
  });

const renglonSchema = z.object({
  clave: z.string().trim().min(1).max(50),
  concepto: z.string().trim().min(1).max(500),
  unidad: z.string().trim().max(20).nullable().optional(),
  cantidad: z.number().finite().nullable().optional(),
  precio_unitario: z.number().finite().nullable().optional(),
});

export const guardarRenglonesSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      presupuestoSubcontratoId: z.string().uuid(),
      renglones: z.array(renglonSchema).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pres } = await supabase
      .from("obra_subcontrato_presupuestos")
      .select("id, estatus, tipo, subcontrato_id")
      .eq("id", data.presupuestoSubcontratoId).single();
    if (!pres) throw new Error("Presupuesto no encontrado");
    if (pres.estatus !== "borrador")
      throw new Error("El presupuesto ya fue enviado/autorizado y no se puede editar");
    if (pres.tipo !== "base")
      throw new Error("Este endpoint es solo para presupuestos base. Usa la captura de OC.");

    const { isDirector } = await getRoles(supabase, userId);
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", pres.subcontrato_id).single();
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");

    const { renglones, errores, montoTotal } = procesarRenglones(data.renglones as RenglonInput[]);
    if (errores.length > 0) {
      throw new Error(
        `Errores en ${errores.length} renglón(es): ${errores
          .slice(0, 3).map((e) => `${e.clave || "(s/c)"}: ${e.errores.join(", ")}`).join(" | ")}`,
      );
    }

    const { error: delErr } = await supabase
      .from("obra_subcontrato_renglones").delete()
      .eq("presupuesto_subcontrato_id", data.presupuestoSubcontratoId);
    if (delErr) throw new Error(delErr.message);

    if (renglones.length > 0) {
      const rows = renglones.map((r) => ({
        presupuesto_subcontrato_id: data.presupuestoSubcontratoId,
        clave: r.clave,
        nivel: r.nivel,
        parent_clave: r.parent_clave,
        concepto: r.concepto,
        unidad: r.unidad,
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
        importe: r.importe,
        es_grupo: r.es_grupo,
        orden: r.orden,
      }));
      const { error } = await supabase.from("obra_subcontrato_renglones").insert(rows);
      if (error) throw new Error(error.message);
    }

    const { error: updErr } = await supabase
      .from("obra_subcontrato_presupuestos").update({ monto_total: montoTotal })
      .eq("id", data.presupuestoSubcontratoId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, montoTotal, renglonesCount: renglones.length };
  });

const ocInputSchema = z.object({
  clave: z.string().trim().min(1).max(50),
  tipo_movimiento: z.enum(["modificacion", "adicion", "eliminacion"]),
  concepto: z.string().trim().max(500).optional(),
  unidad: z.string().trim().max(20).nullable().optional(),
  cantidad: z.number().finite().nullable().optional(),
  precio_unitario: z.number().finite().nullable().optional(),
});

async function loadSubcontratoBaseYOcs(supabase: any, subcontratoId: string) {
  const { data: presupuestos } = await supabase
    .from("obra_subcontrato_presupuestos")
    .select("id, tipo, numero, estatus")
    .eq("subcontrato_id", subcontratoId);
  const base = (presupuestos ?? []).find(
    (p: any) => p.tipo === "base" && p.estatus === "autorizado",
  );
  const ocs = (presupuestos ?? [])
    .filter((p: any) => p.tipo === "adenda" && p.estatus === "autorizado")
    .sort((a: any, b: any) => a.numero - b.numero);

  let baseRenglones: RenglonBase[] = [];
  if (base) {
    const { data: r } = await supabase
      .from("obra_subcontrato_renglones").select("*")
      .eq("presupuesto_subcontrato_id", base.id).order("orden", { ascending: true });
    baseRenglones = (r ?? []).map((x: any) => ({
      clave: x.clave,
      concepto: x.concepto,
      unidad: x.unidad,
      cantidad: x.cantidad != null ? Number(x.cantidad) : null,
      precio_unitario: x.precio_unitario != null ? Number(x.precio_unitario) : null,
      importe: Number(x.importe ?? 0),
      es_grupo: !!x.es_grupo,
      nivel: x.nivel,
      parent_clave: x.parent_clave,
    }));
  }
  const ocsRenglones: RenglonOC[][] = [];
  for (const oc of ocs) {
    const { data: r } = await supabase
      .from("obra_subcontrato_renglones").select("*")
      .eq("presupuesto_subcontrato_id", oc.id).order("orden", { ascending: true });
    ocsRenglones.push(
      (r ?? [])
        .filter((x: any) => x.tipo_movimiento && x.tipo_movimiento !== "renglon")
        .map((x: any) => ({
          clave: x.clave,
          tipo_movimiento: x.tipo_movimiento,
          importe_delta: Number(x.importe_delta ?? 0),
          concepto: x.concepto,
          unidad: x.unidad,
          cantidad: x.cantidad != null ? Number(x.cantidad) : null,
          precio_unitario: x.precio_unitario != null ? Number(x.precio_unitario) : null,
        })),
    );
  }
  return { base, ocs, baseRenglones, ocsRenglones };
}

export const getVigenteSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subcontratoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { base, baseRenglones, ocsRenglones } = await loadSubcontratoBaseYOcs(supabase, data.subcontratoId);
    if (!base) return { vigente: [], montoTotal: 0, hasBase: false };
    const { vigente, montoTotal } = reconstruirVigente(baseRenglones, ocsRenglones);
    return { vigente, montoTotal, hasBase: true };
  });

export const guardarRenglonesOCSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      presupuestoSubcontratoId: z.string().uuid(),
      renglones: z.array(ocInputSchema).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pres } = await supabase
      .from("obra_subcontrato_presupuestos")
      .select("id, subcontrato_id, tipo, estatus")
      .eq("id", data.presupuestoSubcontratoId).single();
    if (!pres) throw new Error("Presupuesto no encontrado");
    if (pres.tipo !== "adenda") throw new Error("Solo para órdenes de cambio");
    if (pres.estatus !== "borrador")
      throw new Error("La orden de cambio ya fue enviada/autorizada");

    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", pres.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");

    const { baseRenglones, ocsRenglones } = await loadSubcontratoBaseYOcs(supabase, pres.subcontrato_id);
    const { vigente } = reconstruirVigente(baseRenglones, ocsRenglones);

    const { renglones, errores, montoDelta } = procesarOrdenCambio(vigente, data.renglones as OCInput[]);
    if (errores.length > 0) {
      throw new Error(
        `Errores en ${errores.length} renglón(es): ${errores
          .slice(0, 3).map((e) => `${e.clave || "(s/c)"}: ${e.errores.join(", ")}`).join(" | ")}`,
      );
    }

    const { error: delErr } = await supabase
      .from("obra_subcontrato_renglones").delete()
      .eq("presupuesto_subcontrato_id", data.presupuestoSubcontratoId);
    if (delErr) throw new Error(delErr.message);

    if (renglones.length > 0) {
      const rows = renglones.map((r) => ({
        presupuesto_subcontrato_id: data.presupuestoSubcontratoId,
        clave: r.clave,
        nivel: r.nivel,
        parent_clave: r.parent_clave,
        concepto: r.concepto,
        unidad: r.unidad,
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
        importe:
          r.tipo_movimiento === "adicion" || r.tipo_movimiento === "modificacion"
            ? Number(r.cantidad ?? 0) * Number(r.precio_unitario ?? 0)
            : 0,
        importe_delta: r.importe_delta,
        tipo_movimiento: r.tipo_movimiento,
        es_grupo: false,
        orden: r.orden,
      }));
      const { error } = await supabase.from("obra_subcontrato_renglones").insert(rows);
      if (error) throw new Error(error.message);
    }

    const { error: updErr } = await supabase
      .from("obra_subcontrato_presupuestos").update({ monto_total: montoDelta })
      .eq("id", data.presupuestoSubcontratoId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, montoDelta, renglonesCount: renglones.length };
  });

export const crearOrdenCambioSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subcontratoId: z.string().uuid(),
      nombre: z.string().trim().min(1).max(255),
      descripcion: z.string().trim().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", data.subcontratoId).single();
    if (!d0) throw new Error("Subcontrato no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0.obra_id);
    if (!isDirector && !obraRole.isResidente)
      throw new Error("Solo el Residente de la obra (o el Director) puede solicitar órdenes de cambio");

    const { data: base } = await supabase
      .from("obra_subcontrato_presupuestos").select("id, estatus")
      .eq("subcontrato_id", data.subcontratoId).eq("tipo", "base").maybeSingle();
    if (!base || base.estatus !== "autorizado")
      throw new Error("Primero autoriza el presupuesto base del subcontrato");

    const { data: maxRow } = await supabase
      .from("obra_subcontrato_presupuestos").select("numero")
      .eq("subcontrato_id", data.subcontratoId).eq("tipo", "adenda")
      .order("numero", { ascending: false }).limit(1).maybeSingle();
    const numero = (maxRow?.numero ?? 0) + 1;

    const { data: created, error } = await supabase
      .from("obra_subcontrato_presupuestos")
      .insert({
        subcontrato_id: data.subcontratoId,
        tipo: "adenda",
        numero,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        creado_por: userId,
      })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

async function recalcSubcontratoTotal(supabase: any, subcontratoId: string) {
  const { base, baseRenglones, ocsRenglones } = await loadSubcontratoBaseYOcs(supabase, subcontratoId);
  if (!base) return 0;
  const { montoTotal } = reconstruirVigente(baseRenglones, ocsRenglones);
  await supabase.from("obra_subcontratos").update({ monto_total: montoTotal }).eq("id", subcontratoId);
  return montoTotal;
}

export const enviarPresupuestoSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presupuestoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("obra_subcontrato_presupuestos").select("id, estatus, subcontrato_id, tipo").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "borrador") throw new Error("Solo se puede solicitar desde borrador");
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", p.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0!.obra_id);
    if (p.tipo === "adenda") {
      if (!isDirector && !obraRole.isResidente)
        throw new Error("Solo el Residente (o Director) puede solicitar la autorización");
    } else {
      const member = await isMemberObra(supabase, userId, d0!.obra_id);
      if (!isDirector && !member) throw new Error("Sin permisos");
    }
    const { count } = await supabase
      .from("obra_subcontrato_renglones")
      .select("id", { count: "exact", head: true })
      .eq("presupuesto_subcontrato_id", data.presupuestoId);
    if (!count) throw new Error("Sin renglones capturados");
    const { error } = await supabase
      .from("obra_subcontrato_presupuestos")
      .update({ estatus: "enviado", enviado_at: new Date().toISOString(), enviado_por: userId })
      .eq("id", data.presupuestoId);
    if (error) throw new Error(error.message);

    if (p.tipo === "adenda") {
      try {
        await notifySupervisoresOC(supabase, {
          userId,
          obraId: d0!.obra_id,
          tipo: "oc_subcontrato_solicitada",
          link: `/app/obras/${d0!.obra_id}`,
        });
      } catch (e: any) {
        console.error("[notificaciones] oc_subcontrato_solicitada error", e?.message);
      }
    }

    return { ok: true };
  });

export const autorizarPresupuestoSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presupuestoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("obra_subcontrato_presupuestos").select("id, estatus, subcontrato_id, tipo, enviado_por").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "enviado") throw new Error("Solo se puede autorizar una solicitud");
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", p.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0!.obra_id);
    if (!isDirector && !obraRole.isSupervisor)
      throw new Error("Solo el Supervisor de la obra (o el Director) puede autorizar");
    if (p.tipo === "adenda" && p.enviado_por && p.enviado_por === userId && !isDirector)
      throw new Error("No puedes autorizar una OC que tú mismo solicitaste");
    const { error } = await supabase
      .from("obra_subcontrato_presupuestos")
      .update({ estatus: "autorizado", autorizado_at: new Date().toISOString(), autorizado_por: userId })
      .eq("id", data.presupuestoId);
    if (error) throw new Error(error.message);
    await recalcSubcontratoTotal(supabase, p.subcontrato_id);
    return { ok: true };
  });

export const rechazarPresupuestoSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      presupuestoId: z.string().uuid(),
      motivo: z.string().trim().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("obra_subcontrato_presupuestos").select("estatus, subcontrato_id").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "enviado") throw new Error("Solo se puede rechazar una solicitud");
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", p.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0!.obra_id);
    if (!isDirector && !obraRole.isSupervisor)
      throw new Error("Solo el Supervisor de la obra (o el Director) puede rechazar");
    const { error } = await supabase
      .from("obra_subcontrato_presupuestos")
      .update({
        estatus: "rechazado",
        rechazado_at: new Date().toISOString(),
        rechazado_por: userId,
        rechazo_motivo: data.motivo,
      })
      .eq("id", data.presupuestoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reabrirPresupuestoSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presupuestoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("obra_subcontrato_presupuestos").select("estatus, subcontrato_id, tipo").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "rechazado")
      throw new Error("Solo presupuestos rechazados se pueden reabrir como borrador");
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", p.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0!.obra_id);
    if (p.tipo === "adenda") {
      if (!isDirector && !obraRole.isResidente) throw new Error("Sin permisos");
    } else {
      const member = await isMemberObra(supabase, userId, d0!.obra_id);
      if (!isDirector && !member) throw new Error("Sin permisos");
    }
    const { error } = await supabase
      .from("obra_subcontrato_presupuestos")
      .update({ estatus: "borrador", rechazado_at: null, rechazado_por: null, rechazo_motivo: null })
      .eq("id", data.presupuestoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// ESTIMACIONES DEL SUBCONTRATO
// ============================================================

export const listEstimacionesSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subcontratoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("obra_subcontrato_estimaciones")
      .select("id, numero, semana_inicio, semana_fin, estatus, monto_total, cerrada_at, created_at")
      .eq("subcontrato_id", data.subcontratoId)
      .order("semana_inicio", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

async function loadVigenteSubcontratoData(supabase: any, subcontratoId: string) {
  const { base, baseRenglones, ocsRenglones } = await loadSubcontratoBaseYOcs(supabase, subcontratoId);
  if (!base) return { vigente: [] as any[], hasBase: false };
  const { vigente } = reconstruirVigente(baseRenglones, ocsRenglones);
  return { vigente, hasBase: true };
}

export const getOrCreateEstimacionSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subcontratoId: z.string().uuid(),
      semanaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id, company_id").eq("id", data.subcontratoId).single();
    if (!d0) throw new Error("Subcontrato no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0.obra_id);
    const canEdit = isDirector || member;

    const semana = calcularSemana(data.semanaInicio);
    const { data: existente } = await supabase
      .from("obra_subcontrato_estimaciones")
      .select("*").eq("subcontrato_id", data.subcontratoId).eq("semana_inicio", semana.inicio).maybeSingle();

    let estimacion = existente;
    if (!estimacion) {
      if (!canEdit) throw new Error("Sin permisos para crear estimaciones");
      const { data: maxRow } = await supabase
        .from("obra_subcontrato_estimaciones").select("numero")
        .eq("subcontrato_id", data.subcontratoId)
        .order("numero", { ascending: false }).limit(1).maybeSingle();
      const numero = (maxRow?.numero ?? 0) + 1;
      const { data: created, error } = await supabase
        .from("obra_subcontrato_estimaciones")
        .insert({
          subcontrato_id: data.subcontratoId,
          company_id: d0.company_id,
          numero,
          semana_inicio: semana.inicio,
          semana_fin: semana.fin,
          creado_por: userId,
        }).select("*").single();
      if (error) throw new Error(error.message);
      estimacion = created;
    }

    const { vigente, hasBase } = await loadVigenteSubcontratoData(supabase, data.subcontratoId);

    const { data: renglones } = await supabase
      .from("obra_subcontrato_estimacion_renglones")
      .select("renglon_clave, cantidad_ejecutada")
      .eq("estimacion_id", estimacion.id);
    const capturados: Record<string, number> = {};
    for (const r of renglones ?? []) capturados[r.renglon_clave] = Number(r.cantidad_ejecutada ?? 0);

    const { data: prevs } = await supabase
      .from("obra_subcontrato_estimaciones").select("id")
      .eq("subcontrato_id", data.subcontratoId).eq("estatus", "cerrada")
      .lt("semana_inicio", semana.inicio);
    const prevIds = (prevs ?? []).map((p: any) => p.id);
    const acumuladoPrevio: Record<string, number> = {};
    if (prevIds.length > 0) {
      const { data: prevRows } = await supabase
        .from("obra_subcontrato_estimacion_renglones")
        .select("renglon_clave, cantidad_ejecutada")
        .in("estimacion_id", prevIds);
      for (const r of prevRows ?? []) {
        acumuladoPrevio[r.renglon_clave] = (acumuladoPrevio[r.renglon_clave] ?? 0) + Number(r.cantidad_ejecutada ?? 0);
      }
    }

    return { estimacion, vigente, hasBase, capturados, acumuladoPrevio };
  });

export const guardarEstimacionSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      estimacionId: z.string().uuid(),
      renglones: z.array(
        z.object({
          renglon_clave: z.string().min(1).max(50),
          cantidad_ejecutada: z.number().finite().min(0),
        }),
      ).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_subcontrato_estimaciones").select("*").eq("id", data.estimacionId).single();
    if (!est) throw new Error("Estimación no encontrada");
    if (est.estatus !== "borrador") throw new Error("Estimación cerrada");
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", est.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");

    const { vigente } = await loadVigenteSubcontratoData(supabase, est.subcontrato_id);
    const vigPorClave = new Map<string, any>();
    for (const n of vigente) vigPorClave.set(n.clave, n);

    const { data: prevs } = await supabase
      .from("obra_subcontrato_estimaciones").select("id")
      .eq("subcontrato_id", est.subcontrato_id).eq("estatus", "cerrada")
      .lt("semana_inicio", est.semana_inicio);
    const prevIds = (prevs ?? []).map((p: any) => p.id);
    const acumPrev = new Map<string, number>();
    if (prevIds.length > 0) {
      const { data: prevRows } = await supabase
        .from("obra_subcontrato_estimacion_renglones")
        .select("renglon_clave, cantidad_ejecutada")
        .in("estimacion_id", prevIds);
      for (const r of prevRows ?? []) {
        acumPrev.set(r.renglon_clave, (acumPrev.get(r.renglon_clave) ?? 0) + Number(r.cantidad_ejecutada ?? 0));
      }
    }

    const errores: string[] = [];
    const rows: any[] = [];
    for (const r of data.renglones) {
      if (r.cantidad_ejecutada <= 0) continue;
      const v = vigPorClave.get(r.renglon_clave);
      if (!v) { errores.push(`${r.renglon_clave}: no existe en vigente`); continue; }
      if (v.es_grupo) { errores.push(`${r.renglon_clave}: es grupo`); continue; }
      const cantVig = Number(v.cantidad ?? 0);
      const acP = acumPrev.get(r.renglon_clave) ?? 0;
      const nuevo = acP + r.cantidad_ejecutada;
      if (cantVig > 0 && nuevo > cantVig + 0.0001) {
        errores.push(`${r.renglon_clave}: excede vigente por ${(nuevo - cantVig).toFixed(2)}`);
        continue;
      }
      const pu = Number(v.precio_unitario ?? 0);
      rows.push({
        estimacion_id: data.estimacionId,
        renglon_clave: r.renglon_clave,
        concepto: v.concepto,
        unidad: v.unidad,
        cantidad_vigente: cantVig,
        pu_vigente: pu,
        cantidad_ejecutada: r.cantidad_ejecutada,
        importe_ejecutado: r.cantidad_ejecutada * pu,
      });
    }
    if (errores.length > 0)
      throw new Error(`${errores.length} error(es): ${errores.slice(0, 3).join(" | ")}`);

    await supabase.from("obra_subcontrato_estimacion_renglones").delete().eq("estimacion_id", data.estimacionId);
    let montoTotal = 0;
    if (rows.length > 0) {
      const { error } = await supabase.from("obra_subcontrato_estimacion_renglones").insert(rows);
      if (error) throw new Error(error.message);
      montoTotal = rows.reduce((s, r) => s + r.importe_ejecutado, 0);
    }
    await supabase.from("obra_subcontrato_estimaciones").update({ monto_total: montoTotal }).eq("id", data.estimacionId);
    return { ok: true, montoTotal, renglonesCount: rows.length };
  });

export const cerrarEstimacionSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_subcontrato_estimaciones").select("*").eq("id", data.id).single();
    if (!est) throw new Error("No encontrada");
    if (est.estatus !== "borrador") throw new Error("Ya cerrada");
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", est.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    const { count } = await supabase
      .from("obra_subcontrato_estimacion_renglones")
      .select("id", { count: "exact", head: true })
      .eq("estimacion_id", data.id);
    if (!count) throw new Error("Estimación sin cantidades");
    const { error } = await supabase
      .from("obra_subcontrato_estimaciones")
      .update({ estatus: "cerrada", cerrada_at: new Date().toISOString(), cerrada_por: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarEstimacionSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_subcontrato_estimaciones").select("subcontrato_id, estatus").eq("id", data.id).single();
    if (!est) throw new Error("No encontrada");
    if (est.estatus === "cerrada") throw new Error("No se elimina una cerrada");
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", est.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    const { error } = await supabase
      .from("obra_subcontrato_estimaciones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
