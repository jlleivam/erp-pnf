import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularSemana } from "@/lib/estimacion-utils";

async function getAccess(supabase: any, userId: string, obraId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const companyId = profile.company_id as string;

  const { data: roles } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("company_id", companyId);
  const roleSet = new Set((roles ?? []).map((r: any) => r.role));
  const isDirector = roleSet.has("director");
  const isAdmin = roleSet.has("administrativo");

  const { data: team } = await supabase
    .from("obra_team").select("role")
    .eq("obra_id", obraId).eq("user_id", userId);
  const teamRoles = new Set((team ?? []).map((t: any) => t.role));
  const isObraResidente = teamRoles.has("residente");
  const isObraMember = (team ?? []).length > 0;

  return {
    companyId,
    isDirector,
    isAdmin,
    isObraMember,
    isObraResidente,
    canEdit: isDirector || isObraResidente,
  };
}

function recalcRenglon(asistencias: { jornada: number; horas_extras: number }[], sueldo: number) {
  let dias = 0;
  let horas = 0;
  for (const a of asistencias) {
    dias += Number(a.jornada ?? 0);
    horas += Number(a.horas_extras ?? 0);
  }
  const importeJornadas = dias * sueldo;
  const importeExtras = horas * (sueldo / 8);
  return {
    dias_trabajados: dias,
    horas_extras_total: horas,
    importe_jornadas: importeJornadas,
    importe_extras: importeExtras,
    importe_total: importeJornadas + importeExtras,
  };
}

export const getNominaAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { canEdit, isDirector, isObraResidente } = await getAccess(supabase, userId, data.obraId);
    return { canEdit, isDirector, isObraResidente };
  });

export const listNominas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("obra_nominas")
      .select("id, numero, semana_inicio, semana_fin, estatus, monto_total, cerrada_at, created_at")
      .eq("obra_id", data.obraId)
      .order("semana_inicio", { ascending: false });
    if (error) throw new Error(error.message);
    const nominas = rows ?? [];
    const ids = nominas.map((n: any) => n.id);
    const countsMap = new Map<string, number>();
    if (ids.length > 0) {
      const { data: rens } = await supabase
        .from("obra_nomina_renglones")
        .select("nomina_id")
        .in("nomina_id", ids);
      for (const r of (rens ?? []) as Array<{ nomina_id: string }>) {
        countsMap.set(r.nomina_id, (countsMap.get(r.nomina_id) ?? 0) + 1);
      }
    }
    return nominas.map((n: any) => ({ ...n, trabajadores_count: countsMap.get(n.id) ?? 0 }));
  });


export const getOrCreateNomina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      semanaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, canEdit } = await getAccess(supabase, userId, data.obraId);
    const semana = calcularSemana(data.semanaInicio);

    let { data: nomina } = await supabase
      .from("obra_nominas").select("*")
      .eq("obra_id", data.obraId)
      .eq("semana_inicio", semana.inicio)
      .maybeSingle();

    if (!nomina) {
      if (!canEdit) throw new Error("Sin permisos para crear nóminas en esta obra");
      const { data: maxRow } = await supabase
        .from("obra_nominas").select("numero")
        .eq("obra_id", data.obraId)
        .order("numero", { ascending: false }).limit(1).maybeSingle();
      const numero = (maxRow?.numero ?? 0) + 1;
      const { data: created, error } = await supabase
        .from("obra_nominas").insert({
          obra_id: data.obraId,
          company_id: companyId,
          numero,
          semana_inicio: semana.inicio,
          semana_fin: semana.fin,
          creado_por: userId,
        }).select("*").single();
      if (error) throw new Error(error.message);
      nomina = created;
    }

    const { data: renglones } = await supabase
      .from("obra_nomina_renglones")
      .select("*")
      .eq("nomina_id", nomina.id)
      .order("created_at", { ascending: true });

    const renglonesArr = renglones ?? [];
    const trabIds = renglonesArr.map((r: any) => r.trabajador_id);
    let trabajadores: any[] = [];
    if (trabIds.length > 0) {
      const { data: trabs } = await supabase
        .from("trabajadores")
        .select("id, nombre_completo, puesto, sueldo_diario, estatus_autorizacion, fecha_baja")
        .in("id", trabIds);
      trabajadores = trabs ?? [];
    }
    const trabMap = new Map(trabajadores.map((t: any) => [t.id, t]));
    const renglonesConTrab = renglonesArr.map((r: any) => ({
      ...r,
      trabajador: trabMap.get(r.trabajador_id) ?? null,
    }));

    const renglonIds = renglonesArr.map((r: any) => r.id);
    let asistencias: any[] = [];
    if (renglonIds.length > 0) {
      const { data } = await supabase
        .from("obra_nomina_asistencias")
        .select("*")
        .in("renglon_id", renglonIds);
      asistencias = data ?? [];
    }

    return { nomina, renglones: renglonesConTrab, asistencias };

  });

