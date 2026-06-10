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

// ============================================================
// CRUD DESTAJOS
// ============================================================

export const listDestajos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: destajos, error } = await supabase
      .from("obra_destajos")
      .select("id, obra_id, destajista_id, numero, nombre, descripcion, estatus, monto_total, anticipo_pct, anticipo_monto, fondo_garantia_pct, created_at")
      .eq("obra_id", data.obraId)
      .order("numero", { ascending: true });
    if (error) throw new Error(error.message);
    const dst = destajos ?? [];
    const trabIds = Array.from(new Set(dst.map((d: any) => d.destajista_id)));
    let trabs: any[] = [];
    if (trabIds.length > 0) {
      const { data: t } = await supabase
        .from("trabajadores").select("id, nombre_completo").in("id", trabIds);
      trabs = t ?? [];
    }
    const trabMap = new Map(trabs.map((t: any) => [t.id, t.nombre_completo]));

    // Acumulado pagado y avance % (sobre base autorizada)
    const ids = dst.map((d: any) => d.id);
    let pagadosMap = new Map<string, number>();
    let baseEstatusMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: ests } = await supabase
        .from("obra_destajo_estimaciones")
        .select("destajo_id, monto_total, estatus")
        .in("destajo_id", ids).eq("estatus", "cerrada");
      for (const e of ests ?? []) {
        pagadosMap.set(e.destajo_id, (pagadosMap.get(e.destajo_id) ?? 0) + Number(e.monto_total));
      }
      const { data: bases } = await supabase
        .from("obra_destajo_presupuestos")
        .select("destajo_id, estatus")
        .in("destajo_id", ids).eq("tipo", "base");
      for (const b of bases ?? []) {
        baseEstatusMap.set(b.destajo_id, b.estatus);
      }
    }

    return dst.map((d: any) => ({
      ...d,
      destajista_nombre: trabMap.get(d.destajista_id) ?? "—",
      pagado_acumulado: pagadosMap.get(d.id) ?? 0,
      estatus_base: baseEstatusMap.get(d.id) ?? "borrador",
    }));
  });

export const getDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: destajo, error } = await supabase
      .from("obra_destajos").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: presupuestos } = await supabase
      .from("obra_destajo_presupuestos")
      .select("id, tipo, numero, nombre, descripcion, estatus, monto_total, enviado_at, autorizado_at, rechazado_at, rechazo_motivo, created_at")
      .eq("destajo_id", data.id)
      .order("tipo", { ascending: true })
      .order("numero", { ascending: true });
    const { data: trabs } = await supabase
      .from("obra_destajo_trabajadores")
      .select("id, trabajador_id, asignado_at, desasignado_at")
      .eq("destajo_id", data.id)
      .is("desasignado_at", null);
    let trabajadores: any[] = [];
    if ((trabs ?? []).length > 0) {
      const ids = (trabs ?? []).map((t: any) => t.trabajador_id);
      const { data: t } = await supabase
        .from("trabajadores").select("id, nombre_completo, puesto").in("id", ids);
      trabajadores = (trabs ?? []).map((a: any) => ({
        ...a,
        trabajador: (t ?? []).find((x: any) => x.id === a.trabajador_id) ?? null,
      }));
    }
    const { data: destajista } = await supabase
      .from("trabajadores").select("id, nombre_completo, puesto").eq("id", destajo.destajista_id).maybeSingle();
    return {
      destajo: { ...destajo, destajista },
      presupuestos: presupuestos ?? [],
      trabajadores,
    };
  });

export const crearDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      destajistaId: z.string().uuid(),
      nombre: z.string().trim().min(1).max(255),
      descripcion: z.string().trim().max(1000).optional(),
      anticipoPct: z.number().min(0).max(100).optional(),
      fondoGarantiaPct: z.number().min(0).max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, data.obraId);
    if (!isDirector && !member) throw new Error("Sin permisos para crear destajos en esta obra");

    const { data: maxRow } = await supabase
      .from("obra_destajos").select("numero")
      .eq("obra_id", data.obraId)
      .order("numero", { ascending: false }).limit(1).maybeSingle();
    const numero = (maxRow?.numero ?? 0) + 1;

    const anticipoPct = Number(data.anticipoPct ?? 0);
    const fondoPct = Number(data.fondoGarantiaPct ?? 0);

    const { data: created, error } = await supabase
      .from("obra_destajos")
      .insert({
        obra_id: data.obraId,
        company_id: companyId,
        destajista_id: data.destajistaId,
        numero,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
        anticipo_pct: anticipoPct,
        anticipo_monto: 0, // se calcula al autorizar la base con monto_total final
        fondo_garantia_pct: fondoPct,
        creado_por: userId,
      })
      .select("id").single();
    if (error) throw new Error(error.message);

    // Asignar al destajista como trabajador del destajo (si no está activo en otro)
    const { data: ocupado } = await supabase
      .from("obra_destajo_trabajadores")
      .select("id")
      .eq("trabajador_id", data.destajistaId)
      .is("desasignado_at", null)
      .maybeSingle();
    if (!ocupado) {
      await supabase
        .from("obra_destajo_trabajadores")
        .insert({
          destajo_id: created.id,
          trabajador_id: data.destajistaId,
          asignado_por: userId,
        });
    }

    // Crear presupuesto base en borrador
    const { data: presBase, error: pbErr } = await supabase
      .from("obra_destajo_presupuestos")
      .insert({
        destajo_id: created.id,
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

export const actualizarTerminosDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      destajoId: z.string().uuid(),
      anticipoPct: z.number().min(0).max(100),
      fondoGarantiaPct: z.number().min(0).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id, monto_total").eq("id", data.destajoId).single();
    if (!d0) throw new Error("Destajo no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");

    // Si ya hay anticipo registrado (pagado), no permitir cambiar el %
    const { data: ant } = await supabase
      .from("obra_destajo_anticipos").select("id, pagado").eq("destajo_id", data.destajoId).maybeSingle();
    if (ant?.pagado) throw new Error("El anticipo ya fue marcado como pagado; no se pueden modificar los términos");

    const anticipoMonto = Number(d0.monto_total ?? 0) * (data.anticipoPct / 100);
    const { error } = await supabase
      .from("obra_destajos")
      .update({
        anticipo_pct: data.anticipoPct,
        anticipo_monto: anticipoMonto,
        fondo_garantia_pct: data.fondoGarantiaPct,
      })
      .eq("id", data.destajoId);
    if (error) throw new Error(error.message);

    // Sincronizar monto del registro de anticipo si existe (no pagado)
    if (ant && !ant.pagado) {
      await supabase
        .from("obra_destajo_anticipos")
        .update({ monto: anticipoMonto })
        .eq("id", ant.id);
    }
    return { ok: true };
  });



