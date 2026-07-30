import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Context helper
// ============================================================
async function getCtx(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", userId).maybeSingle();
  if (!profile?.company_id) throw new Error("Sin empresa asociada");
  const companyId = profile.company_id as string;
  const { data: roles } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("company_id", companyId);
  const set = new Set((roles ?? []).map((r: any) => r.role as string));
  if (!set.has("director") && !set.has("administrativo")) {
    throw new Error("Solo dirección o administrativo puede ver este reporte");
  }
  return { companyId };
}

// ============================================================
// Concepto buckets
// ============================================================
const BUCKET_LABEL: Record<string, string> = {
  nomina_obra: "Nómina obra",
  nomina_oficina: "Nómina oficina",
  destajo: "Destajos",
  subcontrato: "Subcontratos",
  renta: "Rentas",
  gasolina: "Gasolinas",
  caja_chica: "Caja chica",
  insumos: "Insumos / CxP proveedor",
  gasto_oficina: "Gastos oficina",
  traspaso_fondo: "Fondo de caja chica (traspaso)",
  otro: "Otros",
};

// Conceptos que NO representan costo: son traspasos entre cuentas de activo
const BUCKETS_INFORMATIVOS = new Set<string>(["traspaso_fondo"]);

function bucketFromOrigen(origen: string | null | undefined, obraId: string | null): string {
  const o = (origen ?? "").toLowerCase();
  // Entrega/reposición de fondo de caja chica: traspaso de activo, no gasto
  if (o.includes("caja_chica_fondo") || o.includes("reembolso")) return "traspaso_fondo";
  if (o.includes("nomina")) return obraId ? "nomina_obra" : "nomina_oficina";
  if (o.includes("destajo")) return "destajo";
  if (o.includes("subcontrato")) return "subcontrato";
  if (o.includes("renta")) return "renta";
  if (o.includes("gasolina") || o.includes("vale")) return "gasolina";
  if (o.includes("caja_chica")) return "traspaso_fondo";
  if (o.includes("gasto_oficina")) return "gasto_oficina";
  if (o === "oc" || o === "cxp" || o.includes("requisicion") || o.includes("recepcion")) return "insumos";
  return obraId ? "otro" : "gasto_oficina";
}


// ============================================================
// Output types
// ============================================================
export type CondensadoItem = {
  id: string;
  fuente: "cxp" | "pago";
  folio: string | null;
  fecha: string; // ISO
  concepto: string;
  beneficiario: string | null;
  devengado: number;
  pagado: number;
};

export type CondensadoConcepto = {
  tipo: string;
  label: string;
  informativo: boolean; // true = traspaso de activo, no suma al costo
  devengado: number;
  pagado: number;
  items: CondensadoItem[];
};

export type CondensadoGrupo = {
  obra_id: string | null; // null = oficina
  obra_nombre: string;
  devengado: number;
  pagado: number;
  conceptos: CondensadoConcepto[];
};

export type CondensadoSemanalData = {
  semana: { inicio: string; fin: string };
  totales: { devengado: number; pagado: number; pendiente: number };
  grupos: CondensadoGrupo[];
};

