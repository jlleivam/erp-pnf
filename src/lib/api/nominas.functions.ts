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
    const obraNamePorNomina = new Map<string, { id: string; nombre: string }>();
    for (const n of nominasArr) {
      obraNamePorNomina.set(n.id, { id: n.obra_id, nombre: obrasMap.get(n.obra_id) ?? "—" });
    }

    if (nominaIds.length === 0) {
      return { semana, trabajadores: [], obrasConNomina: 0 };
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
        .select("renglon_id, fecha, jornada, horas_extras, nota_extras")
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
      dias: number;
      horas_extras: number;
      importe: number;
      asistencias: { fecha: string; jornada: number; horas_extras: number; nota_extras: string | null }[];
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
        dias: Number(r.dias_trabajados ?? 0),
        horas_extras: Number(r.horas_extras_total ?? 0),
        importe: Number(r.importe_total ?? 0),
        asistencias: asist.map((a) => ({
          fecha: a.fecha,
          jornada: Number(a.jornada),
          horas_extras: Number(a.horas_extras ?? 0),
          nota_extras: (a.nota_extras ?? null) as string | null,
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

    return { semana, trabajadores, obrasConNomina: nominasArr.length };
  });
