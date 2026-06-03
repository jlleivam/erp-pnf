import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularSemana, toISODate } from "@/lib/estimacion-utils";

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
    // Producción: estimaciones cuya semana_inicio cae en alguna de las semanas
    supabase
      .from("obra_estimaciones")
      .select("id, numero, semana_inicio, semana_fin, monto_total, estatus")
      .eq("obra_id", obraId)
      .in("semana_inicio", semanasInicios),
    // Almacén: agrupar por almacen_semanas.semana_inicio
    supabase
      .from("almacen_semanas")
      .select(
        "id, semana_inicio, semana_fin, estatus, almacen_movimientos_semana(utilizado, precio_unitario)",
      )
      .eq("obra_id", obraId)
      .in("semana_inicio", semanasInicios),
    supabase
      .from("obra_nominas")
      .select("id, numero, semana_inicio, semana_fin, monto_total, estatus")
      .eq("obra_id", obraId)
      .in("semana_inicio", semanasInicios),
    // Destajos: estimaciones de destajo
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
    // Rentas: cualquiera cuyo período se superponga con el rango total
    supabase
      .from("obra_rentas")
      .select(
        "id, numero, equipo, cantidad, tarifa_unitaria, periodicidad, fecha_estimada_inicio, fecha_llegada_real, fecha_fin_programada, fecha_devolucion_real, estatus",
      )
      .eq("obra_id", obraId)
      .not("estatus", "in", "(borrador,rechazada,cancelada)"),
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
      .select("id, concepto, fecha, monto, estatus")
      .eq("obra_id", obraId)
      .neq("estatus", "rechazado")
      .gte("fecha", rangoInicio)
      .lte("fecha", rangoFin),
  ]);

  // Producción
  const estIds = (estimacionesRes.data ?? []).map((e: any) => e.id);
  let renglonesByEst = new Map<string, number>();
  if (estIds.length > 0) {
    const { data: rens } = await supabase
      .from("obra_estimacion_renglones")
      .select("estimacion_id, importe_ejecutado")
      .in("estimacion_id", estIds);
    for (const r of rens ?? []) {
      const cur = renglonesByEst.get(r.estimacion_id) ?? 0;
      renglonesByEst.set(r.estimacion_id, cur + num(r.importe_ejecutado));
    }
  }
  for (const e of estimacionesRes.data ?? []) {
    const b = buckets.get(e.semana_inicio);
    if (!b) continue;
    const monto = renglonesByEst.get(e.id) ?? num(e.monto_total);
    b.produccion += monto;
    b.produccion_detalle.push({
      id: e.id,
      titulo: `Estimación #${e.numero}`,
      monto,
      estatus: e.estatus,
      link: null,
    });
  }

  // Almacén
  for (const s of almacenRes.data ?? []) {
    const b = buckets.get(s.semana_inicio);
    if (!b) continue;
    const monto = (s.almacen_movimientos_semana ?? []).reduce(
      (acc: number, m: any) => acc + num(m.utilizado) * num(m.precio_unitario),
      0,
    );
    if (monto === 0) continue;
    b.costos.almacen += monto;
    b.detalle.almacen.push({
      id: s.id,
      titulo: `Consumo semana almacén`,
      monto,
      estatus: s.estatus,
    });
  }

  // Nómina
  for (const n of nominasRes.data ?? []) {
    const b = buckets.get(n.semana_inicio);
    if (!b) continue;
    const monto = num(n.monto_total);
    b.costos.nomina += monto;
    b.detalle.nomina.push({
      id: n.id,
      titulo: `Nómina #${n.numero}`,
      monto,
      estatus: n.estatus,
    });
  }

  // Destajos
  for (const d of destajosRes.data ?? []) {
    const b = buckets.get(d.semana_inicio);
    if (!b) continue;
    const monto = num(d.monto_total);
    b.costos.destajos += monto;
    b.detalle.destajos.push({
      id: d.id,
      titulo: `${d.obra_destajos?.nombre ?? "Destajo"} — estim. #${d.numero}`,
      monto,
      estatus: d.estatus,
    });
  }

  // Subcontratos
  for (const sc of subcontratosRes.data ?? []) {
    const b = buckets.get(sc.semana_inicio);
    if (!b) continue;
    const monto = num(sc.monto_total);
    b.costos.subcontratos += monto;
    b.detalle.subcontratos.push({
      id: sc.id,
      titulo: `${sc.obra_subcontratos?.nombre ?? "Subcontrato"} — estim. #${sc.numero}`,
      monto,
      estatus: sc.estatus,
    });
  }

  // Rentas (prorrateo)
  const hoyISO = toISODate(new Date());
  for (const r of rentasRes.data ?? []) {
    const inicio = r.fecha_llegada_real ?? r.fecha_estimada_inicio;
    if (!inicio) continue;
    const fin = r.fecha_devolucion_real ?? r.fecha_fin_programada ?? hoyISO;
    const td = tarifaDiaria(num(r.tarifa_unitaria), r.periodicidad) * num(r.cantidad || 1);
    for (const b of buckets.values()) {
      const dias = diasOverlap(inicio, fin, b.inicio, b.fin);
      if (dias <= 0) continue;
      const monto = td * dias;
      b.costos.rentas += monto;
      b.detalle.rentas.push({
        id: r.id,
        titulo: `${r.equipo} (${dias}d × ${r.periodicidad ?? "mensual"})`,
        monto,
        estatus: r.estatus,
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
    });
  }

  // Caja chica
  for (const g of cajaRes.data ?? []) {
    const b = bucketFor(buckets, g.fecha);
    if (!b) continue;
    const monto = num(g.monto);
    b.costos.cajaChica += monto;
    b.detalle.cajaChica.push({
      id: g.id,
      titulo: g.concepto,
      monto,
      estatus: g.estatus,
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
    const buckets = await calcularBuckets(supabase, data.obraId, [semana]);
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