export const listTrabajadoresDisponibles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      obraId: z.string().uuid(),
      semanaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getAccess(supabase, userId, data.obraId);
    const { data: rows, error } = await supabase
      .from("trabajadores")
      .select("id, nombre_completo, puesto, sueldo_diario, fecha_baja, estatus_autorizacion")
      .eq("company_id", companyId)
      .order("nombre_completo", { ascending: true });
    
    if (error) throw new Error(error.message);
    // filtrar dados de baja antes del lunes
    return (rows ?? []).filter(
      (t: any) => !t.fecha_baja || t.fecha_baja >= data.semanaInicio,
    );
  });

export const asignarTrabajadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      nominaId: z.string().uuid(),
      trabajadorIds: z.array(z.string().uuid()).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: nomina } = await supabase
      .from("obra_nominas").select("*").eq("id", data.nominaId).single();
    if (!nomina) throw new Error("Nómina no encontrada");
    if (nomina.estatus !== "borrador") throw new Error("La nómina ya está cerrada");
    const { canEdit } = await getAccess(supabase, userId, nomina.obra_id);
    if (!canEdit) throw new Error("Sin permisos");

    const { data: existing } = await supabase
      .from("obra_nomina_renglones")
      .select("id, trabajador_id")
      .eq("nomina_id", data.nominaId);
    const existingIds = new Set((existing ?? []).map((r: any) => r.trabajador_id));
    const incomingIds = new Set(data.trabajadorIds);

    // Eliminar los que ya no están (solo si no tienen asistencias)
    const toRemove = (existing ?? []).filter((r: any) => !incomingIds.has(r.trabajador_id));
    if (toRemove.length > 0) {
      const ids = toRemove.map((r: any) => r.id);
      const { data: withAsist } = await supabase
        .from("obra_nomina_asistencias")
        .select("renglon_id")
        .in("renglon_id", ids);
      const blocked = new Set((withAsist ?? []).map((a: any) => a.renglon_id));
      const safeToDelete = ids.filter((id: string) => !blocked.has(id));
      if (safeToDelete.length > 0) {
        await supabase
          .from("obra_nomina_renglones").delete()
          .in("id", safeToDelete);
      }
    }

    // Insertar nuevos con snapshot de sueldo
    const toAdd = data.trabajadorIds.filter((id) => !existingIds.has(id));
    if (toAdd.length > 0) {
      const { data: trabs } = await supabase
        .from("trabajadores")
        .select("id, sueldo_diario")
        .in("id", toAdd);
      const sueldoMap = new Map((trabs ?? []).map((t: any) => [t.id, Number(t.sueldo_diario ?? 0)]));
      const rows = toAdd.map((trabajador_id) => ({
        nomina_id: data.nominaId,
        trabajador_id,
        sueldo_diario_snapshot: sueldoMap.get(trabajador_id) ?? 0,
      }));
      const { error } = await supabase.from("obra_nomina_renglones").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const guardarAsistencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      renglonId: z.string().uuid(),
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      jornada: z.number().refine((v) => v === 0 || v === 0.5 || v === 1),
      horasExtras: z.number().min(0).max(24),
      notaExtras: z.string().trim().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: renglon } = await supabase
      .from("obra_nomina_renglones")
      .select("*, nomina:nomina_id (id, obra_id, estatus)")
      .eq("id", data.renglonId)
      .single();
    if (!renglon) throw new Error("Renglón no encontrado");
    const nomina = renglon.nomina;
    if (nomina.estatus !== "borrador") throw new Error("La nómina está cerrada");
    const { canEdit } = await getAccess(supabase, userId, nomina.obra_id);
    if (!canEdit) throw new Error("Sin permisos");

    // validar fecha dentro de la semana
    const { data: nominaFull } = await supabase
      .from("obra_nominas").select("semana_inicio, semana_fin").eq("id", nomina.id).single();
    if (!nominaFull) throw new Error("Nómina no encontrada");
    if (data.fecha < nominaFull.semana_inicio || data.fecha > nominaFull.semana_fin)
      throw new Error("Fecha fuera de la semana de la nómina");

    // Nota obligatoria cuando hay horas extras
    const notaLimpia = (data.notaExtras ?? "").trim();
    if (data.horasExtras > 0 && notaLimpia.length < 3) {
      throw new Error("Las horas extras requieren una nota que explique el motivo (mínimo 3 caracteres).");
    }

    if (data.jornada === 0 && data.horasExtras === 0) {
      await supabase.from("obra_nomina_asistencias")
        .delete()
        .eq("renglon_id", data.renglonId)
        .eq("fecha", data.fecha);
    } else {
      const { error } = await supabase.from("obra_nomina_asistencias").upsert(
        {
          renglon_id: data.renglonId,
          fecha: data.fecha,
          jornada: data.jornada,
          horas_extras: data.horasExtras,
          nota_extras: data.horasExtras > 0 ? notaLimpia : null,
        },
        { onConflict: "renglon_id,fecha" },
      );
      if (error) throw new Error(error.message);
    }

    // Recalcular totales del renglón
    const { data: asistencias } = await supabase
      .from("obra_nomina_asistencias")
      .select("jornada, horas_extras")
      .eq("renglon_id", data.renglonId);
    const totals = recalcRenglon(
      asistencias ?? [],
      Number(renglon.sueldo_diario_snapshot),
    );
    await supabase.from("obra_nomina_renglones").update(totals).eq("id", data.renglonId);

    // Recalcular monto_total de la nómina
    const { data: allRenglones } = await supabase
      .from("obra_nomina_renglones")
      .select("importe_total")
      .eq("nomina_id", nomina.id);
    const monto = (allRenglones ?? []).reduce((s: number, r: any) => s + Number(r.importe_total ?? 0), 0);
    await supabase.from("obra_nominas").update({ monto_total: monto }).eq("id", nomina.id);

    return { ok: true, importeRenglon: totals.importe_total, montoNomina: monto };
  });

