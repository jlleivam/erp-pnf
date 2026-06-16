import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularSemana, toISODate } from "@/lib/estimacion-utils";
import { montoGastoObra } from "@/lib/api/caja-chica.functions";

// ============================================================
// Tipos
// ============================================================

export type CostoCategoria =
  | "almacen"
  | "nomina"
  | "destajos"
  | "subcontratos"
  | "rentas"
  | "gasolinas"
  | "cajaChica";

export type ConceptoDetalle = {
  id: string;
  descripcion: string;
  cantidad?: number | null;
  unidad?: string | null;
  precio_unitario?: number | null;
  monto: number;
  meta?: string | null;
};

export type DocumentoCosto = {
  id: string;
  titulo: string;
  monto: number;
  estatus?: string | null;
  link?: string | null;
  meta?: string | null;
  conceptos?: ConceptoDetalle[];
};

export type SemanaResultado = {
  semana_inicio: string;
  semana_fin: string;
  produccion: number;
  costos: Record<CostoCategoria, number>;
  costos_total: number;
  resultado: number;
  margen: number; // resultado / produccion (0 si produccion = 0)
};

export type SemanaDetalle = SemanaResultado & {
  detalle: Record<CostoCategoria, DocumentoCosto[]>;
  produccion_detalle: DocumentoCosto[];
};

// ============================================================
// Helpers
// ============================================================

function emptyCostos(): Record<CostoCategoria, number> {
  return {
    almacen: 0,
    nomina: 0,
    destajos: 0,
    subcontratos: 0,
    rentas: 0,
    gasolinas: 0,
    cajaChica: 0,
  };
}

function emptyDetalle(): Record<CostoCategoria, DocumentoCosto[]> {
  return {
    almacen: [],
    nomina: [],
    destajos: [],
    subcontratos: [],
    rentas: [],
    gasolinas: [],
    cajaChica: [],
  };
}

function totalCostos(c: Record<CostoCategoria, number>): number {
  return (
    c.almacen + c.nomina + c.destajos + c.subcontratos + c.rentas + c.gasolinas + c.cajaChica
  );
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

// Tarifa diaria según periodicidad de renta
function tarifaDiaria(tarifa: number, periodicidad: string | null): number {
  switch (periodicidad) {
    case "diaria":
      return tarifa;
    case "semanal":
      return tarifa / 7;
    case "quincenal":
      return tarifa / 15;
    case "mensual":
    default:
      return tarifa / 30;
  }
}

// Días de overlap entre [aStart, aEnd] y [bStart, bEnd] (inclusivos), ambos YYYY-MM-DD
function diasOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const s = aStart > bStart ? aStart : bStart;
  const e = aEnd < bEnd ? aEnd : bEnd;
  if (s > e) return 0;
  const sd = new Date(s + "T12:00:00").getTime();
  const ed = new Date(e + "T12:00:00").getTime();
  return Math.round((ed - sd) / 86_400_000) + 1;
}

// Lista de N semanas hacia atrás (incluye la actual), de más vieja a más nueva
function ultimasSemanas(n: number, hasta?: string): { inicio: string; fin: string }[] {
  const base = hasta ? new Date(hasta + "T12:00:00") : new Date();
  const result: { inicio: string; fin: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i * 7);
    result.push(calcularSemana(d));
  }
  return result;
}

// ============================================================
// Cálculo por rango (devuelve buckets por semana)
// ============================================================

type Bucket = {
  inicio: string;
  fin: string;
  produccion: number;
  costos: Record<CostoCategoria, number>;
  detalle: Record<CostoCategoria, DocumentoCosto[]>;
  produccion_detalle: DocumentoCosto[];
};

function bucketFor(
  buckets: Map<string, Bucket>,
  fechaISO: string,
): Bucket | null {
  for (const b of buckets.values()) {
    if (fechaISO >= b.inicio && fechaISO <= b.fin) return b;
  }
  return null;
}