export const eliminarDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_destajos").select("estatus, obra_id, company_id").eq("id", data.id).single();
    if (!d0) throw new Error("Destajo no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    // Solo eliminar si todos los presupuestos están en borrador y no hay estimaciones cerradas
    const { data: ests } = await supabase
      .from("obra_destajo_estimaciones").select("id, estatus")
      .eq("destajo_id", data.id).eq("estatus", "cerrada").limit(1);
    if ((ests ?? []).length > 0)
      throw new Error("No se puede eliminar: hay estimaciones cerradas");
    const { data: base } = await supabase
      .from("obra_destajo_presupuestos")
      .select("estatus").eq("destajo_id", data.id).eq("tipo", "base").maybeSingle();
    if (base && base.estatus !== "borrador")
      throw new Error("No se puede eliminar: el presupuesto ya fue enviado a autorización");
    const { error } = await supabase
      .from("obra_destajos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Presupuestos del destajo (base + adendas) + flujo autorización
// ============================================================

export const getDestajoPresupuesto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: presupuesto, error } = await supabase
      .from("obra_destajo_presupuestos")
      .select("*, obra_destajos!inner(id, obra_id, company_id, destajista_id, nombre, numero, anticipo_pct, anticipo_monto, fondo_garantia_pct, trabajadores:destajista_id(id, nombre_completo, puesto))")
      .eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: renglones } = await supabase
      .from("obra_destajo_renglones")
      .select("*")
      .eq("presupuesto_destajo_id", data.id)
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

