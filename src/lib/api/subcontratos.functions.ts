import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifySupervisoresOC, notifyResidenteOC } from "./_oc-notify.server";
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

async function canAutorizarEstimacionSubcontrato(
  supabase: any,
  userId: string,
  obraId: string,
) {
  const { isDirector } = await getRoles(supabase, userId);
  if (isDirector) return true;
  const { data } = await supabase
    .from("obra_team")
    .select("role")
    .eq("obra_id", obraId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as any)?.role === "supervisor";
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
      .select("id, obra_id, contratista_id, numero, nombre, descripcion, estatus, monto_total, anticipo_pct, anticipo_monto, fondo_garantia_pct, created_at")
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
      anticipoPct: z.number().min(0).max(100).optional(),
      fondoGarantiaPct: z.number().min(0).max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, data.obraId);
    if (!isDirector && !obraRole.isResidente)
      throw new Error("Sin permisos para crear subcontratos en esta obra");

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

    const anticipoPct = Number(data.anticipoPct ?? 0);
    const fondoPct = Number(data.fondoGarantiaPct ?? 0);

    const { data: created, error } = await supabase
      .from("obra_subcontratos")
      .insert({
        obra_id: data.obraId,
        company_id: companyId,
        contratista_id: data.contratistaId,
        numero,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        anticipo_pct: anticipoPct,
        anticipo_monto: 0,
        fondo_garantia_pct: fondoPct,
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

export const actualizarTerminosSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subcontratoId: z.string().uuid(),
      anticipoPct: z.number().min(0).max(100),
      fondoGarantiaPct: z.number().min(0).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id, monto_total").eq("id", data.subcontratoId).single();
    if (!d0) throw new Error("Subcontrato no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");

    const { data: ant } = await supabase
      .from("obra_subcontrato_anticipos").select("id, pagado").eq("subcontrato_id", data.subcontratoId).maybeSingle();
    if (ant?.pagado) throw new Error("El anticipo ya fue marcado como pagado; no se pueden modificar los términos");

    const anticipoMonto = Number(d0.monto_total ?? 0) * (data.anticipoPct / 100);
    const { error } = await supabase
      .from("obra_subcontratos")
      .update({
        anticipo_pct: data.anticipoPct,
        anticipo_monto: anticipoMonto,
        fondo_garantia_pct: data.fondoGarantiaPct,
      })
      .eq("id", data.subcontratoId);
    if (error) throw new Error(error.message);

    if (ant && !ant.pagado) {
      await supabase
        .from("obra_subcontrato_anticipos")
        .update({ monto: anticipoMonto })
        .eq("id", ant.id);
    }
    return { ok: true };
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
    const { data: ant } = await supabase
      .from("obra_subcontrato_anticipos").select("pagado, solicitado_at").eq("subcontrato_id", data.id).maybeSingle();
    if (ant && (ant.pagado || ant.solicitado_at))
      throw new Error("No se puede eliminar: el anticipo ya fue solicitado o pagado");
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
      .select("*, obra_subcontratos!inner(id, obra_id, company_id, contratista_id, nombre, numero, anticipo_pct, anticipo_monto, fondo_garantia_pct)")
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
  const { data: d0 } = await supabase
    .from("obra_subcontratos").select("anticipo_pct").eq("id", subcontratoId).maybeSingle();
  const anticipoPct = Number(d0?.anticipo_pct ?? 0);
  const anticipoMonto = montoTotal * (anticipoPct / 100);
  await supabase
    .from("obra_subcontratos")
    .update({ monto_total: montoTotal, anticipo_monto: anticipoMonto })
    .eq("id", subcontratoId);
  return montoTotal;
}

async function ensureAnticipoSubcontratoRecord(supabase: any, subcontratoId: string, userId: string) {
  const { data: subcontrato } = await supabase
    .from("obra_subcontratos")
    .select("id, company_id, anticipo_monto")
    .eq("id", subcontratoId).single();
  if (!subcontrato) return;
  const monto = Number(subcontrato.anticipo_monto ?? 0);
  if (monto <= 0) return;
  const { data: existing } = await supabase
    .from("obra_subcontrato_anticipos").select("id, pagado, monto").eq("subcontrato_id", subcontratoId).maybeSingle();
  if (!existing) {
    await supabase.from("obra_subcontrato_anticipos").insert({
      subcontrato_id: subcontratoId,
      company_id: subcontrato.company_id,
      monto,
      creado_por: userId,
    });
  } else if (!existing.pagado && Number(existing.monto) !== monto) {
    await supabase.from("obra_subcontrato_anticipos").update({ monto }).eq("id", existing.id);
  }
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

    if (p.tipo === "base") {
      await ensureAnticipoSubcontratoRecord(supabase, p.subcontrato_id, userId);
    }

    if (p.tipo === "adenda") {
      try {
        await notifyResidenteOC(supabase, {
          residenteId: p.enviado_por,
          actorUserId: userId,
          obraId: d0!.obra_id,
          tipo: "oc_subcontrato_autorizada",
          link: `/app/obras/${d0!.obra_id}`,
        });
      } catch (e: any) {
        console.error("[notificaciones] oc_subcontrato_autorizada error", e?.message);
      }
    }

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
      .from("obra_subcontrato_presupuestos").select("estatus, subcontrato_id, tipo, enviado_por").eq("id", data.presupuestoId).single();
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

    if (p.tipo === "adenda") {
      try {
        await notifyResidenteOC(supabase, {
          residenteId: p.enviado_por,
          actorUserId: userId,
          obraId: d0!.obra_id,
          tipo: "oc_subcontrato_rechazada",
          link: `/app/obras/${d0!.obra_id}`,
          motivo: data.motivo,
        });
      } catch (e: any) {
        console.error("[notificaciones] oc_subcontrato_rechazada error", e?.message);
      }
    }

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
      .select("id, numero, semana_inicio, semana_fin, estatus, monto_total, monto_neto, rechazo_motivo, cxp_id, cerrada_at, created_at")
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
      .from("obra_subcontratos")
      .select("obra_id, company_id, anticipo_pct, anticipo_monto, fondo_garantia_pct")
      .eq("id", data.subcontratoId).single();
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

    // Saldos para amortización/retención sugeridas (estimaciones previas en estatus cerrada/autorizada/pagada)
    const { data: cerradas } = await supabase
      .from("obra_subcontrato_estimaciones")
      .select("amortizacion_anticipo, retencion_fondo, liberacion_fondo, estatus")
      .eq("subcontrato_id", data.subcontratoId)
      .in("estatus", ["cerrada", "autorizada", "pagada"]);
    const amortAcumPrev = (cerradas ?? []).reduce(
      (s: number, r: any) => s + Number(r.amortizacion_anticipo ?? 0), 0,
    );
    const fondoRetenidoPrev = (cerradas ?? []).reduce(
      (s: number, r: any) => s + Number(r.retencion_fondo ?? 0), 0,
    );
    const fondoLiberadoPrev = (cerradas ?? []).reduce(
      (s: number, r: any) => s + Number(r.liberacion_fondo ?? 0), 0,
    );

    return {
      estimacion,
      vigente,
      hasBase,
      capturados,
      acumuladoPrevio,
      terminos: {
        anticipo_pct: Number(d0.anticipo_pct ?? 0),
        anticipo_monto: Number(d0.anticipo_monto ?? 0),
        fondo_garantia_pct: Number(d0.fondo_garantia_pct ?? 0),
        anticipo_amortizado_prev: amortAcumPrev,
        anticipo_saldo: Math.max(0, Number(d0.anticipo_monto ?? 0) - amortAcumPrev),
        fondo_retenido_prev: fondoRetenidoPrev,
        fondo_liberado_prev: fondoLiberadoPrev,
        fondo_saldo_prev: Math.max(0, fondoRetenidoPrev - fondoLiberadoPrev),
      },
    };
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
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      liberacionFondo: z.number().min(0).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_subcontrato_estimaciones").select("*").eq("id", data.id).single();
    if (!est) throw new Error("No encontrada");
    if (est.estatus !== "borrador") throw new Error("Ya cerrada");
    const { data: d0 } = await supabase
      .from("obra_subcontratos")
      .select("id, obra_id, nombre, anticipo_pct, anticipo_monto, fondo_garantia_pct")
      .eq("id", est.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    const { count } = await supabase
      .from("obra_subcontrato_estimacion_renglones")
      .select("id", { count: "exact", head: true })
      .eq("estimacion_id", data.id);
    if (!count) throw new Error("Estimación sin cantidades");

    const bruto = Number(est.monto_total ?? 0);
    const anticipoPct = Number(d0!.anticipo_pct ?? 0);
    const fondoPct = Number(d0!.fondo_garantia_pct ?? 0);
    const anticipoMonto = Number(d0!.anticipo_monto ?? 0);

    const { data: prevAmort } = await supabase
      .from("obra_subcontrato_estimaciones")
      .select("amortizacion_anticipo")
      .eq("subcontrato_id", est.subcontrato_id)
      .in("estatus", ["cerrada", "autorizada", "pagada"])
      .neq("id", data.id);
    const amortAcum = (prevAmort ?? []).reduce((s: number, r: any) => s + Number(r.amortizacion_anticipo ?? 0), 0);
    const saldoAnticipo = Math.max(0, anticipoMonto - amortAcum);
    const amortizacion = Math.min(saldoAnticipo, bruto * (anticipoPct / 100));

    const retencion = bruto * (fondoPct / 100);

    const { data: prevFondo } = await supabase
      .from("obra_subcontrato_estimaciones")
      .select("retencion_fondo, liberacion_fondo")
      .eq("subcontrato_id", est.subcontrato_id)
      .in("estatus", ["cerrada", "autorizada", "pagada"])
      .neq("id", data.id);
    const fondoAcumPrev = (prevFondo ?? []).reduce(
      (s: number, r: any) => s + Number(r.retencion_fondo ?? 0) - Number(r.liberacion_fondo ?? 0),
      0,
    );
    const fondoDisponible = Math.max(0, fondoAcumPrev + retencion);
    const liberacionSolicitada = Number(data.liberacionFondo ?? 0);
    if (liberacionSolicitada > fondoDisponible + 0.01) {
      throw new Error(
        `La liberación de fondo (${liberacionSolicitada.toFixed(2)}) excede el fondo disponible (${fondoDisponible.toFixed(2)}).`,
      );
    }
    const liberacion = liberacionSolicitada;

    const neto = bruto - amortizacion - retencion + liberacion;

    const { error } = await supabase
      .from("obra_subcontrato_estimaciones")
      .update({
        estatus: "cerrada",
        cerrada_at: new Date().toISOString(),
        cerrada_por: userId,
        amortizacion_anticipo: amortizacion,
        retencion_fondo: retencion,
        liberacion_fondo: liberacion,
        monto_neto: neto,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Notificar a supervisores de la obra (con fallback a directores) para autorización
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: team }, { data: dirs }, { data: obraRow }] = await Promise.all([
        supabaseAdmin
          .from("obra_team")
          .select("user_id")
          .eq("obra_id", d0!.obra_id)
          .eq("role", "supervisor"),
        supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("company_id", est.company_id)
          .eq("role", "director"),
        supabaseAdmin.from("obras").select("nombre").eq("id", d0!.obra_id).single(),
      ]);
      const supIds = (team ?? []).map((r: any) => r.user_id);
      const targetIds = Array.from(
        new Set(
          (supIds.length > 0 ? supIds : (dirs ?? []).map((r: any) => r.user_id)).filter(
            (uid: string) => uid && uid !== userId,
          ),
        ),
      );
      if (targetIds.length > 0) {
        const montoFmt = new Intl.NumberFormat("es-MX", {
          style: "currency", currency: "MXN",
        }).format(neto);
        const obraNombre = (obraRow as any)?.nombre ?? "";
        const titulo = "Estimación de subcontrato por autorizar";
        const mensaje = `Estimación #${est.numero ?? ""} · ${d0!.nombre}${obraNombre ? " · obra " + obraNombre : ""} · ${montoFmt}. Requiere tu autorización.`;
        const rows = targetIds.map((uid: string) => ({
          user_id: uid,
          company_id: est.company_id,
          obra_id: d0!.obra_id,
          tipo: "estimacion_subcontrato_por_autorizar",
          titulo,
          mensaje,
          link: `/app/obras/${d0!.obra_id}/subcontratos?subcontrato=${d0!.id}`,
        }));
        await supabaseAdmin.from("notificaciones").insert(rows);
      }
    } catch (e: any) {
      console.error("[notificaciones] estimacion subcontrato cerrada:", e?.message);
    }

    return { ok: true, bruto, amortizacion, retencion, liberacion, neto };
  });