export const cerrarNomina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: nomina } = await supabase
      .from("obra_nominas").select("*").eq("id", data.id).single();
    if (!nomina) throw new Error("Nómina no encontrada");
    if (nomina.estatus !== "borrador") throw new Error("La nómina ya está cerrada");
    const { canEdit } = await getAccess(supabase, userId, nomina.obra_id);
    if (!canEdit) throw new Error("Sin permisos");
    const { error } = await supabase.from("obra_nominas").update({
      estatus: "cerrada",
      cerrada_por: userId,
      cerrada_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarNomina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: nomina } = await supabase
      .from("obra_nominas").select("obra_id, estatus").eq("id", data.id).single();
    if (!nomina) throw new Error("Nómina no encontrada");
    if (nomina.estatus !== "borrador") throw new Error("No se puede eliminar cerrada");
    const { canEdit } = await getAccess(supabase, userId, nomina.obra_id);
    if (!canEdit) throw new Error("Sin permisos");
    const { error } = await supabase.from("obra_nominas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPanelGlobalNomina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      semanaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("company_id").eq("id", userId).maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) throw new Error("Sin empresa");
    const { data: rolesRows } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("company_id", companyId);
    const roleSet = new Set((rolesRows ?? []).map((r: any) => r.role));
    const puedeAjustar = roleSet.has("director") || roleSet.has("administrativo");
    const semana = calcularSemana(data.semanaInicio);

    // Todas las nóminas de la company esa semana
    const { data: nominas } = await supabase
      .from("obra_nominas")
      .select("id, obra_id, estatus, monto_total")
      .eq("company_id", companyId)
      .eq("semana_inicio", semana.inicio);

    const nominasArr = nominas ?? [];
    const nominaIds = nominasArr.map((n: any) => n.id);
    const obraIds = Array.from(new Set(nominasArr.map((n: any) => n.obra_id)));

    let obrasMap = new Map<string, string>();
    if (obraIds.length > 0) {
      const { data: obrasRows } = await supabase
        .from("obras").select("id, nombre").in("id", obraIds);
      obrasMap = new Map((obrasRows ?? []).map((o: any) => [o.id, o.nombre]));
    }
    const obraNamePorNomina = new Map<string, { id: string; nombre: string; estatus: string }>();
    for (const n of nominasArr) {
      obraNamePorNomina.set(n.id, {
        id: n.obra_id,
        nombre: obrasMap.get(n.obra_id) ?? "—",
        estatus: String(n.estatus),
      });
    }

    if (nominaIds.length === 0) {
      return { semana, trabajadores: [], obrasConNomina: 0, puedeAjustar };
    }

    const { data: renglones } = await supabase
      .from("obra_nomina_renglones")
      .select("id, nomina_id, trabajador_id, sueldo_diario_snapshot, dias_trabajados, horas_extras_total, importe_total")
      .in("nomina_id", nominaIds);

    const renglonesArr = renglones ?? [];
    const renglonIds = renglonesArr.map((r: any) => r.id);
    const trabIds = Array.from(new Set(renglonesArr.map((r: any) => r.trabajador_id)));

    let trabsMap = new Map<string, any>();
    if (trabIds.length > 0) {
      const { data: trabsRows } = await supabase
        .from("trabajadores")
        .select("id, nombre_completo, puesto")
        .in("id", trabIds);
      trabsMap = new Map((trabsRows ?? []).map((t: any) => [t.id, t]));
    }

    // Asistencias
    let asistencias: any[] = [];
    if (renglonIds.length > 0) {
      const { data } = await supabase
        .from("obra_nomina_asistencias")
        .select("renglon_id, fecha, jornada, horas_extras, nota_extras, jornada_original, horas_extras_original, ajustado_por, ajustado_at, ajuste_motivo")
        .in("renglon_id", renglonIds);
      asistencias = data ?? [];
    }
    const asistenciasPorRenglon = new Map<string, any[]>();
    for (const a of asistencias) {
      if (!asistenciasPorRenglon.has(a.renglon_id)) asistenciasPorRenglon.set(a.renglon_id, []);
      asistenciasPorRenglon.get(a.renglon_id)!.push(a);
    }


    // Agrupar por trabajador
    type ObraDetalle = {
      obra_id: string;
      nombre: string;
      nomina_id: string;
      renglon_id: string;
      estatus: string;
      dias: number;
      horas_extras: number;
      importe: number;
      asistencias: {
        fecha: string;
        jornada: number;
        horas_extras: number;
        nota_extras: string | null;
        jornada_original: number | null;
        horas_extras_original: number | null;
        ajustado_at: string | null;
        ajuste_motivo: string | null;
      }[];
    };
    type Resumen = {
      trabajador_id: string;
      nombre: string;
      puesto: string | null;
      sueldo_diario: number;
      dias_totales: number;
      horas_extras_totales: number;
      importe_total: number;
      obras: ObraDetalle[];
      duplicados: { fecha: string; suma: number }[];
    };
    const porTrabajador = new Map<string, Resumen>();

    for (const r of renglonesArr as any[]) {
      const trab = trabsMap.get(r.trabajador_id);
      if (!trab) continue;

      if (!porTrabajador.has(trab.id)) {
        porTrabajador.set(trab.id, {
          trabajador_id: trab.id,
          nombre: trab.nombre_completo,
          puesto: trab.puesto ?? null,
          sueldo_diario: Number(r.sueldo_diario_snapshot),
          dias_totales: 0,
          horas_extras_totales: 0,
          importe_total: 0,
          obras: [],
          duplicados: [],
        });
      }
      const resumen = porTrabajador.get(trab.id)!;
      const obraInfo = obraNamePorNomina.get(r.nomina_id)!;
      const asist = asistenciasPorRenglon.get(r.id) ?? [];
      resumen.dias_totales += Number(r.dias_trabajados ?? 0);
      resumen.horas_extras_totales += Number(r.horas_extras_total ?? 0);
      resumen.importe_total += Number(r.importe_total ?? 0);
      resumen.obras.push({
        obra_id: obraInfo.id,
        nombre: obraInfo.nombre,
        nomina_id: r.nomina_id,
        renglon_id: r.id,
        estatus: obraInfo.estatus,
        dias: Number(r.dias_trabajados ?? 0),
        horas_extras: Number(r.horas_extras_total ?? 0),
        importe: Number(r.importe_total ?? 0),
        asistencias: asist.map((a) => ({
          fecha: String(a.fecha),
          jornada: Number(a.jornada),
          horas_extras: Number(a.horas_extras ?? 0),
          nota_extras: (a.nota_extras ?? null) as string | null,
          jornada_original: a.jornada_original == null ? null : Number(a.jornada_original),
          horas_extras_original:
            a.horas_extras_original == null ? null : Number(a.horas_extras_original),
          ajustado_at: (a.ajustado_at ?? null) as string | null,
          ajuste_motivo: (a.ajuste_motivo ?? null) as string | null,
        })),
      });
    }

    // Calcular duplicados (por fecha suma > 1.0)
    for (const resumen of porTrabajador.values()) {
      const porFecha = new Map<string, number>();
      for (const o of resumen.obras) {
        for (const a of o.asistencias) {
          porFecha.set(a.fecha, (porFecha.get(a.fecha) ?? 0) + a.jornada);
        }
      }
      for (const [fecha, suma] of porFecha) {
        if (suma > 1.0001) resumen.duplicados.push({ fecha, suma });
      }
      resumen.duplicados.sort((a, b) => a.fecha.localeCompare(b.fecha));
    }

    const trabajadores = Array.from(porTrabajador.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );

    return { semana, trabajadores, obrasConNomina: nominasArr.length, puedeAjustar };
  });