export const guardarRenglonesDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      presupuestoDestajoId: z.string().uuid(),
      renglones: z.array(renglonSchema).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pres } = await supabase
      .from("obra_destajo_presupuestos")
      .select("id, estatus, tipo, destajo_id")
      .eq("id", data.presupuestoDestajoId).single();
    if (!pres) throw new Error("Presupuesto no encontrado");
    if (pres.estatus !== "borrador")
      throw new Error("El presupuesto ya fue enviado/autorizado y no se puede editar");
    if (pres.tipo !== "base")
      throw new Error("Este endpoint es solo para presupuestos base. Usa la captura de OC.");

    const { isDirector } = await getRoles(supabase, userId);
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", pres.destajo_id).single();
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
      .from("obra_destajo_renglones").delete()
      .eq("presupuesto_destajo_id", data.presupuestoDestajoId);
    if (delErr) throw new Error(delErr.message);

    if (renglones.length > 0) {
      const rows = renglones.map((r) => ({
        presupuesto_destajo_id: data.presupuestoDestajoId,
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
      const { error } = await supabase.from("obra_destajo_renglones").insert(rows);
      if (error) throw new Error(error.message);
    }

    const { error: updErr } = await supabase
      .from("obra_destajo_presupuestos").update({ monto_total: montoTotal })
      .eq("id", data.presupuestoDestajoId);
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

async function loadDestajoBaseYOcs(supabase: any, destajoId: string) {
  const { data: presupuestos } = await supabase
    .from("obra_destajo_presupuestos")
    .select("id, tipo, numero, estatus")
    .eq("destajo_id", destajoId);
  const base = (presupuestos ?? []).find(
    (p: any) => p.tipo === "base" && p.estatus === "autorizado",
  );
  const ocs = (presupuestos ?? [])
    .filter((p: any) => p.tipo === "adenda" && p.estatus === "autorizado")
    .sort((a: any, b: any) => a.numero - b.numero);

  let baseRenglones: RenglonBase[] = [];
  if (base) {
    const { data: r } = await supabase
      .from("obra_destajo_renglones").select("*")
      .eq("presupuesto_destajo_id", base.id).order("orden", { ascending: true });
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
      .from("obra_destajo_renglones").select("*")
      .eq("presupuesto_destajo_id", oc.id).order("orden", { ascending: true });
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

export const getVigenteDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ destajoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { base, baseRenglones, ocsRenglones } = await loadDestajoBaseYOcs(supabase, data.destajoId);
    if (!base) return { vigente: [], montoTotal: 0, hasBase: false };
    const { vigente, montoTotal } = reconstruirVigente(baseRenglones, ocsRenglones);
    return { vigente, montoTotal, hasBase: true };
  });

export const guardarRenglonesOCDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      presupuestoDestajoId: z.string().uuid(),
      renglones: z.array(ocInputSchema).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pres } = await supabase
      .from("obra_destajo_presupuestos")
      .select("id, destajo_id, tipo, estatus")
      .eq("id", data.presupuestoDestajoId).single();
    if (!pres) throw new Error("Presupuesto no encontrado");
    if (pres.tipo !== "adenda") throw new Error("Solo para órdenes de cambio");
    if (pres.estatus !== "borrador")
      throw new Error("La orden de cambio ya fue enviada/autorizada");

    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", pres.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");

    const { baseRenglones, ocsRenglones } = await loadDestajoBaseYOcs(supabase, pres.destajo_id);
    const { vigente } = reconstruirVigente(baseRenglones, ocsRenglones);

    const { renglones, errores, montoDelta } = procesarOrdenCambio(vigente, data.renglones as OCInput[]);
    if (errores.length > 0) {
      throw new Error(
        `Errores en ${errores.length} renglón(es): ${errores
          .slice(0, 3).map((e) => `${e.clave || "(s/c)"}: ${e.errores.join(", ")}`).join(" | ")}`,
      );
    }

    const { error: delErr } = await supabase
      .from("obra_destajo_renglones").delete()
      .eq("presupuesto_destajo_id", data.presupuestoDestajoId);
    if (delErr) throw new Error(delErr.message);

    if (renglones.length > 0) {
      const rows = renglones.map((r) => ({
        presupuesto_destajo_id: data.presupuestoDestajoId,
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
      const { error } = await supabase.from("obra_destajo_renglones").insert(rows);
      if (error) throw new Error(error.message);
    }

    const { error: updErr } = await supabase
      .from("obra_destajo_presupuestos").update({ monto_total: montoDelta })
      .eq("id", data.presupuestoDestajoId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, montoDelta, renglonesCount: renglones.length };
  });

export const crearOrdenCambioDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      destajoId: z.string().uuid(),
      nombre: z.string().trim().min(1).max(255),
      descripcion: z.string().trim().max(1000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", data.destajoId).single();
    if (!d0) throw new Error("Destajo no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0.obra_id);
    if (!isDirector && !obraRole.isResidente)
      throw new Error("Solo el Residente de la obra (o el Director) puede solicitar órdenes de cambio");

    // Requiere base autorizado
    const { data: base } = await supabase
      .from("obra_destajo_presupuestos").select("id, estatus")
      .eq("destajo_id", data.destajoId).eq("tipo", "base").maybeSingle();
    if (!base || base.estatus !== "autorizado")
      throw new Error("Primero autoriza el presupuesto base del destajo");

    const { data: maxRow } = await supabase
      .from("obra_destajo_presupuestos").select("numero")
      .eq("destajo_id", data.destajoId).eq("tipo", "adenda")
      .order("numero", { ascending: false }).limit(1).maybeSingle();
    const numero = (maxRow?.numero ?? 0) + 1;

    const { data: created, error } = await supabase
      .from("obra_destajo_presupuestos")
      .insert({
        destajo_id: data.destajoId,
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

// Flujo autorización
async function recalcDestajoTotal(supabase: any, destajoId: string) {
  const { base, baseRenglones, ocsRenglones } = await loadDestajoBaseYOcs(supabase, destajoId);
  if (!base) return 0;
  const { montoTotal } = reconstruirVigente(baseRenglones, ocsRenglones);
  // Recomputar anticipo_monto basado en el % vigente y el nuevo monto total
  const { data: d0 } = await supabase
    .from("obra_destajos").select("anticipo_pct").eq("id", destajoId).maybeSingle();
  const anticipoPct = Number(d0?.anticipo_pct ?? 0);
  const anticipoMonto = montoTotal * (anticipoPct / 100);
  await supabase
    .from("obra_destajos")
    .update({ monto_total: montoTotal, anticipo_monto: anticipoMonto })
    .eq("id", destajoId);
  return montoTotal;
}

async function ensureAnticipoRecord(supabase: any, destajoId: string, userId: string) {
  const { data: destajo } = await supabase
    .from("obra_destajos")
    .select("id, company_id, anticipo_monto")
    .eq("id", destajoId).single();
  if (!destajo) return;
  const monto = Number(destajo.anticipo_monto ?? 0);
  if (monto <= 0) return;
  const { data: existing } = await supabase
    .from("obra_destajo_anticipos").select("id, pagado, monto").eq("destajo_id", destajoId).maybeSingle();
  if (!existing) {
    await supabase.from("obra_destajo_anticipos").insert({
      destajo_id: destajoId,
      company_id: destajo.company_id,
      monto,
      creado_por: userId,
    });
  } else if (!existing.pagado && Number(existing.monto) !== monto) {
    await supabase.from("obra_destajo_anticipos").update({ monto }).eq("id", existing.id);
  }
}


export const enviarPresupuestoDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presupuestoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("obra_destajo_presupuestos").select("id, estatus, destajo_id, tipo").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "borrador") throw new Error("Solo se puede solicitar desde borrador");
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", p.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0!.obra_id);
    // Adendas: residente solicita. Base: cualquier miembro o director (no es OC).
    if (p.tipo === "adenda") {
      if (!isDirector && !obraRole.isResidente)
        throw new Error("Solo el Residente (o Director) puede solicitar la autorización");
    } else {
      const member = await isMemberObra(supabase, userId, d0!.obra_id);
      if (!isDirector && !member) throw new Error("Sin permisos");
    }
    const { count } = await supabase
      .from("obra_destajo_renglones")
      .select("id", { count: "exact", head: true })
      .eq("presupuesto_destajo_id", data.presupuestoId);
    if (!count) throw new Error("Sin renglones capturados");
    const { error } = await supabase
      .from("obra_destajo_presupuestos")
      .update({ estatus: "enviado", enviado_at: new Date().toISOString(), enviado_por: userId })
      .eq("id", data.presupuestoId);
    if (error) throw new Error(error.message);

    const link = `/app/obras/${d0!.obra_id}/destajos?destajo=${p.destajo_id}`;
    try {
      await notifySupervisoresOC(supabase, {
        userId,
        obraId: d0!.obra_id,
        tipo: p.tipo === "adenda" ? "oc_destajo_solicitada" : "destajo_solicitado",
        link,
      });
    } catch (e: any) {
      console.error("[notificaciones] destajo solicitado error", e?.message);
    }

    return { ok: true };
  });


export const autorizarPresupuestoDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presupuestoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("obra_destajo_presupuestos").select("id, estatus, destajo_id, tipo, enviado_por").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "enviado") throw new Error("Solo se puede autorizar una solicitud");
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", p.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0!.obra_id);
    if (!isDirector && !obraRole.isSupervisor)
      throw new Error("Solo el Supervisor de la obra (o el Director) puede autorizar");
    if (p.tipo === "adenda" && p.enviado_por && p.enviado_por === userId && !isDirector)
      throw new Error("No puedes autorizar una OC que tú mismo solicitaste");
    const { error } = await supabase
      .from("obra_destajo_presupuestos")
      .update({ estatus: "autorizado", autorizado_at: new Date().toISOString(), autorizado_por: userId })
      .eq("id", data.presupuestoId);
    if (error) throw new Error(error.message);
    await recalcDestajoTotal(supabase, p.destajo_id);
    // Si es el presupuesto base autorizado, generar registro de anticipo
    if (p.tipo === "base") {
      await ensureAnticipoRecord(supabase, p.destajo_id, userId);
    }


    const link = `/app/obras/${d0!.obra_id}/destajos?destajo=${p.destajo_id}`;
    try {
      await notifyResidenteOC(supabase, {
        residenteId: p.enviado_por,
        actorUserId: userId,
        obraId: d0!.obra_id,
        tipo: p.tipo === "adenda" ? "oc_destajo_autorizada" : "destajo_autorizado",
        link,
      });
    } catch (e: any) {
      console.error("[notificaciones] destajo autorizado error", e?.message);
    }

    return { ok: true };
  });


