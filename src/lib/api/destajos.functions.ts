import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
      .select("id, obra_id, destajista_id, numero, nombre, descripcion, estatus, monto_total, created_at")
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

    const { data: created, error } = await supabase
      .from("obra_destajos")
      .insert({
        obra_id: data.obraId,
        company_id: companyId,
        destajista_id: data.destajistaId,
        numero,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
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
      .select("*, obra_destajos!inner(id, obra_id, company_id, destajista_id, nombre, numero)")
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
    const member = await isMemberObra(supabase, userId, d0.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");

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
  await supabase.from("obra_destajos").update({ monto_total: montoTotal }).eq("id", destajoId);
  return montoTotal;
}

export const enviarPresupuestoDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presupuestoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("obra_destajo_presupuestos").select("id, estatus, destajo_id").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "borrador") throw new Error("Solo se puede enviar desde borrador");
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
    return { ok: true };
  });

export const autorizarPresupuestoDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presupuestoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isDirector, isSupervisor } = await getRoles(supabase, userId);
    if (!isDirector && !isSupervisor)
      throw new Error("Solo Director o Supervisor pueden autorizar");
    const { data: p } = await supabase
      .from("obra_destajo_presupuestos").select("id, estatus, destajo_id").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "enviado") throw new Error("Solo se puede autorizar un envío");
    const { error } = await supabase
      .from("obra_destajo_presupuestos")
      .update({ estatus: "autorizado", autorizado_at: new Date().toISOString(), autorizado_por: userId })
      .eq("id", data.presupuestoId);
    if (error) throw new Error(error.message);
    await recalcDestajoTotal(supabase, p.destajo_id);
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
    const { isDirector, isSupervisor } = await getRoles(supabase, userId);
    if (!isDirector && !isSupervisor)
      throw new Error("Solo Director o Supervisor pueden rechazar");
    const { data: p } = await supabase
      .from("obra_destajo_presupuestos").select("estatus").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "enviado") throw new Error("Solo se puede rechazar un envío");
    const { error } = await supabase
      .from("obra_destajo_presupuestos")
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

export const reabrirPresupuestoDestajo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ presupuestoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase
      .from("obra_destajo_presupuestos").select("estatus, destajo_id").eq("id", data.presupuestoId).single();
    if (!p) throw new Error("No encontrado");
    if (p.estatus !== "rechazado")
      throw new Error("Solo presupuestos rechazados se pueden reabrir como borrador");
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", p.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
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
      .from("obra_destajos").select("obra_id, company_id").eq("id", data.destajoId).single();
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

    return { estimacion, vigente, hasBase, capturados, acumuladoPrevio };
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
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_destajo_estimaciones").select("*").eq("id", data.id).single();
    if (!est) throw new Error("No encontrada");
    if (est.estatus !== "borrador") throw new Error("Ya cerrada");
    const { data: d0 } = await supabase
      .from("obra_destajos").select("obra_id").eq("id", est.destajo_id).single();
    const { isDirector } = await getRoles(supabase, userId);
    const member = await isMemberObra(supabase, userId, d0!.obra_id);
    if (!isDirector && !member) throw new Error("Sin permisos");
    const { count } = await supabase
      .from("obra_destajo_estimacion_renglones")
      .select("id", { count: "exact", head: true })
      .eq("estimacion_id", data.id);
    if (!count) throw new Error("Estimación sin cantidades");
    const { error } = await supabase
      .from("obra_destajo_estimaciones")
      .update({ estatus: "cerrada", cerrada_at: new Date().toISOString(), cerrada_por: userId })
      .eq("id", data.id);
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