export const eliminarEstimacionSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_subcontrato_estimaciones").select("subcontrato_id, estatus").eq("id", data.id).single();
    if (!est) throw new Error("No encontrada");
    if (est.estatus !== "borrador" && est.estatus !== "rechazada") {
      throw new Error("Solo se eliminan estimaciones en borrador o rechazadas");
    }
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

// ============================================================
// AUTORIZACIÓN DE ESTIMACIONES (supervisor / director)
// ============================================================

export const autorizarEstimacionSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_subcontrato_estimaciones")
      .select("id, subcontrato_id, company_id, estatus, monto_neto, monto_total, semana_inicio, semana_fin, numero, creado_por")
      .eq("id", data.id)
      .single();
    if (!est) throw new Error("Estimación no encontrada");
    if (est.estatus !== "cerrada") {
      throw new Error("Solo se autorizan estimaciones cerradas");
    }
    const { data: d0 } = await supabase
      .from("obra_subcontratos")
      .select("id, obra_id, nombre, contratista_id")
      .eq("id", est.subcontrato_id)
      .single();
    if (!d0) throw new Error("Subcontrato no encontrado");

    const allowed = await canAutorizarEstimacionSubcontrato(supabase, userId, d0.obra_id);
    if (!allowed) throw new Error("Solo el supervisor o director pueden autorizar");

    const { data: contratista } = await supabase
      .from("terceros")
      .select("razon_social")
      .eq("id", d0.contratista_id)
      .maybeSingle();
    const contratistaNombre = (contratista as any)?.razon_social ?? "Contratista";

    const { data: obra } = await supabase
      .from("obras")
      .select("nombre")
      .eq("id", d0.obra_id)
      .maybeSingle();
    const obraNombre = (obra as any)?.nombre ?? "";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: folioRow, error: fErr } = await supabaseAdmin
      .rpc("siguiente_folio_cxp", { _company_id: est.company_id });
    if (fErr) throw new Error(fErr.message);
    const folio = folioRow as unknown as string;

    const monto = Number(est.monto_neto);
    if (monto <= 0) throw new Error("La estimación tiene monto neto en cero; no genera cuenta por pagar");

    const concepto = `Estimación ${est.numero} subcontrato · ${d0.nombre} · ${contratistaNombre}`;

    const { data: cxp, error: cErr } = await supabaseAdmin
      .from("cuentas_por_pagar")
      .insert({
        company_id: est.company_id,
        obra_id: d0.obra_id,
        folio,
        beneficiario_tipo: "tercero",
        beneficiario_id: d0.contratista_id,
        beneficiario_nombre: contratistaNombre,
        concepto,
        origen_tipo: "subcontrato_estimacion",
        origen_id: est.id,
        monto_total: monto,
        estatus: "pendiente",
        creado_por: userId,
      })
      .select("id, folio")
      .single();
    if (cErr) throw new Error(cErr.message);

    const { data: full } = await supabaseAdmin
      .from("obra_subcontrato_estimaciones")
      .select("monto_total, amortizacion_anticipo, retencion_fondo, liberacion_fondo, monto_neto, cerrada_at")
      .eq("id", est.id)
      .single();
    const bruto = Number((full as any)?.monto_total ?? 0);
    const amort = Number((full as any)?.amortizacion_anticipo ?? 0);
    const reten = Number((full as any)?.retencion_fondo ?? 0);
    const liber = Number((full as any)?.liberacion_fondo ?? 0);
    const fechaAsiento = (full as any)?.cerrada_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

    const asientoId = crypto.randomUUID();
    const renglones: any[] = [
      {
        company_id: est.company_id,
        asiento_id: asientoId,
        fecha: fechaAsiento,
        concepto,
        referencia: folio,
        origen_tipo: "subcontrato_estimacion",
        origen_id: est.id,
        tipo_movimiento: "cargo",
        cuenta_contable: "Costo de obra - Subcontratos",
        monto: bruto,
        creado_por: userId,
      },
    ];
    if (amort > 0) {
      renglones.push({
        company_id: est.company_id,
        asiento_id: asientoId,
        fecha: fechaAsiento,
        concepto,
        referencia: folio,
        origen_tipo: "subcontrato_estimacion",
        origen_id: est.id,
        tipo_movimiento: "abono",
        cuenta_contable: "Anticipos a contratistas",
        monto: amort,
        creado_por: userId,
      });
    }
    if (reten > 0) {
      renglones.push({
        company_id: est.company_id,
        asiento_id: asientoId,
        fecha: fechaAsiento,
        concepto,
        referencia: folio,
        origen_tipo: "subcontrato_estimacion",
        origen_id: est.id,
        tipo_movimiento: "abono",
        cuenta_contable: "Fondo de garantía retenido",
        monto: reten,
        creado_por: userId,
      });
    }
    if (liber > 0) {
      renglones.push({
        company_id: est.company_id,
        asiento_id: asientoId,
        fecha: fechaAsiento,
        concepto,
        referencia: folio,
        origen_tipo: "subcontrato_estimacion",
        origen_id: est.id,
        tipo_movimiento: "cargo",
        cuenta_contable: "Fondo de garantía retenido",
        monto: liber,
        creado_por: userId,
      });
    }
    renglones.push({
      company_id: est.company_id,
      asiento_id: asientoId,
      fecha: fechaAsiento,
      concepto,
      referencia: folio,
      origen_tipo: "subcontrato_estimacion",
      origen_id: est.id,
      tipo_movimiento: "abono",
      cuenta_contable: "Cuentas por pagar - Subcontratistas",
      monto: monto,
      creado_por: userId,
    });

    const { error: asErr } = await supabaseAdmin
      .from("asientos_contables")
      .insert(renglones);
    if (asErr) {
      await supabaseAdmin.from("cuentas_por_pagar").delete().eq("id", (cxp as any).id);
      throw new Error(asErr.message);
    }

    const { error: uErr } = await supabaseAdmin
      .from("obra_subcontrato_estimaciones")
      .update({
        estatus: "autorizada",
        autorizada_at: new Date().toISOString(),
        autorizada_por: userId,
        cxp_id: (cxp as any).id,
        rechazada_at: null,
        rechazada_por: null,
        rechazo_motivo: null,
      })
      .eq("id", est.id);
    if (uErr) {
      await supabaseAdmin.from("asientos_contables").delete().eq("asiento_id", asientoId);
      await supabaseAdmin.from("cuentas_por_pagar").delete().eq("id", (cxp as any).id);
      throw new Error(uErr.message);
    }

    // Notificaciones
    try {
      const [{ data: roles }, { data: adminsObra }] = await Promise.all([
        supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("company_id", est.company_id)
          .in("role", ["administrativo", "director"]),
        supabaseAdmin
          .from("obra_team")
          .select("user_id")
          .eq("obra_id", d0.obra_id)
          .eq("role", "administrativo"),
      ]);
      const montoFmt = new Intl.NumberFormat("es-MX", {
        style: "currency", currency: "MXN",
      }).format(monto);

      const notis: any[] = [];
      const residenteId: string | null = (est as any).creado_por ?? null;

      if (residenteId && residenteId !== userId) {
        notis.push({
          user_id: residenteId,
          company_id: est.company_id,
          obra_id: d0.obra_id,
          tipo: "estimacion_subcontrato_autorizada_residente",
          titulo: "Tu estimación de subcontrato fue autorizada",
          mensaje: `${folio} · ${contratistaNombre} · ${montoFmt}${obraNombre ? " · obra " + obraNombre : ""}. Lista para programar pago.`,
          link: `/app/obras/${d0.obra_id}/subcontratos?subcontrato=${d0.id}`,
        });
      }

      const adminIds = Array.from(
        new Set(
          [
            ...((roles ?? []).map((r: any) => r.user_id)),
            ...((adminsObra ?? []).map((r: any) => r.user_id)),
          ].filter((uid: string) => uid && uid !== userId && uid !== residenteId),
        ),
      );
      const titulo = "Estimación de subcontrato autorizada";
      const mensaje = `${folio} · ${contratistaNombre} · ${montoFmt}${obraNombre ? " · obra " + obraNombre : ""}. Lista para programar pago.`;
      for (const uid of adminIds) {
        notis.push({
          user_id: uid,
          company_id: est.company_id,
          obra_id: d0.obra_id,
          tipo: "estimacion_subcontrato_autorizada",
          titulo,
          mensaje,
          link: `/app/obras/${d0.obra_id}/subcontratos?subcontrato=${d0.id}`,
        });
      }

      if (notis.length > 0) {
        await supabaseAdmin.from("notificaciones").insert(notis);
      }
    } catch (e: any) {
      console.error("[notificaciones] estimacion subcontrato autorizada:", e?.message);
    }

    return { ok: true, cxpId: (cxp as any).id, folio: (cxp as any).folio };
  });