async function calcularBuckets(
  supabase: any,
  obraId: string,
  semanas: { inicio: string; fin: string }[],
  withDetail: boolean = false,
): Promise<Bucket[]> {
  const buckets = new Map<string, Bucket>();
  for (const s of semanas) {
    buckets.set(s.inicio, {
      inicio: s.inicio,
      fin: s.fin,
      produccion: 0,
      costos: emptyCostos(),
      detalle: emptyDetalle(),
      produccion_detalle: [],
    });
  }
  const rangoInicio = semanas[0].inicio;
  const rangoFin = semanas[semanas.length - 1].fin;
  const semanasInicios = semanas.map((s) => s.inicio);

  const [
    estimacionesRes,
    almacenRes,
    nominasRes,
    destajosRes,
    subcontratosRes,
    rentasRes,
    gasolinasRes,
    cajaRes,
  ] = await Promise.all([
    supabase
      .from("obra_estimaciones")
      .select("id, numero, semana_inicio, semana_fin, monto_total, estatus")
      .eq("obra_id", obraId)
      .in("semana_inicio", semanasInicios),
    supabase
      .from("almacen_semanas")
      .select("id, semana_inicio, semana_fin, estatus")
      .eq("obra_id", obraId)
      .in("semana_inicio", semanasInicios),
    supabase
      .from("obra_nominas")
      .select("id, numero, semana_inicio, semana_fin, monto_total, estatus")
      .eq("obra_id", obraId)
      .in("semana_inicio", semanasInicios),
    supabase
      .from("obra_destajo_estimaciones")
      .select(
        "id, numero, semana_inicio, semana_fin, monto_total, estatus, obra_destajos!inner(obra_id, nombre)",
      )
      .eq("obra_destajos.obra_id", obraId)
      .in("semana_inicio", semanasInicios),
    supabase
      .from("obra_subcontrato_estimaciones")
      .select(
        "id, numero, semana_inicio, semana_fin, monto_total, estatus, obra_subcontratos!inner(obra_id, nombre)",
      )
      .eq("obra_subcontratos.obra_id", obraId)
      .in("semana_inicio", semanasInicios),
    supabase
      .from("obra_rentas")
      .select(
        "id, numero, equipo, cantidad, tarifa_unitaria, periodicidad, fecha_estimada_inicio, fecha_llegada_real, fecha_fin_programada, fecha_devolucion_real, estatus",
      )
      .eq("obra_id", obraId)
      .not("estatus", "in", "(borrador,rechazada)"),
    supabase
      .from("vales_gasolina")
      .select(
        "id, folio, descripcion, tipo_combustible, monto_solicitado, monto_autorizado, autorizado_at, solicitado_at, estatus",
      )
      .eq("obra_id", obraId)
      .not("estatus", "in", "(rechazado,cancelado)")
      .gte("solicitado_at", rangoInicio + "T00:00:00")
      .lte("solicitado_at", rangoFin + "T23:59:59"),
    supabase
      .from("caja_chica_gastos")
      .select("id, concepto, descripcion, tipo_comprobante, fecha, monto, estatus")
      .eq("obra_id", obraId)
      .neq("estatus", "rechazado")
      .gte("fecha", rangoInicio)
      .lte("fecha", rangoFin),
  ]);

  // === Detalle (segunda ronda de fetch, sólo cuando se necesita) ===
  const estIds = (estimacionesRes.data ?? []).map((e: any) => e.id);
  const almacenIds = (almacenRes.data ?? []).map((s: any) => s.id);
  const nominaIds = (nominasRes.data ?? []).map((n: any) => n.id);
  const destajoEstIds = (destajosRes.data ?? []).map((d: any) => d.id);
  const subcEstIds = (subcontratosRes.data ?? []).map((s: any) => s.id);

  const detailPromises: Promise<any>[] = [];
  // Estimación renglones (siempre se necesitan para sumar producción)
  detailPromises.push(
    estIds.length > 0
      ? supabase
          .from("obra_estimacion_renglones")
          .select(
            "id, estimacion_id, renglon_clave, concepto, unidad, cantidad_ejecutada, pu_vigente, importe_ejecutado",
          )
          .in("estimacion_id", estIds)
      : Promise.resolve({ data: [] }),
  );
  if (withDetail) {
    detailPromises.push(
      almacenIds.length > 0
        ? supabase
            .from("almacen_movimientos_semana")
            .select("id, semana_id, utilizado, precio_unitario, insumos(nombre, unidad)")
            .in("semana_id", almacenIds)
            .gt("utilizado", 0)
        : Promise.resolve({ data: [] }),
      nominaIds.length > 0
        ? supabase
            .from("obra_nomina_renglones")
            .select(
              "id, nomina_id, dias_trabajados, horas_extras_total, sueldo_diario_snapshot, importe_total, trabajadores(nombre_completo, puesto)",
            )
            .in("nomina_id", nominaIds)
        : Promise.resolve({ data: [] }),
      destajoEstIds.length > 0
        ? supabase
            .from("obra_destajo_estimacion_renglones")
            .select(
              "id, estimacion_id, renglon_clave, concepto, unidad, cantidad_ejecutada, pu_vigente, importe_ejecutado",
            )
            .in("estimacion_id", destajoEstIds)
        : Promise.resolve({ data: [] }),
      subcEstIds.length > 0
        ? supabase
            .from("obra_subcontrato_estimacion_renglones")
            .select(
              "id, estimacion_id, renglon_clave, concepto, unidad, cantidad_ejecutada, pu_vigente, importe_ejecutado",
            )
            .in("estimacion_id", subcEstIds)
        : Promise.resolve({ data: [] }),
    );
  }

  const detailResults = await Promise.all(detailPromises);
  const estRenglonesRes = detailResults[0];
  const almacenMovsRes = withDetail ? detailResults[1] : { data: [] };
  const nominaRenglonesRes = withDetail ? detailResults[2] : { data: [] };
  const destajoRenglonesRes = withDetail ? detailResults[3] : { data: [] };
  const subcRenglonesRes = withDetail ? detailResults[4] : { data: [] };

  // Indexar renglones de estimación por estimacion_id
  const renglonesByEst = new Map<string, any[]>();
  for (const r of estRenglonesRes.data ?? []) {
    const arr = renglonesByEst.get(r.estimacion_id) ?? [];
    arr.push(r);
    renglonesByEst.set(r.estimacion_id, arr);
  }

  // Producción
  for (const e of estimacionesRes.data ?? []) {
    const b = buckets.get(e.semana_inicio);
    if (!b) continue;
    const rens = renglonesByEst.get(e.id) ?? [];
    const monto = rens.length > 0
      ? rens.reduce((acc, r) => acc + num(r.importe_ejecutado), 0)
      : num(e.monto_total);
    b.produccion += monto;
    b.produccion_detalle.push({
      id: e.id,
      titulo: `Estimación #${e.numero}`,
      monto,
      estatus: e.estatus,
      conceptos: withDetail
        ? rens
            .filter((r) => num(r.importe_ejecutado) > 0)
            .map((r) => ({
              id: r.id,
              descripcion: r.concepto,
              cantidad: num(r.cantidad_ejecutada),
              unidad: r.unidad,
              precio_unitario: num(r.pu_vigente),
              monto: num(r.importe_ejecutado),
              meta: r.renglon_clave,
            }))
        : undefined,
    });
  }

  // Almacén — indexar movimientos por semana_id
  const movsBySemana = new Map<string, any[]>();
  for (const m of almacenMovsRes.data ?? []) {
    const arr = movsBySemana.get(m.semana_id) ?? [];
    arr.push(m);
    movsBySemana.set(m.semana_id, arr);
  }
  for (const s of almacenRes.data ?? []) {
    const b = buckets.get(s.semana_inicio);
    if (!b) continue;
    let monto = 0;
    const conceptos: ConceptoDetalle[] = [];
    if (withDetail) {
      const movs = movsBySemana.get(s.id) ?? [];
      for (const m of movs) {
        const sub = num(m.utilizado) * num(m.precio_unitario);
        if (sub === 0) continue;
        monto += sub;
        conceptos.push({
          id: m.id,
          descripcion: m.insumos?.nombre ?? "Insumo",
          cantidad: num(m.utilizado),
          unidad: m.insumos?.unidad ?? null,
          precio_unitario: num(m.precio_unitario),
          monto: sub,
        });
      }
    } else {
      // Sin detalle: necesitamos el monto total → sub-fetch agregado
      const { data: agg } = await supabase
        .from("almacen_movimientos_semana")
        .select("utilizado, precio_unitario")
        .eq("semana_id", s.id);
      monto = (agg ?? []).reduce(
        (acc: number, m: any) => acc + num(m.utilizado) * num(m.precio_unitario),
        0,
      );
    }
    if (monto === 0) continue;
    b.costos.almacen += monto;
    b.detalle.almacen.push({
      id: s.id,
      titulo: `Consumo semana almacén`,
      monto,
      estatus: s.estatus,
      conceptos: withDetail ? conceptos : undefined,
    });
  }

  // Nómina — indexar renglones por nomina_id
  const renglonesByNomina = new Map<string, any[]>();
  for (const r of nominaRenglonesRes.data ?? []) {
    const arr = renglonesByNomina.get(r.nomina_id) ?? [];
    arr.push(r);
    renglonesByNomina.set(r.nomina_id, arr);
  }
  for (const n of nominasRes.data ?? []) {
    const b = buckets.get(n.semana_inicio);
    if (!b) continue;
    const monto = num(n.monto_total);
    b.costos.nomina += monto;
    const rens = renglonesByNomina.get(n.id) ?? [];
    b.detalle.nomina.push({
      id: n.id,
      titulo: `Nómina #${n.numero}`,
      monto,
      estatus: n.estatus,
      conceptos: withDetail
        ? rens.map((r) => ({
            id: r.id,
            descripcion: r.trabajadores?.nombre_completo ?? "Trabajador",
            cantidad: num(r.dias_trabajados),
            unidad: "días",
            precio_unitario: num(r.sueldo_diario_snapshot),
            monto: num(r.importe_total),
            meta:
              num(r.horas_extras_total) > 0
                ? `${r.trabajadores?.puesto ?? ""} · ${num(r.horas_extras_total)}h extra`
                : (r.trabajadores?.puesto ?? null),
          }))
        : undefined,
    });
  }

  // Destajos — indexar renglones por estimacion_id
  const renglonesByDestajo = new Map<string, any[]>();
  for (const r of destajoRenglonesRes.data ?? []) {
    const arr = renglonesByDestajo.get(r.estimacion_id) ?? [];
    arr.push(r);
    renglonesByDestajo.set(r.estimacion_id, arr);
  }
  for (const d of destajosRes.data ?? []) {
    const b = buckets.get(d.semana_inicio);
    if (!b) continue;
    const monto = num(d.monto_total);
    b.costos.destajos += monto;
    const rens = renglonesByDestajo.get(d.id) ?? [];
    b.detalle.destajos.push({
      id: d.id,
      titulo: `${d.obra_destajos?.nombre ?? "Destajo"} — estim. #${d.numero}`,
      monto,
      estatus: d.estatus,
      conceptos: withDetail
        ? rens
            .filter((r) => num(r.importe_ejecutado) > 0)
            .map((r) => ({
              id: r.id,
              descripcion: r.concepto,
              cantidad: num(r.cantidad_ejecutada),
              unidad: r.unidad,
              precio_unitario: num(r.pu_vigente),
              monto: num(r.importe_ejecutado),
              meta: r.renglon_clave,
            }))
        : undefined,
    });
  }

  // Subcontratos — indexar
  const renglonesBySubc = new Map<string, any[]>();
  for (const r of subcRenglonesRes.data ?? []) {
    const arr = renglonesBySubc.get(r.estimacion_id) ?? [];
    arr.push(r);
    renglonesBySubc.set(r.estimacion_id, arr);
  }
  for (const sc of subcontratosRes.data ?? []) {
    const b = buckets.get(sc.semana_inicio);
    if (!b) continue;
    const monto = num(sc.monto_total);
    b.costos.subcontratos += monto;
    const rens = renglonesBySubc.get(sc.id) ?? [];
    b.detalle.subcontratos.push({
      id: sc.id,
      titulo: `${sc.obra_subcontratos?.nombre ?? "Subcontrato"} — estim. #${sc.numero}`,
      monto,
      estatus: sc.estatus,
      conceptos: withDetail
        ? rens
            .filter((r) => num(r.importe_ejecutado) > 0)
            .map((r) => ({
              id: r.id,
              descripcion: r.concepto,
              cantidad: num(r.cantidad_ejecutada),
              unidad: r.unidad,
              precio_unitario: num(r.pu_vigente),
              monto: num(r.importe_ejecutado),
              meta: r.renglon_clave,
            }))
        : undefined,
    });
  }

  // Rentas (prorrateo)
  const hoyISO = toISODate(new Date());
  for (const r of rentasRes.data ?? []) {
    const inicio = r.fecha_llegada_real ?? r.fecha_estimada_inicio;
    if (!inicio) continue;
    const fin = r.fecha_devolucion_real ?? hoyISO;
    const tdUnit = tarifaDiaria(num(r.tarifa_unitaria), r.periodicidad);
    const cant = num(r.cantidad || 1);
    const td = tdUnit * cant;
    for (const b of buckets.values()) {
      const dias = diasOverlap(inicio, fin, b.inicio, b.fin);
      if (dias <= 0) continue;
      const monto = td * dias;
      b.costos.rentas += monto;
      b.detalle.rentas.push({
        id: `${r.id}-${b.inicio}`,
        titulo: `${r.equipo}`,
        monto,
        estatus: r.estatus,
        meta: `${dias}d × ${r.periodicidad ?? "mensual"}`,
        conceptos: withDetail
          ? [
              {
                id: `${r.id}-detail`,
                descripcion: `${r.equipo} (×${cant})`,
                cantidad: dias,
                unidad: "días",
                precio_unitario: td,
                monto,
                meta: `Tarifa ${r.periodicidad ?? "mensual"}: ${num(r.tarifa_unitaria).toFixed(2)} → diaria ${tdUnit.toFixed(2)}`,
              },
            ]
          : undefined,
      });
    }
  }

  // Gasolinas
  for (const v of gasolinasRes.data ?? []) {
    const fechaTS = v.autorizado_at ?? v.solicitado_at;
    if (!fechaTS) continue;
    const fechaISO = String(fechaTS).slice(0, 10);
    const b = bucketFor(buckets, fechaISO);
    if (!b) continue;
    const monto = num(v.monto_autorizado ?? v.monto_solicitado);
    b.costos.gasolinas += monto;
    b.detalle.gasolinas.push({
      id: v.id,
      titulo: `${v.folio} — ${v.tipo_combustible}`,
      monto,
      estatus: v.estatus,
      meta: v.descripcion ?? null,
    });
  }

  // Caja chica
  for (const g of cajaRes.data ?? []) {
    const b = bucketFor(buckets, g.fecha);
    if (!b) continue;
    const montoTotal = num(g.monto);
    const monto = montoGastoObra(montoTotal, g.tipo_comprobante);
    b.costos.cajaChica += monto;
    const metaParts = [g.fecha, g.tipo_comprobante, g.descripcion].filter(Boolean) as string[];
    if (monto !== montoTotal) {
      metaParts.push(`pagado $${montoTotal.toFixed(2)} · base $${monto.toFixed(2)}`);
    }
    b.detalle.cajaChica.push({
      id: g.id,
      titulo: g.concepto,
      monto,
      estatus: g.estatus,
      meta: metaParts.join(" · "),
    });
  }

  return Array.from(buckets.values()).sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function bucketToResultado(b: Bucket): SemanaResultado {
  const ct = totalCostos(b.costos);
  const resultado = b.produccion - ct;
  return {
    semana_inicio: b.inicio,
    semana_fin: b.fin,
    produccion: b.produccion,
    costos: b.costos,
    costos_total: ct,
    resultado,
    margen: b.produccion > 0 ? resultado / b.produccion : 0,
  };
}

// ============================================================
// Server Functions
// ============================================================

export const getEstadoResultadosSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obraId: z.string().uuid(), semanaInicio: z.string() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<SemanaDetalle> => {
    const { supabase } = context;
    const semana = calcularSemana(data.semanaInicio);
    const buckets = await calcularBuckets(supabase, data.obraId, [semana], true);
    const b = buckets[0];
    return {
      ...bucketToResultado(b),
      detalle: b.detalle,
      produccion_detalle: b.produccion_detalle,
    };
  });