export const rechazarPresupuestoDestajo = createServerFn({ method: "POST" })
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
      .from("obra_destajo_presupuestos").select("estatus, destajo_id, tipo, enviado_por").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "enviado") throw new Error("Solo se puede rechazar una solicitud");
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", p.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0!.obra_id);
    if (!isDirector && !obraRole.isSupervisor)
      throw new Error("Solo el Supervisor de la obra (o el Director) puede rechazar");
    // Base: vuelve a borrador con motivo registrado (sin estado rechazado intermedio).
    // Adenda: queda como rechazado y requiere "reabrir".
    const update =
      p.tipo === "base"
        ? {
            estatus: "borrador" as const,
            enviado_at: null,
            enviado_por: null,
            rechazado_at: new Date().toISOString(),
            rechazado_por: userId,
            rechazo_motivo: data.motivo,
          }
        : {
            estatus: "rechazado" as const,
            rechazado_at: new Date().toISOString(),
            rechazado_por: userId,
            rechazo_motivo: data.motivo,
          };
    const { error } = await supabase
      .from("obra_destajo_presupuestos")
      .update(update)
      .eq("id", data.presupuestoId);
    if (error) throw new Error(error.message);

    const link = `/app/obras/${d0!.obra_id}/destajos?destajo=${p.destajo_id}`;
    try {
      await notifyResidenteOC(supabase, {
        residenteId: p.enviado_por,
        actorUserId: userId,
        obraId: d0!.obra_id,
        tipo: p.tipo === "adenda" ? "oc_destajo_rechazada" : "destajo_rechazado",
        link,
        motivo: data.motivo,
      });
    } catch (e: any) {
      console.error("[notificaciones] destajo rechazado error", e?.message);
    }

    return { ok: true };
  });


export const reabrirPresupuestoDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presupuestoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("obra_destajo_presupuestos").select("estatus, destajo_id, tipo").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "rechazado")
      throw new Error("Solo presupuestos rechazados se pueden reabrir como borrador");
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", p.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, d0!.obra_id);
    if (p.tipo === "adenda") {
      if (!isDirector && !obraRole.isResidente) throw new Error("Sin permisos");
    } else {
      const member = await isMemberObra(supabase, userId, d0!.obra_id);
      if (!isDirector && !member) throw new Error("Sin permisos");
    }
    const { error } = await supabase
      .from("obra_destajo_presupuestos")
      .update({ estatus: "borrador", rechazado_at: null, rechazado_por: null, rechazo_motivo: null })
      .eq("id", data.presupuestoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Trabajadores asignados al destajo
// ============================================================

export const listAsignacionesActivas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({}).parse(d ?? {}))
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("obra_destajo_trabajadores")
      .select("trabajador_id, destajo_id, obra_destajos!inner(nombre, obra_id)")
      .is("desasignado_at", null);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      trabajador_id: r.trabajador_id,
      destajo_id: r.destajo_id,
      destajo_nombre: r.obra_destajos?.nombre ?? "—",
      obra_id: r.obra_destajos?.obra_id ?? null,
    }));
  });