export const rechazarEstimacionSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      motivo: z.string().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_subcontrato_estimaciones")
      .select("id, subcontrato_id, company_id, estatus, creado_por, numero")
      .eq("id", data.id)
      .single();
    if (!est) throw new Error("Estimación no encontrada");
    if (est.estatus !== "cerrada") {
      throw new Error("Solo se rechazan estimaciones cerradas");
    }
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id, nombre").eq("id", est.subcontrato_id).single();
    const allowed = await canAutorizarEstimacionSubcontrato(supabase, userId, d0!.obra_id);
    if (!allowed) throw new Error("Solo el supervisor o director pueden rechazar");

    const { error } = await supabase
      .from("obra_subcontrato_estimaciones")
      .update({
        estatus: "rechazada",
        rechazada_at: new Date().toISOString(),
        rechazada_por: userId,
        rechazo_motivo: data.motivo,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    try {
      if (est.creado_por && est.creado_por !== userId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("notificaciones").insert({
          user_id: est.creado_por,
          company_id: est.company_id,
          obra_id: d0!.obra_id,
          tipo: "estimacion_subcontrato_rechazada",
          titulo: "Estimación rechazada",
          mensaje: `La estimación ${est.numero} del subcontrato ${d0!.nombre} fue rechazada: ${data.motivo}`,
          link: `/app/obras/${d0!.obra_id}/subcontratos?subcontrato=${est.subcontrato_id}`,
        });
      }
    } catch (e: any) {
      console.error("[notificaciones] estimacion subcontrato rechazada:", e?.message);
    }

    return { ok: true };
  });