export const getEstadoResultadosHistorico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        obraId: z.string().uuid(),
        semanas: z.number().int().min(1).max(52).default(8),
        hasta: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SemanaResultado[]> => {
    const { supabase } = context;
    const semanas = ultimasSemanas(data.semanas, data.hasta);
    const buckets = await calcularBuckets(supabase, data.obraId, semanas);
    return buckets.map(bucketToResultado);
  });

// ============================================================
// Boundaries (primer semana de la obra y semana actual)
// ============================================================

export const getObraSemanaBoundaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obraId: z.string().uuid() }).parse(d),
  )
  .handler(
    async ({ data, context }): Promise<{ fechaInicio: string; primerSemana: string; semanaActual: string }> => {
      const { supabase } = context;
      const { data: obra, error } = await supabase
        .from("obras")
        .select("fecha_inicio, created_at")
        .eq("id", data.obraId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!obra) throw new Error("Obra no encontrada");
      const base = obra.fecha_inicio
        ? new Date(obra.fecha_inicio + "T12:00:00")
        : new Date(obra.created_at);
      const fechaInicio = toISODate(base);
      const primerSemana = calcularSemana(base).inicio;
      const semanaActual = calcularSemana(new Date()).inicio;
      return { fechaInicio, primerSemana, semanaActual };
    },
  );