export const asignarTrabajadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      destajoId: z.string().uuid(),
      trabajadorIds: z.array(z.string().uuid()).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", data.destajoId).single();
    if (!d0) throw new Error("Destajo no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");

    const { data: existing } = await supabase
      .from("obra_destajo_trabajadores")
      .select("id, trabajador_id, desasignado_at")
      .eq("destajo_id", data.destajoId);

    const existingActivos = new Map<string, string>(); // trab_id -> row_id
    const existingInactivos = new Map<string, string>();
    for (const r of existing ?? []) {
      if (r.desasignado_at == null) existingActivos.set(r.trabajador_id, r.id);
      else existingInactivos.set(r.trabajador_id, r.id);
    }
    const incoming = new Set(data.trabajadorIds);

    // 1. Desasignar los que ya no están
    const toRemoveIds = [...existingActivos.entries()]
      .filter(([t]) => !incoming.has(t))
      .map(([, id]) => id);
    if (toRemoveIds.length > 0) {
      await supabase
        .from("obra_destajo_trabajadores")
        .update({ desasignado_at: new Date().toISOString(), desasignado_por: userId })
        .in("id", toRemoveIds);
    }

    // 2. Para los nuevos: verificar que no estén activos en otro destajo
    const toAdd = data.trabajadorIds.filter((t) => !existingActivos.has(t));
    if (toAdd.length > 0) {
      const { data: conflicts } = await supabase
        .from("obra_destajo_trabajadores")
        .select("trabajador_id, destajo_id, obra_destajos!inner(nombre)")
        .in("trabajador_id", toAdd)
        .is("desasignado_at", null)
        .neq("destajo_id", data.destajoId);
      if ((conflicts ?? []).length > 0) {
        const names = (conflicts ?? []).map((c: any) => c.obra_destajos?.nombre ?? c.destajo_id).join(", ");
        throw new Error(`Trabajadores ya activos en otro destajo: ${names}`);
      }

      // Reactivar previas o insertar nuevas
      for (const t of toAdd) {
        const prevId = existingInactivos.get(t);
        if (prevId) {
          await supabase
            .from("obra_destajo_trabajadores")
            .update({
              desasignado_at: null,
              desasignado_por: null,
              asignado_at: new Date().toISOString(),
              asignado_por: userId,
            })
            .eq("id", prevId);
        } else {
          const { error } = await supabase
            .from("obra_destajo_trabajadores")
            .insert({ destajo_id: data.destajoId, trabajador_id: t, asignado_por: userId });
          if (error) throw new Error(error.message);
        }
      }
    }
    return { ok: true, asignados: data.trabajadorIds.length };
  });

export const getTrabajadoresBloqueadosPorDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("obra_destajo_trabajadores")
      .select("trabajador_id, destajo_id, obra_destajos!inner(id, obra_id, nombre, destajista_id)")
      .is("desasignado_at", null);
    if (error) throw new Error(error.message);
    // Filter: el destajo es de cualquier obra de la company (mostrar) PERO marcamos los de ESTA obra como "bloqueados aquí".
    // El criterio: si está activo en cualquier destajo, NO puede capturarse nómina (su pago va por destajo).
    return (rows ?? []).map((r: any) => ({
      trabajador_id: r.trabajador_id,
      destajo_id: r.destajo_id,
      destajo_nombre: r.obra_destajos?.nombre ?? "—",
      obra_id: r.obra_destajos?.obra_id ?? null,
      esta_obra: r.obra_destajos?.obra_id === data.obraId,
    }));
  });

// ============================================================
// ESTIMACIONES DEL DESTAJO
// ============================================================