// ============================================================
// PAGO DE NÓMINA SEMANAL (Cuentas por pagar)
// ============================================================

async function assertAdmin(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const companyId = profile.company_id as string;
  const { data: roles } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("company_id", companyId)
    .in("role", ["director", "administrativo"]);
  if (!roles || roles.length === 0) throw new Error("Solo director o administrativo puede pagar nómina");
  return companyId;
}

export const listSemanasNominaPorPagar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await assertAdmin(supabase, userId);

    const { data: nominas, error } = await supabase
      .from("obra_nominas")
      .select("id, obra_id, semana_inicio, semana_fin, monto_total, estatus")
      .eq("company_id", companyId)
      .eq("estatus", "cerrada")
      .order("semana_inicio", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (nominas ?? []) as any[];
    if (rows.length === 0) return [] as Array<any>;

    const obraIds = Array.from(new Set(rows.map((r) => r.obra_id)));
    const { data: obras } = await supabase
      .from("obras").select("id, nombre").in("id", obraIds);
    const obraMap = new Map((obras ?? []).map((o: any) => [o.id, o.nombre]));

    // Agrupa por semana_inicio
    const bySemana = new Map<string, any>();
    for (const n of rows) {
      const key = n.semana_inicio;
      const g = bySemana.get(key) ?? {
        semana_inicio: n.semana_inicio,
        semana_fin: n.semana_fin,
        total: 0,
        obras: [] as any[],
        nomina_ids: [] as string[],
      };
      g.total += Number(n.monto_total ?? 0);
      g.obras.push({
        nomina_id: n.id,
        obra_id: n.obra_id,
        obra_nombre: obraMap.get(n.obra_id) ?? "—",
        monto: Number(n.monto_total ?? 0),
      });
      g.nomina_ids.push(n.id);
      bySemana.set(key, g);
    }

    return Array.from(bySemana.values()).sort((a, b) =>
      a.semana_inicio < b.semana_inicio ? 1 : -1,
    );
  });