// ============================================================
// Acumulado global (desde primer semana hasta semana actual)
// ============================================================

function semanasEntre(
  inicioISO: string,
  finISO: string,
): { inicio: string; fin: string }[] {
  const out: { inicio: string; fin: string }[] = [];
  const start = new Date(inicioISO + "T12:00:00");
  const end = new Date(finISO + "T12:00:00");
  const cur = new Date(start);
  // Seguro: cap a 520 semanas (~10 años) para evitar bucles patológicos.
  let guard = 0;
  while (cur <= end && guard < 520) {
    out.push(calcularSemana(cur));
    cur.setDate(cur.getDate() + 7);
    guard++;
  }
  return out;
}

export const getEstadoResultadosAcumulado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ obraId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<SemanaDetalle> => {
    const { supabase } = context;
    const { data: obra, error } = await supabase
      .from("obras")
      .select("fecha_inicio, created_at")
      .eq("id", data.obraId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!obra) throw new Error("Obra no encontrada");
    const base = obra.fecha_inicio
      ? new Date(obra.fecha_inicio + "T12:00:00")
      : new Date(obra.created_at);
    const primer = calcularSemana(base);
    const actual = calcularSemana(new Date());
    const semanas = semanasEntre(primer.inicio, actual.inicio);

    const buckets = await calcularBuckets(supabase, data.obraId, semanas, true);

    // Agregar
    const costos = emptyCostos();
    const detalle = emptyDetalle();
    const produccion_detalle: DocumentoCosto[] = [];
    let produccion = 0;
    for (const b of buckets) {
      produccion += b.produccion;
      for (const cat of Object.keys(costos) as CostoCategoria[]) {
        costos[cat] += b.costos[cat];
        detalle[cat].push(...b.detalle[cat]);
      }
      produccion_detalle.push(...b.produccion_detalle);
    }
    const ct = totalCostos(costos);
    const resultado = produccion - ct;
    return {
      semana_inicio: primer.inicio,
      semana_fin: actual.fin,
      produccion,
      costos,
      costos_total: ct,
      resultado,
      margen: produccion > 0 ? resultado / produccion : 0,
      detalle,
      produccion_detalle,
    };
  });