// ============================================================
// Server function
// ============================================================
export const getCondensadoSemanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { semanaInicio: string }) =>
    z.object({ semanaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d)
  )
  .handler(async ({ data, context }): Promise<CondensadoSemanalData> => {
    const { supabase, userId } = context;
    const { companyId } = await getCtx(supabase, userId);

    const inicio = data.semanaInicio;
    const finDate = new Date(inicio + "T00:00:00Z");
    finDate.setUTCDate(finDate.getUTCDate() + 6);
    const fin = finDate.toISOString().slice(0, 10);

    // 1) CxP emitidas en la semana (= devengado)
    const { data: cxps, error: cxpErr } = await supabase
      .from("cuentas_por_pagar")
      .select(
        "id, folio, fecha_emision, obra_id, beneficiario_nombre, concepto, monto_total, monto_pagado, origen_tipo, obra:obras(id, nombre)"
      )
      .eq("company_id", companyId)
      .neq("estatus", "cancelada")
      .gte("fecha_emision", inicio)
      .lte("fecha_emision", fin);
    if (cxpErr) throw cxpErr;

    // 2) Pagos realizados en la semana
    const { data: pagos, error: pagErr } = await supabase
      .from("pagos")
      .select(
        "id, fecha, monto, concepto, origen_tipo, cxp_id, cxp:cuentas_por_pagar(id, folio, obra_id, origen_tipo, beneficiario_nombre, concepto, obra:obras(id, nombre))"
      )
      .eq("company_id", companyId)
      .is("cancelado_at", null)
      .gte("fecha", inicio)
      .lte("fecha", fin);
    if (pagErr) throw pagErr;

    // ============================================================
    // Build groups
    // ============================================================
    type GrupoBuilder = Map<string, CondensadoConcepto>;
    const grupos = new Map<string | null, {
      obra_id: string | null;
      obra_nombre: string;
      devengado: number;
      pagado: number;
      conceptos: GrupoBuilder;
    }>();

    const ensureGrupo = (obraId: string | null, nombre: string) => {
      const key = obraId;
      let g = grupos.get(key);
      if (!g) {
        g = {
          obra_id: obraId,
          obra_nombre: obraId ? nombre : "Oficina (sin obra)",
          devengado: 0,
          pagado: 0,
          conceptos: new Map(),
        };
        grupos.set(key, g);
      }
      return g;
    };

    const ensureConcepto = (g: ReturnType<typeof ensureGrupo>, tipo: string) => {
      let c = g.conceptos.get(tipo);
      if (!c) {
        c = {
          tipo,
          label: BUCKET_LABEL[tipo] ?? tipo,
          informativo: BUCKETS_INFORMATIVOS.has(tipo),
          devengado: 0,
          pagado: 0,
          items: [],
        };
        g.conceptos.set(tipo, c);
      }
      return c;
    };

    // CxP → devengado
    for (const r of (cxps ?? []) as any[]) {
      const obraId: string | null = r.obra_id ?? null;
      const obraNombre = r.obra?.nombre ?? "Oficina (sin obra)";
      const tipo = bucketFromOrigen(r.origen_tipo, obraId);
      const monto = Number(r.monto_total ?? 0);
      const g = ensureGrupo(obraId, obraNombre);
      const c = ensureConcepto(g, tipo);
      if (!c.informativo) g.devengado += monto;
      c.devengado += monto;
      c.items.push({
        id: `cxp-${r.id}`,
        fuente: "cxp",
        folio: r.folio ?? null,
        fecha: r.fecha_emision,
        concepto: r.concepto ?? "",
        beneficiario: r.beneficiario_nombre ?? null,
        devengado: monto,
        pagado: 0,
      });
    }

    // Pagos → pagado
    for (const p of (pagos ?? []) as any[]) {
      const cxp = p.cxp;
      const obraId: string | null = cxp?.obra_id ?? null;
      const obraNombre = cxp?.obra?.nombre ?? "Oficina (sin obra)";
      const origen = cxp?.origen_tipo ?? p.origen_tipo ?? null;
      const tipo = bucketFromOrigen(origen, obraId);
      const monto = Number(p.monto ?? 0);
      const g = ensureGrupo(obraId, obraNombre);
      const c = ensureConcepto(g, tipo);
      if (!c.informativo) g.pagado += monto;
      c.pagado += monto;
      c.items.push({
        id: `pago-${p.id}`,
        fuente: "pago",
        folio: cxp?.folio ?? null,
        fecha: p.fecha,
        concepto: p.concepto ?? cxp?.concepto ?? "",
        beneficiario: cxp?.beneficiario_nombre ?? null,
        devengado: 0,
        pagado: monto,
      });
    }

    // Gastos comprobados de caja chica → costo real de la obra
    const { data: ccGastos, error: ccErr } = await supabase
      .from("caja_chica_gastos")
      .select("id, fecha, monto, concepto, descripcion, obra_id, estatus, tipo_comprobante")
      .eq("company_id", companyId)
      .in("estatus", ["aprobado", "reembolsado"])
      .gte("fecha", inicio)
      .lte("fecha", fin);
    if (ccErr) throw ccErr;

    // Nombres de obra (no hay relación declarada entre caja_chica_gastos y obras)
    const obraIds = [...new Set(((ccGastos ?? []) as any[]).map((g) => g.obra_id).filter(Boolean))];
    const obraNombres = new Map<string, string>();
    if (obraIds.length) {
      const { data: obrasRows } = await supabase
        .from("obras").select("id, nombre").in("id", obraIds);
      for (const o of (obrasRows ?? []) as any[]) obraNombres.set(o.id, o.nombre);
    }

    for (const gto of (ccGastos ?? []) as any[]) {
      const obraId: string | null = gto.obra_id ?? null;
      const obraNombre = (obraId && obraNombres.get(obraId)) || "Oficina (sin obra)";

      const monto = Number(gto.monto ?? 0);
      const g = ensureGrupo(obraId, obraNombre);
      const c = ensureConcepto(g, "caja_chica");
      const pagado = gto.estatus === "reembolsado" ? monto : 0;
      g.devengado += monto;
      g.pagado += pagado;
      c.devengado += monto;
      c.pagado += pagado;
      c.items.push({
        id: `ccg-${gto.id}`,
        fuente: "cxp",
        folio: null,
        fecha: gto.fecha,
        concepto: gto.concepto ?? gto.descripcion ?? "Gasto de caja chica",
        beneficiario: gto.tipo_comprobante ? `Comprobante: ${gto.tipo_comprobante}` : null,
        devengado: monto,
        pagado: pagado,
      });
    }


    // Sort: obras first (alpha), oficina last
    const gruposArr: CondensadoGrupo[] = [...grupos.values()]
      .map((g) => ({
        obra_id: g.obra_id,
        obra_nombre: g.obra_nombre,
        devengado: Math.round(g.devengado * 100) / 100,
        pagado: Math.round(g.pagado * 100) / 100,
        conceptos: [...g.conceptos.values()]
          .map((c) => ({
            ...c,
            devengado: Math.round(c.devengado * 100) / 100,
            pagado: Math.round(c.pagado * 100) / 100,
            items: c.items.sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
          }))
          .sort((a, b) => b.devengado + b.pagado - (a.devengado + a.pagado)),
      }))
      .sort((a, b) => {
        if (a.obra_id === null) return 1;
        if (b.obra_id === null) return -1;
        return a.obra_nombre.localeCompare(b.obra_nombre);
      });

    const totalDevengado = gruposArr.reduce((s, g) => s + g.devengado, 0);
    const totalPagado = gruposArr.reduce((s, g) => s + g.pagado, 0);

    return {
      semana: { inicio, fin },
      totales: {
        devengado: Math.round(totalDevengado * 100) / 100,
        pagado: Math.round(totalPagado * 100) / 100,
        pendiente: Math.round((totalDevengado - totalPagado) * 100) / 100,
      },
      grupos: gruposArr,
    };
  });