export const listTrabajadoresPagoSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ semanaInicio: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await assertAdmin(supabase, userId);

    const { data: nominas } = await supabase
      .from("obra_nominas")
      .select("id")
      .eq("company_id", companyId)
      .eq("estatus", "cerrada")
      .eq("semana_inicio", data.semanaInicio);
    const ids = (nominas ?? []).map((n: any) => n.id);
    if (ids.length === 0) return [] as Array<any>;

    const { data: rens } = await supabase
      .from("obra_nomina_renglones")
      .select("trabajador_id, importe_total")
      .in("nomina_id", ids);

    const trabIds = Array.from(new Set((rens ?? []).map((r: any) => r.trabajador_id)));
    const { data: trabs } = await supabase
      .from("trabajadores")
      .select("id, nombre_completo, apellido_paterno, apellido_materno")
      .in("id", trabIds);
    const trabMap = new Map((trabs ?? []).map((t: any) => {
      const nombre = [t.nombre_completo, t.apellido_paterno, t.apellido_materno]
        .filter(Boolean).join(" ").trim() || "Trabajador";
      return [t.id, nombre];
    }));

    const agg = new Map<string, number>();
    for (const r of (rens ?? []) as any[]) {
      agg.set(r.trabajador_id, (agg.get(r.trabajador_id) ?? 0) + Number(r.importe_total ?? 0));
    }
    return Array.from(agg.entries()).map(([id, importe]) => ({
      trabajador_id: id,
      nombre: trabMap.get(id) ?? "Trabajador",
      importe,
    })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

const pagarNominaSchema = z.object({
  semanaInicio: z.string(),
  fechaPago: z.string(),
  notas: z.string().optional().nullable(),
  cuentaCajaFuerteId: z.string().uuid(),
  cheques: z.array(z.object({
    cuentaId: z.string().uuid(),
    folio: z.string().min(1),
    trabajadorId: z.string().uuid().nullable(),
    trabajadorNombre: z.string().min(1),
    monto: z.number().positive(),
  })).default([]),
});

export const pagarNominaSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pagarNominaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Lee nominas de la semana
    const { data: nominas } = await supabaseAdmin
      .from("obra_nominas")
      .select("id, obra_id, semana_inicio, semana_fin, monto_total, estatus")
      .eq("company_id", companyId)
      .eq("semana_inicio", data.semanaInicio);
    const arr = (nominas ?? []) as any[];
    if (arr.length === 0) throw new Error("No hay nóminas para esa semana");
    if (arr.some((n) => n.estatus !== "cerrada")) throw new Error("Solo nóminas cerradas se pueden pagar");

    const totalNomina = +arr.reduce((s, n) => s + Number(n.monto_total ?? 0), 0).toFixed(2);
    const totalCheques = +data.cheques.reduce((s, c) => s + c.monto, 0).toFixed(2);
    if (totalCheques > totalNomina + 0.01) {
      throw new Error(`Los cheques (${totalCheques}) exceden la nómina (${totalNomina})`);
    }
    const remanente = +(totalNomina - totalCheques).toFixed(2);

    // Verifica caja fuerte
    const { data: cajaFuerte } = await supabaseAdmin
      .from("cuentas")
      .select("id, company_id, tipo, activa, saldo_actual, nombre")
      .eq("id", data.cuentaCajaFuerteId).maybeSingle();
    if (!cajaFuerte || cajaFuerte.company_id !== companyId) throw new Error("Caja fuerte no encontrada");
    if (cajaFuerte.tipo !== "caja_fuerte") throw new Error("La cuenta de vales debe ser caja fuerte");
    if (!cajaFuerte.activa) throw new Error("La caja fuerte está inactiva");

    // Lee cuentas de cheques
    const cuentasIds = Array.from(new Set(data.cheques.map((c) => c.cuentaId)));
    const { data: cuentas } = await supabaseAdmin
      .from("cuentas")
      .select("id, company_id, tipo, activa, saldo_actual, nombre")
      .in("id", cuentasIds);
    const cuentaMap = new Map((cuentas ?? []).map((c: any) => [c.id, c]));
    for (const c of data.cheques) {
      const cta = cuentaMap.get(c.cuentaId) as any;
      if (!cta || cta.company_id !== companyId) throw new Error("Cuenta de cheque no encontrada");
      if (cta.tipo !== "bancaria") throw new Error("Los cheques deben salir de cuentas bancarias");
      if (!cta.activa) throw new Error(`Cuenta ${cta.nombre} inactiva`);
    }

    // Prorratea remanente por obra (según monto de nómina)
    const obraIds = arr.map((n) => n.obra_id);
    const { data: obras } = await supabaseAdmin
      .from("obras").select("id, nombre").in("id", obraIds);
    const obraNombreMap = new Map((obras ?? []).map((o: any) => [o.id, o.nombre]));

    const vales: Array<{ obra_id: string; obra_nombre: string; monto: number; nomina_id: string }> = [];
    if (remanente > 0.005 && totalNomina > 0) {
      let acumulado = 0;
      for (let i = 0; i < arr.length; i++) {
        const n = arr[i];
        const share = Number(n.monto_total ?? 0) / totalNomina;
        const raw = remanente * share;
        const monto = i === arr.length - 1
          ? +(remanente - acumulado).toFixed(2)
          : +raw.toFixed(2);
        acumulado = +(acumulado + monto).toFixed(2);
        if (monto > 0) {
          vales.push({
            obra_id: n.obra_id,
            obra_nombre: obraNombreMap.get(n.obra_id) ?? "—",
            monto,
            nomina_id: n.id,
          });
        }
      }
    }
    const totalVales = +vales.reduce((s, v) => s + v.monto, 0).toFixed(2);

    // Insert pago_semana header
    const { data: header, error: hErr } = await supabaseAdmin
      .from("nomina_pagos_semana")
      .insert({
        company_id: companyId,
        semana_inicio: arr[0].semana_inicio,
        semana_fin: arr[0].semana_fin,
        fecha_pago: data.fechaPago,
        total_nomina: totalNomina,
        total_cheques: totalCheques,
        total_vales: totalVales,
        notas: data.notas || null,
        creado_por: userId,
      })
      .select("id")
      .single();
    if (hErr) throw new Error(hErr.message);
    const pagoSemanaId = header.id as string;

    const asientoId = crypto.randomUUID();
    const asientos: any[] = [];
    const concepto = `Pago nómina semana ${arr[0].semana_inicio} → ${arr[0].semana_fin}`;

    // Cargo total: Nómina por pagar
    asientos.push({
      company_id: companyId, asiento_id: asientoId, fecha: data.fechaPago,
      concepto, referencia: `NOM-${arr[0].semana_inicio}`,
      origen_tipo: "pago_nomina_semana", origen_id: pagoSemanaId,
      tipo_movimiento: "cargo", cuenta_contable: "Nómina por pagar",
      monto: totalNomina, creado_por: userId,
    });

    // Procesa cheques: pago + movimiento + saldo + abono contable
    for (const c of data.cheques) {
      const cta = cuentaMap.get(c.cuentaId) as any;
      const { data: pago } = await supabaseAdmin.from("pagos").insert({
        company_id: companyId,
        cuenta_id: c.cuentaId,
        fecha: data.fechaPago,
        monto: c.monto,
        metodo: "cheque",
        referencia: c.folio,
        concepto: `Cheque nómina · ${c.trabajadorNombre}`,
        notas: null,
        origen_tipo: "nomina_pago_semana",
        origen_id: pagoSemanaId,
        creado_por: userId,
      }).select("id").single();

      const { data: mov } = await supabaseAdmin.from("cuenta_movimientos").insert({
        cuenta_id: c.cuentaId, company_id: companyId,
        fecha: data.fechaPago, tipo: "egreso", monto: c.monto,
        concepto: `Cheque nómina ${c.folio} · ${c.trabajadorNombre}`,
        referencia: c.folio,
        origen: "pago", origen_id: pago!.id, creado_por: userId,
      }).select("id").single();

      await supabaseAdmin.from("pagos").update({ cuenta_movimiento_id: mov!.id }).eq("id", pago!.id);

      const nuevoSaldo = +(Number(cta.saldo_actual) - c.monto).toFixed(2);
      await supabaseAdmin.from("cuentas").update({ saldo_actual: nuevoSaldo }).eq("id", c.cuentaId);
      cta.saldo_actual = nuevoSaldo;

      await supabaseAdmin.from("nomina_pagos_cheque").insert({
        pago_semana_id: pagoSemanaId, company_id: companyId,
        cuenta_id: c.cuentaId, folio_cheque: c.folio,
        trabajador_id: c.trabajadorId, trabajador_nombre: c.trabajadorNombre,
        monto: c.monto, pago_id: pago!.id,
      });

      asientos.push({
        company_id: companyId, asiento_id: asientoId, fecha: data.fechaPago,
        concepto: `Cheque nómina ${c.folio}`, referencia: c.folio,
        origen_tipo: "pago_nomina_semana", origen_id: pagoSemanaId,
        tipo_movimiento: "abono", cuenta_contable: "Bancos",
        monto: c.monto, creado_por: userId,
      });
    }

    // Procesa vales por obra desde caja fuerte
    if (vales.length > 0) {
      let cfSaldo = Number(cajaFuerte.saldo_actual);
      for (const v of vales) {
        const { data: pago } = await supabaseAdmin.from("pagos").insert({
          company_id: companyId,
          cuenta_id: cajaFuerte.id,
          fecha: data.fechaPago,
          monto: v.monto,
          metodo: "efectivo",
          referencia: null,
          concepto: `Vale nómina · ${v.obra_nombre}`,
          notas: null,
          origen_tipo: "nomina_pago_semana",
          origen_id: pagoSemanaId,
          creado_por: userId,
        }).select("id").single();

        const { data: mov } = await supabaseAdmin.from("cuenta_movimientos").insert({
          cuenta_id: cajaFuerte.id, company_id: companyId,
          fecha: data.fechaPago, tipo: "egreso", monto: v.monto,
          concepto: `Vale nómina · ${v.obra_nombre}`,
          origen: "pago", origen_id: pago!.id, creado_por: userId,
        }).select("id").single();

        await supabaseAdmin.from("pagos").update({ cuenta_movimiento_id: mov!.id }).eq("id", pago!.id);

        cfSaldo = +(cfSaldo - v.monto).toFixed(2);

        await supabaseAdmin.from("nomina_pagos_vale").insert({
          pago_semana_id: pagoSemanaId, company_id: companyId,
          obra_id: v.obra_id, obra_nombre: v.obra_nombre,
          cuenta_id: cajaFuerte.id, monto: v.monto,
          pago_id: pago!.id, nomina_id: v.nomina_id,
        });

        asientos.push({
          company_id: companyId, asiento_id: asientoId, fecha: data.fechaPago,
          concepto: `Vale nómina · ${v.obra_nombre}`, referencia: null,
          origen_tipo: "pago_nomina_semana", origen_id: pagoSemanaId,
          tipo_movimiento: "abono", cuenta_contable: "Caja fuerte",
          monto: v.monto, creado_por: userId,
        });
      }
      await supabaseAdmin.from("cuentas").update({ saldo_actual: cfSaldo }).eq("id", cajaFuerte.id);
    }

    // Inserta asientos contables
    await supabaseAdmin.from("asientos_contables").insert(asientos);

    // Marca nóminas como pagadas
    await supabaseAdmin
      .from("obra_nominas")
      .update({ estatus: "pagada" })
      .in("id", arr.map((n) => n.id));

    return { id: pagoSemanaId, totalNomina, totalCheques, totalVales };
  });