export const listEstimacionesDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ destajoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("obra_destajo_estimaciones")
      .select("id, numero, semana_inicio, semana_fin, estatus, monto_total, cerrada_at, created_at")
      .eq("destajo_id", data.destajoId)
      .order("semana_inicio", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

async function loadVigenteDestajoData(supabase: any, destajoId: string) {
  const { base, baseRenglones, ocsRenglones } = await loadDestajoBaseYOcs(supabase, destajoId);
  if (!base) return { vigente: [] as any[], hasBase: false };
  const { vigente } = reconstruirVigente(baseRenglones, ocsRenglones);
  return { vigente, hasBase: true };
}

export const getOrCreateEstimacionDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      destajoId: z.string().uuid(),
      semanaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_destajos")
      .select("obra_id, company_id, anticipo_pct, anticipo_monto, fondo_garantia_pct")
      .eq("id", data.destajoId).single();
    if (!d0) throw new Error("Destajo no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0.obra_id);
    const canEdit = isDirector || member;

    const semana = calcularSemana(data.semanaInicio);
    const { data: existente } = await supabase
      .from("obra_destajo_estimaciones")
      .select("*").eq("destajo_id", data.destajoId).eq("semana_inicio", semana.inicio).maybeSingle();

    let estimacion = existente;
    if (!estimacion) {
      if (!canEdit) throw new Error("Sin permisos para crear estimaciones");
      const { data: maxRow } = await supabase
        .from("obra_destajo_estimaciones").select("numero")
        .eq("destajo_id", data.destajoId)
        .order("numero", { ascending: false }).limit(1).maybeSingle();
      const numero = (maxRow?.numero ?? 0) + 1;
      const { data: created, error } = await supabase
        .from("obra_destajo_estimaciones")
        .insert({
          destajo_id: data.destajoId,
          company_id: d0.company_id,
          numero,
          semana_inicio: semana.inicio,
          semana_fin: semana.fin,
          creado_por: userId,
        }).select("*").single();
      if (error) throw new Error(error.message);
      estimacion = created;
    }

    const { vigente, hasBase } = await loadVigenteDestajoData(supabase, data.destajoId);

    const { data: renglones } = await supabase
      .from("obra_destajo_estimacion_renglones")
      .select("renglon_clave, cantidad_ejecutada")
      .eq("estimacion_id", estimacion.id);
    const capturados: Record<string, number> = {};
    for (const r of renglones ?? []) capturados[r.renglon_clave] = Number(r.cantidad_ejecutada ?? 0);

    const { data: prevs } = await supabase
      .from("obra_destajo_estimaciones").select("id")
      .eq("destajo_id", data.destajoId).eq("estatus", "cerrada")
      .lt("semana_inicio", semana.inicio);
    const prevIds = (prevs ?? []).map((p: any) => p.id);
    const acumuladoPrevio: Record<string, number> = {};
    if (prevIds.length > 0) {
      const { data: prevRows } = await supabase
        .from("obra_destajo_estimacion_renglones")
        .select("renglon_clave, cantidad_ejecutada")
        .in("estimacion_id", prevIds);
      for (const r of prevRows ?? []) {
        acumuladoPrevio[r.renglon_clave] = (acumuladoPrevio[r.renglon_clave] ?? 0) + Number(r.cantidad_ejecutada ?? 0);
      }
    }

    // Saldos para mostrar amortización/retención sugeridas
    const { data: cerradas } = await supabase
      .from("obra_destajo_estimaciones")
      .select("amortizacion_anticipo, retencion_fondo, liberacion_fondo")
      .eq("destajo_id", data.destajoId).eq("estatus", "cerrada");
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

export const guardarEstimacionDestajo = createServerFn({ method: "POST" })
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
      .from("obra_destajo_estimaciones").select("*").eq("id", data.estimacionId).single();
    if (!est) throw new Error("Estimación no encontrada");
    if (est.estatus !== "borrador") throw new Error("Estimación cerrada");
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", est.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");

    const { vigente } = await loadVigenteDestajoData(supabase, est.destajo_id);
    const vigPorClave = new Map<string, any>();
    for (const n of vigente) vigPorClave.set(n.clave, n);

    const { data: prevs } = await supabase
      .from("obra_destajo_estimaciones").select("id")
      .eq("destajo_id", est.destajo_id).eq("estatus", "cerrada")
      .lt("semana_inicio", est.semana_inicio);
    const prevIds = (prevs ?? []).map((p: any) => p.id);
    const acumPrev = new Map<string, number>();
    if (prevIds.length > 0) {
      const { data: prevRows } = await supabase
        .from("obra_destajo_estimacion_renglones")
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

    await supabase.from("obra_destajo_estimacion_renglones").delete().eq("estimacion_id", data.estimacionId);
    let montoTotal = 0;
    if (rows.length > 0) {
      const { error } = await supabase.from("obra_destajo_estimacion_renglones").insert(rows);
      if (error) throw new Error(error.message);
      montoTotal = rows.reduce((s, r) => s + r.importe_ejecutado, 0);
    }
    await supabase.from("obra_destajo_estimaciones").update({ monto_total: montoTotal }).eq("id", data.estimacionId);
    return { ok: true, montoTotal, renglonesCount: rows.length };
  });

export const cerrarEstimacionDestajo = createServerFn({ method: "POST" })
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
      .from("obra_destajo_estimaciones").select("*").eq("id", data.id).single();
    if (!est) throw new Error("No encontrada");
    if (est.estatus !== "borrador") throw new Error("Ya cerrada");
    const { data: d0 } = await supabase
      .from("obra_destajos")
      .select("id, obra_id, anticipo_pct, anticipo_monto, fondo_garantia_pct")
      .eq("id", est.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    const { count } = await supabase
      .from("obra_destajo_estimacion_renglones")
      .select("id", { count: "exact", head: true })
      .eq("estimacion_id", data.id);
    if (!count) throw new Error("Estimación sin cantidades");

    const bruto = Number(est.monto_total ?? 0);
    const anticipoPct = Number(d0!.anticipo_pct ?? 0);
    const fondoPct = Number(d0!.fondo_garantia_pct ?? 0);
    const anticipoMonto = Number(d0!.anticipo_monto ?? 0);

    // Saldo pendiente del anticipo = anticipo_monto - SUM(amortizacion_anticipo) en estimaciones cerradas previas
    const { data: prevAmort } = await supabase
      .from("obra_destajo_estimaciones")
      .select("amortizacion_anticipo")
      .eq("destajo_id", est.destajo_id)
      .eq("estatus", "cerrada")
      .neq("id", data.id);
    const amortAcum = (prevAmort ?? []).reduce((s: number, r: any) => s + Number(r.amortizacion_anticipo ?? 0), 0);
    const saldoAnticipo = Math.max(0, anticipoMonto - amortAcum);
    const amortizacion = Math.min(saldoAnticipo, bruto * (anticipoPct / 100));

    const retencion = bruto * (fondoPct / 100);

    // Validar liberación del fondo: no exceder fondo retenido neto acumulado
    const { data: prevFondo } = await supabase
      .from("obra_destajo_estimaciones")
      .select("retencion_fondo, liberacion_fondo")
      .eq("destajo_id", est.destajo_id)
      .eq("estatus", "cerrada")
      .neq("id", data.id);
    const fondoAcumPrev = (prevFondo ?? []).reduce(
      (s: number, r: any) => s + Number(r.retencion_fondo ?? 0) - Number(r.liberacion_fondo ?? 0),
      0,
    );
    const fondoDisponible = Math.max(0, fondoAcumPrev + retencion);
    const liberacion = Math.min(Number(data.liberacionFondo ?? 0), fondoDisponible);

    const neto = bruto - amortizacion - retencion + liberacion;

    const { error } = await supabase
      .from("obra_destajo_estimaciones")
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
    return { ok: true, bruto, amortizacion, retencion, liberacion, neto };
  });