export const reabrirEstimacionSubcontratoRechazada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_subcontrato_estimaciones")
      .select("subcontrato_id, estatus")
      .eq("id", data.id)
      .single();
    if (!est) throw new Error("No encontrada");
    if (est.estatus !== "rechazada") {
      throw new Error("Solo se reabren estimaciones rechazadas");
    }
    const { data: d0 } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", est.subcontrato_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    const { error } = await supabase
      .from("obra_subcontrato_estimaciones")
      .update({
        estatus: "borrador",
        rechazada_at: null,
        rechazada_por: null,
        rechazo_motivo: null,
        cerrada_at: null,
        cerrada_por: null,
        amortizacion_anticipo: 0,
        retencion_fondo: 0,
        liberacion_fondo: 0,
        monto_neto: 0,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// SOLICITUD Y PAGO DE ANTICIPO DE SUBCONTRATO
// ============================================================

async function notifyAdminsAnticipoSubcontratoSolicitado(
  supabase: any,
  args: {
    companyId: string;
    obraId: string;
    obraNombre: string;
    subcontratoNombre: string;
    contratistaNombre: string;
    monto: number;
    solicitanteId: string;
    solicitanteNombre: string;
  },
) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("company_id", args.companyId)
    .in("role", ["director", "administrativo"]);
  const destinatarios = Array.from(
    new Set(
      ((roles ?? []) as Array<{ user_id: string }>)
        .map((r) => r.user_id)
        .filter((u) => u && u !== args.solicitanteId),
    ),
  );
  if (destinatarios.length === 0) return;

  const montoFmt = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(args.monto);

  const titulo = "Solicitud de pago de anticipo";
  const mensaje = `${args.solicitanteNombre} solicitó el pago del anticipo (${montoFmt}) para el subcontrato ${args.subcontratoNombre} · ${args.contratistaNombre} en la obra ${args.obraNombre}.`;
  const link = `/app/admin/cuentas-por-pagar`;

  const rows = destinatarios.map((uid) => ({
    user_id: uid,
    company_id: args.companyId,
    obra_id: args.obraId,
    tipo: "anticipo_subcontrato_solicitado",
    titulo,
    mensaje,
    link,
  }));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("notificaciones").insert(rows);
  if (error) console.error("[notificaciones] anticipo subcontrato solicitado:", error.message);
}

export const getSubcontratoAnticipo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subcontratoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: anticipo } = await supabase
      .from("obra_subcontrato_anticipos")
      .select("*")
      .eq("subcontrato_id", data.subcontratoId)
      .maybeSingle();

    let pagadoPorNombre: string | null = null;
    if (anticipo?.pagado_por) {
      const { data: prof } = await supabase
        .from("profiles").select("nombre_completo").eq("id", anticipo.pagado_por).maybeSingle();
      pagadoPorNombre = (prof as any)?.nombre_completo ?? null;
    }

    const { data: ests } = await supabase
      .from("obra_subcontrato_estimaciones")
      .select("amortizacion_anticipo, retencion_fondo, liberacion_fondo")
      .eq("subcontrato_id", data.subcontratoId)
      .in("estatus", ["cerrada", "autorizada", "pagada"]);
    const amortAcum = (ests ?? []).reduce((s: number, r: any) => s + Number(r.amortizacion_anticipo ?? 0), 0);
    const fondoRetenido = (ests ?? []).reduce((s: number, r: any) => s + Number(r.retencion_fondo ?? 0), 0);
    const fondoLiberado = (ests ?? []).reduce((s: number, r: any) => s + Number(r.liberacion_fondo ?? 0), 0);
    return {
      anticipo: anticipo ? { ...anticipo, pagado_por_nombre: pagadoPorNombre } : null,
      anticipoAmortizado: amortAcum,
      fondoRetenido,
      fondoLiberado,
      fondoSaldo: Math.max(0, fondoRetenido - fondoLiberado),
    };
  });

export const solicitarPagoAnticipoSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subcontratoId: z.string().uuid(),
      notas: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: subcontrato } = await supabase
      .from("obra_subcontratos")
      .select(
        "id, obra_id, company_id, nombre, anticipo_monto, contratista:contratista_id(razon_social), obra:obra_id(nombre)",
      )
      .eq("id", data.subcontratoId)
      .maybeSingle();
    if (!subcontrato) throw new Error("Subcontrato no encontrado");

    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, subcontrato.obra_id);
    if (!isDirector && !obraRole.isResidente) {
      throw new Error("Solo el Residente (o Director) puede solicitar el pago del anticipo");
    }

    const { data: base } = await supabase
      .from("obra_subcontrato_presupuestos")
      .select("estatus")
      .eq("subcontrato_id", data.subcontratoId)
      .eq("tipo", "base")
      .maybeSingle();
    if (!base || base.estatus !== "autorizado") {
      throw new Error("El presupuesto base debe estar autorizado");
    }

    const { data: anticipo } = await supabase
      .from("obra_subcontrato_anticipos")
      .select("id, pagado, solicitado_at, monto, folio")
      .eq("subcontrato_id", data.subcontratoId)
      .maybeSingle();
    if (!anticipo) throw new Error("No hay anticipo registrado");
    if (anticipo.pagado) throw new Error("El anticipo ya está pagado");
    if (anticipo.solicitado_at) throw new Error("Ya se solicitó el pago del anticipo");
    if (Number(anticipo.monto) <= 0) throw new Error("El monto del anticipo es 0");

    let folio = (anticipo as any).folio as string | null;
    if (!folio) {
      const { data: folioData, error: folioErr } = await supabase
        .rpc("siguiente_folio_anticipo_subcontrato", { _company_id: subcontrato.company_id });
      if (folioErr) throw new Error(folioErr.message);
      folio = folioData as string;
    }

    const { error } = await supabase
      .from("obra_subcontrato_anticipos")
      .update({
        solicitado_at: new Date().toISOString(),
        solicitado_por: userId,
        solicitud_notas: data.notas ?? null,
        folio,
      } as any)
      .eq("id", anticipo.id);
    if (error) throw new Error(error.message);

    const { data: prof } = await supabase
      .from("profiles").select("nombre_completo").eq("id", userId).maybeSingle();

    try {
      await notifyAdminsAnticipoSubcontratoSolicitado(supabase, {
        companyId: subcontrato.company_id,
        obraId: subcontrato.obra_id,
        obraNombre: (subcontrato.obra as any)?.nombre ?? "",
        subcontratoNombre: subcontrato.nombre,
        contratistaNombre: (subcontrato.contratista as any)?.razon_social ?? "",
        monto: Number(anticipo.monto),
        solicitanteId: userId,
        solicitanteNombre: prof?.nombre_completo ?? "Un residente",
      });
    } catch (e: any) {
      console.error("[notificaciones] anticipo subcontrato solicitado:", e?.message);
    }

    return { ok: true, folio };
  });

export const cancelarSolicitudAnticipoSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subcontratoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: subcontrato } = await supabase
      .from("obra_subcontratos").select("obra_id").eq("id", data.subcontratoId).maybeSingle();
    if (!subcontrato) throw new Error("Subcontrato no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, subcontrato.obra_id);
    if (!isDirector && !obraRole.isResidente) throw new Error("Sin permisos");

    const { data: ant } = await supabase
      .from("obra_subcontrato_anticipos")
      .select("id, pagado, solicitado_at, solicitado_por")
      .eq("subcontrato_id", data.subcontratoId).maybeSingle();
    if (!ant) throw new Error("Anticipo no encontrado");
    if (ant.pagado) throw new Error("El anticipo ya fue pagado");
    if (!ant.solicitado_at) throw new Error("No hay solicitud activa");
    if (!isDirector && ant.solicitado_por !== userId) {
      throw new Error("Solo quien solicitó (o Director) puede cancelar");
    }
    const { error } = await supabase
      .from("obra_subcontrato_anticipos")
      .update({ solicitado_at: null, solicitado_por: null, solicitud_notas: null })
      .eq("id", ant.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAnticiposSubcontratoPendientes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getRoles(supabase, userId);
    const { data: rolesData } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("company_id", companyId);
    const roleSet = new Set((rolesData ?? []).map((r: any) => r.role as string));
    if (!isDirector && !roleSet.has("administrativo")) {
      throw new Error("No tienes permisos");
    }

    const { data, error } = await supabase
      .from("obra_subcontrato_anticipos")
      .select(
        "id, subcontrato_id, monto, folio, solicitado_at, solicitud_notas, solicitado_por, " +
        "subcontrato:subcontrato_id(id, nombre, numero, monto_total, anticipo_pct, obra_id, contratista:contratista_id(razon_social), obra:obra_id(id, nombre))",
      )
      .eq("company_id", companyId)
      .eq("pagado", false)
      .not("solicitado_at", "is", null)
      .order("solicitado_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set(((data ?? []) as any[]).map((r) => r.solicitado_por).filter(Boolean)),
    );
    let profMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, nombre_completo").in("id", ids);
      profMap = Object.fromEntries(
        ((profs ?? []) as any[]).map((p) => [p.id, p.nombre_completo ?? ""]),
      );
    }

    return ((data ?? []) as any[]).map((r) => ({
      anticipoId: r.id,
      subcontratoId: r.subcontrato_id,
      monto: Number(r.monto),
      folio: r.folio ?? null,
      solicitadoAt: r.solicitado_at,
      notas: r.solicitud_notas,
      solicitadoPor: r.solicitado_por,
      solicitadoPorNombre: profMap[r.solicitado_por] ?? "—",
      subcontratoNombre: r.subcontrato?.nombre ?? "",
      subcontratoNumero: r.subcontrato?.numero ?? null,
      subcontratoMontoTotal: Number(r.subcontrato?.monto_total ?? 0),
      subcontratoAnticipoPct: Number(r.subcontrato?.anticipo_pct ?? 0),
      contratistaNombre: r.subcontrato?.contratista?.razon_social ?? "",
      obraId: r.subcontrato?.obra?.id ?? null,
      obraNombre: r.subcontrato?.obra?.nombre ?? "",
    }));
  });

export const pagarAnticipoSubcontrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      subcontratoId: z.string().uuid(),
      cuentaId: z.string().uuid(),
      monto: z.number().positive(),
      metodo: z.enum(["efectivo", "transferencia", "cheque"]),
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      referencia: z.string().trim().max(120).optional().nullable(),
      notas: z.string().trim().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getRoles(supabase, userId);
    const { data: rolesData } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("company_id", companyId);
    const roleSet = new Set((rolesData ?? []).map((r: any) => r.role as string));
    if (!isDirector && !roleSet.has("administrativo")) {
      throw new Error("Solo Director o Administrativo pueden registrar el pago");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ant } = await supabaseAdmin
      .from("obra_subcontrato_anticipos")
      .select("id, company_id, subcontrato_id, monto, pagado, solicitado_at, solicitado_por, folio")
      .eq("subcontrato_id", data.subcontratoId).maybeSingle();

    if (!ant || ant.company_id !== companyId) throw new Error("Anticipo no encontrado");
    if (ant.pagado) throw new Error("El anticipo ya está pagado");
    if (!ant.solicitado_at) throw new Error("Falta solicitar el pago antes de registrarlo");

    const montoAnticipo = Number(ant.monto);
    if (Math.abs(data.monto - montoAnticipo) > 0.01) {
      throw new Error(`El monto debe coincidir con el anticipo (${montoAnticipo.toFixed(2)})`);
    }

    const { data: cuenta } = await supabaseAdmin
      .from("cuentas")
      .select("id, company_id, tipo, activa, saldo_actual, nombre")
      .eq("id", data.cuentaId).maybeSingle();
    if (!cuenta || cuenta.company_id !== companyId) throw new Error("Cuenta no encontrada");
    if (!cuenta.activa) throw new Error("La cuenta está inactiva");
    if (cuenta.tipo === "caja_fuerte" && data.metodo !== "efectivo") {
      throw new Error("La caja fuerte solo admite pagos en efectivo");
    }
    if (cuenta.tipo === "bancaria" && data.metodo === "efectivo") {
      throw new Error("Las cuentas bancarias no admiten pagos en efectivo");
    }
    if (data.monto > Number(cuenta.saldo_actual) + 0.01) {
      throw new Error("El monto excede el saldo disponible de la cuenta");
    }

    const { data: subcontrato } = await supabaseAdmin
      .from("obra_subcontratos")
      .select("nombre, obra_id, contratista:contratista_id(razon_social), obra:obra_id(nombre)")
      .eq("id", data.subcontratoId).maybeSingle();
    const subNombre = subcontrato?.nombre ?? "Subcontrato";
    const contratistaNombre = (subcontrato?.contratista as any)?.razon_social ?? "";
    const obraId = (subcontrato as any)?.obra_id ?? null;
    const obraNombre = (subcontrato as any)?.obra?.nombre ?? "";
    const concepto = `Anticipo subcontrato · ${subNombre}${contratistaNombre ? " · " + contratistaNombre : ""}`;

    const { data: pago, error: pErr } = await supabaseAdmin
      .from("pagos")
      .insert({
        company_id: companyId,
        cuenta_id: data.cuentaId,
        fecha: data.fecha,
        monto: data.monto,
        metodo: data.metodo,
        referencia: data.referencia || null,
        concepto,
        notas: data.notas || null,
        origen_tipo: "subcontrato",
        origen_id: ant.id,
        creado_por: userId,
      })
      .select("id").single();
    if (pErr) throw new Error(pErr.message);

    const { data: mov, error: mErr } = await supabaseAdmin
      .from("cuenta_movimientos")
      .insert({
        cuenta_id: data.cuentaId,
        company_id: companyId,
        fecha: data.fecha,
        tipo: "egreso",
        monto: data.monto,
        concepto,
        referencia: data.referencia || null,
        origen: "pago",
        origen_id: pago.id,
        creado_por: userId,
      })
      .select("id").single();
    if (mErr) {
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(mErr.message);
    }

    await supabaseAdmin.from("pagos").update({ cuenta_movimiento_id: mov.id }).eq("id", pago.id);

    const nuevoSaldo = +(Number(cuenta.saldo_actual) - data.monto).toFixed(2);
    const { error: sErr } = await supabaseAdmin
      .from("cuentas").update({ saldo_actual: nuevoSaldo }).eq("id", data.cuentaId);
    if (sErr) {
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(sErr.message);
    }

    const { error: aErr } = await supabaseAdmin
      .from("obra_subcontrato_anticipos")
      .update({
        pagado: true,
        pagado_at: new Date().toISOString(),
        pagado_por: userId,
        fecha: data.fecha,
        metodo_pago: data.metodo,
        referencia: data.referencia || null,
      })
      .eq("id", ant.id);
    if (aErr) {
      await supabaseAdmin.from("cuentas").update({ saldo_actual: cuenta.saldo_actual }).eq("id", data.cuentaId);
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(aErr.message);
    }

    const asientoId = crypto.randomUUID();
    const cuentaAbono = cuenta.tipo === "caja_fuerte" ? "Caja fuerte" : "Bancos";
    const refAsiento = ant.folio || data.referencia || null;
    const { error: asErr } = await supabaseAdmin
      .from("asientos_contables")
      .insert([
        {
          company_id: companyId,
          asiento_id: asientoId,
          fecha: data.fecha,
          concepto,
          referencia: refAsiento,
          origen_tipo: "anticipo_subcontrato",
          origen_id: ant.id,
          tipo_movimiento: "cargo",
          cuenta_contable: "Anticipos a contratistas",
          monto: data.monto,
          creado_por: userId,
        },
        {
          company_id: companyId,
          asiento_id: asientoId,
          fecha: data.fecha,
          concepto,
          referencia: refAsiento,
          origen_tipo: "anticipo_subcontrato",
          origen_id: ant.id,
          tipo_movimiento: "abono",
          cuenta_contable: cuentaAbono,
          monto: data.monto,
          creado_por: userId,
        },
      ]);
    if (asErr) {
      await supabaseAdmin.from("obra_subcontrato_anticipos").update({
        pagado: false, pagado_at: null, pagado_por: null,
      }).eq("id", ant.id);
      await supabaseAdmin.from("cuentas").update({ saldo_actual: cuenta.saldo_actual }).eq("id", data.cuentaId);
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(asErr.message);
    }

    try {
      if (ant.solicitado_por && ant.solicitado_por !== userId) {
        const montoFmt = new Intl.NumberFormat("es-MX", {
          style: "currency", currency: "MXN",
        }).format(data.monto);
        const titulo = "Anticipo pagado";
        const mensaje = `Se pagó el anticipo (${montoFmt}) del subcontrato ${subNombre}${contratistaNombre ? " · " + contratistaNombre : ""}${obraNombre ? " en la obra " + obraNombre : ""}.`;
        await supabaseAdmin.from("notificaciones").insert({
          user_id: ant.solicitado_por,
          company_id: companyId,
          obra_id: obraId,
          tipo: "anticipo_subcontrato_pagado",
          titulo,
          mensaje,
          link: `/app/obras/${obraId}/subcontratos?subcontrato=${data.subcontratoId}`,
        });
      }
    } catch (e: any) {
      console.error("[notificaciones] anticipo subcontrato pagado:", e?.message);
    }

    return { ok: true, pagoId: pago.id, asientoId };
  });
