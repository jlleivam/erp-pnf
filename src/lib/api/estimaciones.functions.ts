import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reconstruirVigente, type RenglonBase, type RenglonOC } from "@/lib/presupuesto-utils";
import { calcularSemana } from "@/lib/estimacion-utils";

async function getCompanyAndAccess(supabase: any, userId: string, obraId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const companyId = profile.company_id as string;

  const { data: dir } = await supabase
    .from("user_roles").select("id")
    .eq("user_id", userId).eq("company_id", companyId).eq("role", "director")
    .maybeSingle();
  const isDirector = !!dir;

  const { data: team } = await supabase
    .from("obra_team").select("id")
    .eq("obra_id", obraId).eq("user_id", userId).maybeSingle();
  const isObraMember = !!team;

  return { companyId, isDirector, isObraMember, canEdit: isDirector || isObraMember };
}

async function loadVigente(supabase: any, obraId: string) {
  const { data: presupuestos, error } = await supabase
    .from("obra_presupuestos")
    .select("id, tipo, numero, estatus")
    .eq("obra_id", obraId);
  if (error) throw new Error(error.message);

  const base = (presupuestos ?? []).find(
    (p: any) => p.tipo === "base" && p.estatus === "autorizado",
  );
  const ocs = (presupuestos ?? [])
    .filter((p: any) => p.tipo === "adenda" && p.estatus === "autorizado")
    .sort((a: any, b: any) => a.numero - b.numero);

  if (!base) return { vigente: [], hasBase: false };

  const { data: br } = await supabase
    .from("obra_presupuesto_renglones").select("*")
    .eq("presupuesto_id", base.id).order("orden", { ascending: true });

  const baseRenglones: RenglonBase[] = (br ?? []).map((x: any) => ({
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

  const ocsRenglones: RenglonOC[][] = [];
  for (const oc of ocs) {
    const { data: r } = await supabase
      .from("obra_presupuesto_renglones").select("*")
      .eq("presupuesto_id", oc.id).order("orden", { ascending: true });
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
  const { vigente } = reconstruirVigente(baseRenglones, ocsRenglones);
  return { vigente, hasBase: true };
}

export const listEstimaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("obra_estimaciones")
      .select("id, numero, semana_inicio, semana_fin, estatus, monto_total, cerrada_at, created_at")
      .eq("obra_id", data.obraId)
      .order("semana_inicio", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getOrCreateBorrador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      semanaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, canEdit } = await getCompanyAndAccess(supabase, userId, data.obraId);

    const semana = calcularSemana(data.semanaInicio);

    // Buscar existente
    const { data: existente } = await supabase
      .from("obra_estimaciones")
      .select("*")
      .eq("obra_id", data.obraId)
      .eq("semana_inicio", semana.inicio)
      .maybeSingle();

    let estimacion = existente;
    if (!estimacion) {
      if (!canEdit) throw new Error("No tiene permisos para crear estimaciones en esta obra");
      // numero = max + 1
      const { data: maxRow } = await supabase
        .from("obra_estimaciones").select("numero")
        .eq("obra_id", data.obraId)
        .order("numero", { ascending: false }).limit(1).maybeSingle();
      const numero = (maxRow?.numero ?? 0) + 1;

      const { data: created, error } = await supabase
        .from("obra_estimaciones")
        .insert({
          obra_id: data.obraId,
          company_id: companyId,
          numero,
          semana_inicio: semana.inicio,
          semana_fin: semana.fin,
          creado_por: userId,
        })
        .select("*").single();
      if (error) throw new Error(error.message);
      estimacion = created;
    }

    // Vigente actual
    const { vigente, hasBase } = await loadVigente(supabase, data.obraId);

    // Renglones ya capturados
    const { data: renglones } = await supabase
      .from("obra_estimacion_renglones")
      .select("renglon_clave, cantidad_ejecutada, importe_ejecutado")
      .eq("estimacion_id", estimacion.id);
    const capturados = new Map<string, number>();
    for (const r of renglones ?? []) {
      capturados.set(r.renglon_clave, Number(r.cantidad_ejecutada ?? 0));
    }

    // Acumulado previo: cantidades de semanas anteriores a la vigente
    const { data: prevs } = await supabase
      .from("obra_estimaciones")
      .select("id")
      .eq("obra_id", data.obraId)
      .lt("semana_inicio", semana.inicio);
    const prevIds = (prevs ?? []).map((p: any) => p.id);

    const acumuladoPrevio = new Map<string, number>();
    if (prevIds.length > 0) {
      const { data: prevRows } = await supabase
        .from("obra_estimacion_renglones")
        .select("renglon_clave, cantidad_ejecutada")
        .in("estimacion_id", prevIds);
      for (const r of prevRows ?? []) {
        acumuladoPrevio.set(
          r.renglon_clave,
          (acumuladoPrevio.get(r.renglon_clave) ?? 0) + Number(r.cantidad_ejecutada ?? 0),
        );
      }
    }

    return {
      estimacion,
      vigente,
      hasBase,
      capturados: Object.fromEntries(capturados),
      acumuladoPrevio: Object.fromEntries(acumuladoPrevio),
    };
  });

export const guardarRenglonesEstimacion = createServerFn({ method: "POST" })
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

    const { data: est, error: estErr } = await supabase
      .from("obra_estimaciones").select("*")
      .eq("id", data.estimacionId).single();
    if (estErr || !est) throw new Error("Estimación no encontrada");
    if (est.estatus !== "borrador")
      throw new Error("La estimación está cerrada y no se puede modificar");

    const { canEdit } = await getCompanyAndAccess(supabase, userId, est.obra_id);
    if (!canEdit) throw new Error("No tiene permisos para editar esta estimación");

    // Cargar vigente y acumulado previo
    const { vigente } = await loadVigente(supabase, est.obra_id);
    const vigentePorClave = new Map<string, (typeof vigente)[number]>();
    for (const n of vigente) vigentePorClave.set(n.clave, n);

    const { data: prevs } = await supabase
      .from("obra_estimaciones").select("id")
      .eq("obra_id", est.obra_id).eq("estatus", "cerrada")
      .lt("semana_inicio", est.semana_inicio);
    const prevIds = (prevs ?? []).map((p: any) => p.id);
    const acumuladoPrevio = new Map<string, number>();
    if (prevIds.length > 0) {
      const { data: prevRows } = await supabase
        .from("obra_estimacion_renglones")
        .select("renglon_clave, cantidad_ejecutada")
        .in("estimacion_id", prevIds);
      for (const r of prevRows ?? []) {
        acumuladoPrevio.set(
          r.renglon_clave,
          (acumuladoPrevio.get(r.renglon_clave) ?? 0) + Number(r.cantidad_ejecutada ?? 0),
        );
      }
    }

    // Validar y construir filas
    const errores: { clave: string; mensaje: string }[] = [];
    type Row = {
      renglon_clave: string;
      concepto: string;
      unidad: string | null;
      cantidad_vigente: number;
      pu_vigente: number;
      cantidad_ejecutada: number;
      importe_ejecutado: number;
    };
    const rows: Row[] = [];

    for (const r of data.renglones) {
      if (r.cantidad_ejecutada <= 0) continue;
      const vig = vigentePorClave.get(r.renglon_clave);
      if (!vig) {
        errores.push({ clave: r.renglon_clave, mensaje: "Concepto no existe en el vigente" });
        continue;
      }
      if (vig.es_grupo) {
        errores.push({ clave: r.renglon_clave, mensaje: "No se puede capturar en un grupo" });
        continue;
      }
      const cantVig = Number(vig.cantidad ?? 0);
      const acumPrev = acumuladoPrevio.get(r.renglon_clave) ?? 0;
      const nuevoAcum = acumPrev + r.cantidad_ejecutada;
      if (cantVig > 0 && nuevoAcum > cantVig + 0.0001) {
        const exceso = nuevoAcum - cantVig;
        errores.push({
          clave: r.renglon_clave,
          mensaje: `Excede vigente por ${exceso.toLocaleString("es-MX", { maximumFractionDigits: 2 })}. Levante una OC-P.`,
        });
        continue;
      }
      const pu = Number(vig.precio_unitario ?? 0);
      rows.push({
        renglon_clave: r.renglon_clave,
        concepto: vig.concepto,
        unidad: vig.unidad,
        cantidad_vigente: cantVig,
        pu_vigente: pu,
        cantidad_ejecutada: r.cantidad_ejecutada,
        importe_ejecutado: r.cantidad_ejecutada * pu,
      });
    }

    if (errores.length > 0) {
      const head = errores.slice(0, 3).map((e) => `${e.clave}: ${e.mensaje}`).join(" | ");
      throw new Error(`${errores.length} error(es): ${head}`);
    }

    // Reemplazar renglones de la estimación
    const { error: delErr } = await supabase
      .from("obra_estimacion_renglones").delete()
      .eq("estimacion_id", data.estimacionId);
    if (delErr) throw new Error(delErr.message);

    let montoTotal = 0;
    if (rows.length > 0) {
      const toInsert = rows.map((r) => ({ ...r, estimacion_id: data.estimacionId }));
      const { error: insErr } = await supabase
        .from("obra_estimacion_renglones").insert(toInsert);
      if (insErr) throw new Error(insErr.message);
      montoTotal = rows.reduce((s, r) => s + r.importe_ejecutado, 0);
    }

    const { error: updErr } = await supabase
      .from("obra_estimaciones")
      .update({ monto_total: montoTotal })
      .eq("id", data.estimacionId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, montoTotal, renglonesCount: rows.length };
  });