export const getDestajoAnticipo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ destajoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: anticipo } = await supabase
      .from("obra_destajo_anticipos")
      .select("*")
      .eq("destajo_id", data.destajoId)
      .maybeSingle();
    // Saldo pendiente del anticipo
    const { data: ests } = await supabase
      .from("obra_destajo_estimaciones")
      .select("amortizacion_anticipo, retencion_fondo, liberacion_fondo")
      .eq("destajo_id", data.destajoId)
      .eq("estatus", "cerrada");
    const amortAcum = (ests ?? []).reduce((s: number, r: any) => s + Number(r.amortizacion_anticipo ?? 0), 0);
    const fondoRetenido = (ests ?? []).reduce((s: number, r: any) => s + Number(r.retencion_fondo ?? 0), 0);
    const fondoLiberado = (ests ?? []).reduce((s: number, r: any) => s + Number(r.liberacion_fondo ?? 0), 0);
    return {
      anticipo: anticipo ?? null,
      anticipoAmortizado: amortAcum,
      fondoRetenido,
      fondoLiberado,
      fondoSaldo: Math.max(0, fondoRetenido - fondoLiberado),
    };
  });

export const marcarAnticipoPagado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      destajoId: z.string().uuid(),
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      metodoPago: z.string().trim().max(50).optional(),
      referencia: z.string().trim().max(255).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", data.destajoId).single();
    if (!d0) throw new Error("Destajo no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    const { data: existing } = await supabase
      .from("obra_destajo_anticipos").select("id").eq("destajo_id", data.destajoId).maybeSingle();
    if (!existing) throw new Error("No hay anticipo registrado");
    const { error } = await supabase
      .from("obra_destajo_anticipos")
      .update({
        pagado: true,
        pagado_at: new Date().toISOString(),
        fecha: data.fecha ?? new Date().toISOString().slice(0, 10),
        metodo_pago: data.metodoPago ?? null,
        referencia: data.referencia ?? null,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const eliminarEstimacionDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_destajo_estimaciones").select("destajo_id, estatus").eq("id", data.id).single();
    if (!est) throw new Error("No encontrada");
    if (est.estatus === "cerrada") throw new Error("No se elimina una cerrada");
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", est.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    const { error } = await supabase
      .from("obra_destajo_estimaciones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ============================================================
// SOLICITUD Y PAGO DE ANTICIPO DE DESTAJO
// ============================================================

async function notifyAdminsAnticipoSolicitado(
  supabase: any,
  args: {
    companyId: string;
    obraId: string;
    obraNombre: string;
    destajoNombre: string;
    destajistaNombre: string;
    monto: number;
    solicitanteId: string;
    solicitanteNombre: string;
  },
) {
  // Destinatarios: usuarios con rol director o administrativo en la empresa
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
  const mensaje = `${args.solicitanteNombre} solicitó el pago del anticipo (${montoFmt}) para el destajo ${args.destajoNombre} · ${args.destajistaNombre} en la obra ${args.obraNombre}.`;
  const link = `/app/admin/cuentas-por-pagar`;

  const rows = destinatarios.map((uid) => ({
    user_id: uid,
    company_id: args.companyId,
    obra_id: args.obraId,
    tipo: "anticipo_destajo_solicitado",
    titulo,
    mensaje,
    link,
  }));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("notificaciones").insert(rows);
  if (error) console.error("[notificaciones] anticipo destajo solicitado:", error.message);
}

export const solicitarPagoAnticipoDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      destajoId: z.string().uuid(),
      notas: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: destajo } = await supabase
      .from("obra_destajos")
      .select(
        "id, obra_id, company_id, nombre, anticipo_monto, destajista:destajista_id(nombre_completo), obra:obra_id(nombre)",
      )
      .eq("id", data.destajoId)
      .maybeSingle();
    if (!destajo) throw new Error("Destajo no encontrado");

    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, destajo.obra_id);
    if (!isDirector && !obraRole.isResidente) {
      throw new Error("Solo el Residente (o Director) puede solicitar el pago del anticipo");
    }

    // Presupuesto base autorizado
    const { data: base } = await supabase
      .from("obra_destajo_presupuestos")
      .select("estatus")
      .eq("destajo_id", data.destajoId)
      .eq("tipo", "base")
      .maybeSingle();
    if (!base || base.estatus !== "autorizado") {
      throw new Error("El presupuesto base debe estar autorizado");
    }

    const { data: anticipo } = await supabase
      .from("obra_destajo_anticipos")
      .select("id, pagado, solicitado_at, monto, folio")
      .eq("destajo_id", data.destajoId)
      .maybeSingle();
    if (!anticipo) throw new Error("No hay anticipo registrado");
    if (anticipo.pagado) throw new Error("El anticipo ya está pagado");
    if (anticipo.solicitado_at) throw new Error("Ya se solicitó el pago del anticipo");
    if (Number(anticipo.monto) <= 0) throw new Error("El monto del anticipo es 0");

    let folio = (anticipo as any).folio as string | null;
    if (!folio) {
      const { data: folioData, error: folioErr } = await supabase
        .rpc("siguiente_folio_anticipo_destajo", { _company_id: destajo.company_id });
      if (folioErr) throw new Error(folioErr.message);
      folio = folioData as string;
    }

    const { error } = await supabase
      .from("obra_destajo_anticipos")
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
      await notifyAdminsAnticipoSolicitado(supabase, {
        companyId: destajo.company_id,
        obraId: destajo.obra_id,
        obraNombre: (destajo.obra as any)?.nombre ?? "",
        destajoNombre: destajo.nombre,
        destajistaNombre: (destajo.destajista as any)?.nombre_completo ?? "",
        monto: Number(anticipo.monto),
        solicitanteId: userId,
        solicitanteNombre: prof?.nombre_completo ?? "Un residente",
      });
    } catch (e: any) {
      console.error("[notificaciones] anticipo solicitado:", e?.message);
    }

    return { ok: true, folio };
  });


export const cancelarSolicitudAnticipoDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ destajoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: destajo } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", data.destajoId).maybeSingle();
    if (!destajo) throw new Error("Destajo no encontrado");
    const { isDirector } = await getRoles(supabase, userId);
    const obraRole = await getObraRole(supabase, userId, destajo.obra_id);
    if (!isDirector && !obraRole.isResidente) throw new Error("Sin permisos");

    const { data: ant } = await supabase
      .from("obra_destajo_anticipos")
      .select("id, pagado, solicitado_at, solicitado_por")
      .eq("destajo_id", data.destajoId).maybeSingle();
    if (!ant) throw new Error("Anticipo no encontrado");
    if (ant.pagado) throw new Error("El anticipo ya fue pagado");
    if (!ant.solicitado_at) throw new Error("No hay solicitud activa");
    if (!isDirector && ant.solicitado_por !== userId) {
      throw new Error("Solo quien solicitó (o Director) puede cancelar");
    }
    const { error } = await supabase
      .from("obra_destajo_anticipos")
      .update({ solicitado_at: null, solicitado_por: null, solicitud_notas: null })
      .eq("id", ant.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAnticiposDestajoPendientes = createServerFn({ method: "GET" })
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
      .from("obra_destajo_anticipos")
      .select(
        "id, destajo_id, monto, solicitado_at, solicitud_notas, solicitado_por, " +
        "destajo:destajo_id(id, nombre, numero, obra_id, destajista:destajista_id(nombre_completo), obra:obra_id(id, nombre))",
      )
      .eq("company_id", companyId)
      .eq("pagado", false)
      .not("solicitado_at", "is", null)
      .order("solicitado_at", { ascending: true });
    if (error) throw new Error(error.message);

    // Resolver nombre del solicitante
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
      destajoId: r.destajo_id,
      monto: Number(r.monto),
      solicitadoAt: r.solicitado_at,
      notas: r.solicitud_notas,
      solicitadoPor: r.solicitado_por,
      solicitadoPorNombre: profMap[r.solicitado_por] ?? "—",
      destajoNombre: r.destajo?.nombre ?? "",
      destajoNumero: r.destajo?.numero ?? null,
      destajistaNombre: r.destajo?.destajista?.nombre_completo ?? "",
      obraId: r.destajo?.obra?.id ?? null,
      obraNombre: r.destajo?.obra?.nombre ?? "",
    }));
  });

export const pagarAnticipoDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      destajoId: z.string().uuid(),
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
      .from("obra_destajo_anticipos")
      .select("id, company_id, destajo_id, monto, pagado, solicitado_at")
      .eq("destajo_id", data.destajoId).maybeSingle();
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

    const { data: destajo } = await supabaseAdmin
      .from("obra_destajos")
      .select("nombre, destajista:destajista_id(nombre_completo)")
      .eq("id", data.destajoId).maybeSingle();
    const destNombre = destajo?.nombre ?? "Destajo";
    const destajistaNombre = (destajo?.destajista as any)?.nombre_completo ?? "";
    const concepto = `Anticipo destajo · ${destNombre}${destajistaNombre ? " · " + destajistaNombre : ""}`;

    // 1) pago
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
        origen_tipo: "destajo",
        origen_id: ant.id,
        creado_por: userId,
      })
      .select("id").single();
    if (pErr) throw new Error(pErr.message);

    // 2) movimiento
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

    // 3) saldo cuenta
    const nuevoSaldo = +(Number(cuenta.saldo_actual) - data.monto).toFixed(2);
    const { error: sErr } = await supabaseAdmin
      .from("cuentas").update({ saldo_actual: nuevoSaldo }).eq("id", data.cuentaId);
    if (sErr) {
      await supabaseAdmin.from("cuenta_movimientos").delete().eq("id", mov.id);
      await supabaseAdmin.from("pagos").delete().eq("id", pago.id);
      throw new Error(sErr.message);
    }

    // 4) marcar anticipo pagado
    const { error: aErr } = await supabaseAdmin
      .from("obra_destajo_anticipos")
      .update({
        pagado: true,
        pagado_at: new Date().toISOString(),
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

    return { ok: true, pagoId: pago.id };
  });