export const cerrarEstimacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: est } = await supabase
      .from("obra_estimaciones").select("*").eq("id", data.id).single();
    if (!est) throw new Error("Estimación no encontrada");
    if (est.estatus !== "borrador")
      throw new Error("Esta estimación ya está cerrada");

    const { canEdit } = await getCompanyAndAccess(supabase, userId, est.obra_id);
    if (!canEdit) throw new Error("No tiene permisos para cerrar esta estimación");

    const { count } = await supabase
      .from("obra_estimacion_renglones")
      .select("id", { count: "exact", head: true })
      .eq("estimacion_id", data.id);
    if (!count || count === 0)
      throw new Error("La estimación no tiene cantidades capturadas");

    const { error } = await supabase
      .from("obra_estimaciones")
      .update({
        estatus: "cerrada",
        cerrada_por: userId,
        cerrada_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const getEstimacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: estimacion, error } = await supabase
      .from("obra_estimaciones").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: renglones } = await supabase
      .from("obra_estimacion_renglones")
      .select("*")
      .eq("estimacion_id", data.id)
      .order("renglon_clave", { ascending: true });
    return { estimacion, renglones: renglones ?? [] };
  });

export const eliminarEstimacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase
      .from("obra_estimaciones").select("obra_id, estatus").eq("id", data.id).single();
    if (!est) throw new Error("Estimación no encontrada");
    if (est.estatus === "cerrada")
      throw new Error("No se puede eliminar una estimación cerrada");
    const { canEdit } = await getCompanyAndAccess(supabase, userId, est.obra_id);
    if (!canEdit) throw new Error("Sin permisos");
    const { error } = await supabase
      .from("obra_estimaciones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
