import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CATALOGO_CONTABLE } from "./catalogo";


type SaldoCategoria = {
  codigo: string;
  saldo: number;
  disponible: boolean;
};

async function getMyCompanyId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.company_id) throw new Error("Sin empresa asociada");
  return data.company_id as string;
}

async function ensureAdmin(supabase: any, userId: string, companyId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId);
  const allowed = new Set(["director", "administrativo"]);
  const ok = (roles ?? []).some((r: any) => allowed.has(r.role));
  if (!ok) throw new Error("No tienes permisos para ver el balance general");
}

const num = (v: any) => Number(v ?? 0) || 0;
const sum = (rows: any[] | null, key: string) =>
  (rows ?? []).reduce((acc, r) => acc + num(r[key]), 0);

export const getBalanceGeneral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const companyId = await getMyCompanyId(supabase, userId);
    await ensureAdmin(supabase, userId, companyId);

    // ----- consultas en paralelo -----
    const [
      companyRes,
      cuentasRes,
      cajaChicaRes,
      anticiposDestajoRes,
      destajoEstimAmortRes,
      ocPendRes,
      destajoEstimRes,
      subEstimRes,
      nominaRes,
      gasolinaRes,
      cajaChicaReembRes,
      cajaChicaFondoCxPRes,
      pagosRes,
    ] = await Promise.all([
      supabase.from("companies").select("capital_social").eq("id", companyId).maybeSingle(),
      supabase.from("cuentas").select("tipo, saldo_actual").eq("company_id", companyId).eq("activa", true),
      supabase
        .from("caja_chica_fondos")
        .select("monto_entregado, estatus")
        .eq("company_id", companyId)
        .eq("estatus", "entregado"),
      // Anticipos a destajistas pagados
      supabase
        .from("obra_destajo_anticipos")
        .select("monto")
        .eq("company_id", companyId)
        .eq("pagado", true),
      // Amortizaciones de anticipos en estimaciones de destajo
      supabase
        .from("obra_destajo_estimaciones")
        .select("amortizacion_anticipo")
        .eq("company_id", companyId),
      // OC pendientes (autorizadas / enviadas a proveedor, no totalmente pagadas)
      supabase
        .from("ordenes_compra")
        .select("total, monto_pagado, estatus, estado_pago")
        .eq("company_id", companyId)
        .in("estatus", ["autorizada", "enviada", "recibida_parcial", "recibida"])
        .neq("estado_pago", "pagado"),
      // Destajistas por pagar: CxP pendientes/parciales de estimaciones de destajo
      supabase
        .from("cuentas_por_pagar")
        .select("monto_total, monto_pagado, beneficiario_tipo, origen_tipo, estatus, cancelado_at")
        .eq("company_id", companyId)
        .eq("beneficiario_tipo", "trabajador")
        .eq("origen_tipo", "destajo_estimacion")
        .in("estatus", ["pendiente", "parcial"])
        .is("cancelado_at", null),
      // Subcontratistas por pagar: CxP pendientes/parciales de estimaciones de subcontrato
      supabase
        .from("cuentas_por_pagar")
        .select("monto_total, monto_pagado, beneficiario_tipo, origen_tipo, estatus, cancelado_at")
        .eq("company_id", companyId)
        .eq("beneficiario_tipo", "tercero")
        .eq("origen_tipo", "subcontrato_estimacion")
        .in("estatus", ["pendiente", "parcial"])
        .is("cancelado_at", null),

      // Nómina por pagar
      supabase
        .from("obra_nominas")
        .select("monto_total, estatus")
        .eq("company_id", companyId)
        .eq("estatus", "cerrada"),
      // Vales de gasolina autorizados
      supabase
        .from("vales_gasolina")
        .select("monto_autorizado, estatus")
        .eq("company_id", companyId)
        .in("estatus", ["entregado", "confirmado"]),
      // Caja chica reembolsos aprobados sin reponer
      supabase
        .from("caja_chica_reembolsos")
        .select("monto_aprobado, residente_id, estatus")
        .eq("company_id", companyId)
        .in("estatus", ["enviado_admin"]),
      // CxP de fondos de caja chica (pendientes / parciales)
      supabase
        .from("cuentas_por_pagar")
        .select("monto_total, monto_pagado, estatus, cancelado_at")
        .eq("company_id", companyId)
        .eq("origen_tipo", "caja_chica_fondo")
        .in("estatus", ["pendiente", "parcial"])
        .is("cancelado_at", null),
      // Pagos por origen para descontar de pasivos
      supabase
        .from("pagos")
        .select("origen_tipo, monto, cancelado_at")
        .eq("company_id", companyId)
        .is("cancelado_at", null),
    ]);

    // ----- ACTIVOS -----
    const cuentas = cuentasRes.data ?? [];
    const bancos = cuentas
      .filter((c: any) => c.tipo === "bancaria")
      .reduce((acc: number, c: any) => acc + num(c.saldo_actual), 0);
    const cajaFuerte = cuentas
      .filter((c: any) => c.tipo === "caja_fuerte")
      .reduce((acc: number, c: any) => acc + num(c.saldo_actual), 0);

    const reembPendientesTotal = sum(cajaChicaReembRes.data, "monto_aprobado");
    const cajaChica = Math.max(
      0,
      sum(cajaChicaRes.data, "monto_entregado") - reembPendientesTotal,
    );

    const anticiposDestajoBruto = sum(anticiposDestajoRes.data, "monto");
    const amortizadoDestajo = sum(destajoEstimAmortRes.data, "amortizacion_anticipo");
    const anticiposDestajistas = Math.max(0, anticiposDestajoBruto - amortizadoDestajo);

    // ----- PASIVOS -----
    const proveedoresPorPagar = (ocPendRes.data ?? []).reduce(
      (acc: number, r: any) => acc + Math.max(0, num(r.total) - num(r.monto_pagado)),
      0,
    );

    const pagosPorOrigen = new Map<string, number>();
    for (const p of pagosRes.data ?? []) {
      pagosPorOrigen.set(p.origen_tipo, (pagosPorOrigen.get(p.origen_tipo) ?? 0) + num(p.monto));
    }
    const pagado = (origen: string) => pagosPorOrigen.get(origen) ?? 0;

    const destajistasPorPagar = (destajoEstimRes.data ?? []).reduce(
      (acc: number, r: any) => acc + Math.max(0, num(r.monto_total) - num(r.monto_pagado)),
      0,
    );
    const subcontratistasPorPagar = (subEstimRes.data ?? []).reduce(
      (acc: number, r: any) => acc + Math.max(0, num(r.monto_total) - num(r.monto_pagado)),
      0,
    );

    const nominaPorPagar = Math.max(0, sum(nominaRes.data, "monto_total") - pagado("nomina"));
    const gasolinaPorReembolsar = Math.max(
      0,
      sum(gasolinaRes.data, "monto_autorizado") - pagado("gasolina"),
    );
    const cajaChicaPorReembolsar = Math.max(
      0,
      sum(cajaChicaReembRes.data, "monto_aprobado") - pagado("caja_chica"),
    );
    const cajaChicaFondoPorPagar = (cajaChicaFondoCxPRes.data ?? []).reduce(
      (acc: number, r: any) => acc + Math.max(0, num(r.monto_total) - num(r.monto_pagado)),
      0,
    );


    // ----- CAPITAL -----
    const capitalSocial = num(companyRes.data?.capital_social);

    // ----- mapa de saldos -----
    const saldosMap: Record<string, SaldoCategoria> = {
      "1100": { codigo: "1100", saldo: bancos, disponible: true },
      "1110": { codigo: "1110", saldo: cajaFuerte, disponible: true },
      "1120": { codigo: "1120", saldo: cajaChica, disponible: true },
      "1200": { codigo: "1200", saldo: 0, disponible: false },
      "1210": { codigo: "1210", saldo: anticiposDestajistas, disponible: true },
      "1220": { codigo: "1220", saldo: 0, disponible: false },
      "1300": { codigo: "1300", saldo: 0, disponible: false },
      "1400": { codigo: "1400", saldo: 0, disponible: false },
      "2100": { codigo: "2100", saldo: proveedoresPorPagar, disponible: true },
      "2110": { codigo: "2110", saldo: destajistasPorPagar, disponible: true },
      "2120": { codigo: "2120", saldo: subcontratistasPorPagar, disponible: true },
      "2130": { codigo: "2130", saldo: nominaPorPagar, disponible: true },
      "2140": { codigo: "2140", saldo: 0, disponible: false },
      "2150": { codigo: "2150", saldo: gasolinaPorReembolsar, disponible: true },
      "2160": { codigo: "2160", saldo: cajaChicaPorReembolsar, disponible: true },
      "2170": { codigo: "2170", saldo: cajaChicaFondoPorPagar, disponible: true },
      "3100": { codigo: "3100", saldo: capitalSocial, disponible: true },
    };

    // Totales
    let totalActivo = 0;
    let totalPasivo = 0;
    for (const cat of CATALOGO_CONTABLE) {
      const s = saldosMap[cat.codigo]?.saldo ?? 0;
      if (cat.grupo === "activo") totalActivo += s;
      if (cat.grupo === "pasivo") totalPasivo += s;
    }

    // Resultado del ejercicio = Activo - Pasivo - Capital social
    const resultadoEjercicio = totalActivo - totalPasivo - capitalSocial;
    saldosMap["3200"] = { codigo: "3200", saldo: resultadoEjercicio, disponible: true };

    const totalCapital = capitalSocial + resultadoEjercicio;

    return {
      generadoEn: new Date().toISOString(),
      capitalSocial,
      saldos: CATALOGO_CONTABLE.map((cat) => ({
        ...cat,
        saldo: saldosMap[cat.codigo]?.saldo ?? 0,
      })),
      totales: {
        activo: totalActivo,
        pasivo: totalPasivo,
        capital: totalCapital,
        resultadoEjercicio,
      },
    };
  });

// ============================================================
// Desglose por cuenta contable
// ============================================================

export type DetalleItem = {
  id: string;
  etiqueta: string;
  referencia?: string;
  saldo: number;
};

export const getDetalleCuenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ codigo: z.string().min(3).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await getMyCompanyId(supabase, userId);
    await ensureAdmin(supabase, userId, companyId);
    const items = await buildDetalle(supabase, companyId, data.codigo);
    items.sort((a, b) => b.saldo - a.saldo);
    return { codigo: data.codigo, items };
  });

async function buildDetalle(
  supabase: any,
  companyId: string,
  codigo: string,
): Promise<DetalleItem[]> {
  switch (codigo) {
    case "1100":
    case "1110": {
      const tipo = codigo === "1100" ? "bancaria" : "caja_fuerte";
      const { data } = await supabase
        .from("cuentas")
        .select("id, nombre, saldo_actual")
        .eq("company_id", companyId)
        .eq("activa", true)
        .eq("tipo", tipo);
      return (data ?? [])
        .filter((r: any) => num(r.saldo_actual) !== 0)
        .map((r: any) => ({ id: r.id, etiqueta: r.nombre, saldo: num(r.saldo_actual) }));
    }

    case "1120": {
      const [fondosRes, reembRes] = await Promise.all([
        supabase
          .from("caja_chica_fondos")
          .select("id, monto_entregado, residente_id, obra_id")
          .eq("company_id", companyId)
          .eq("estatus", "entregado"),
        supabase
          .from("caja_chica_reembolsos")
          .select("residente_id, monto_aprobado")
          .eq("company_id", companyId)
          .eq("estatus", "enviado_admin"),
      ]);
      const filas = fondosRes.data ?? [];
      const pendientesPorResidente = new Map<string, number>();
      for (const r of reembRes.data ?? []) {
        if (!r.residente_id) continue;
        pendientesPorResidente.set(
          r.residente_id,
          (pendientesPorResidente.get(r.residente_id) ?? 0) + num(r.monto_aprobado),
        );
      }
      const residenteIds = Array.from(new Set(filas.map((r: any) => r.residente_id).filter(Boolean)));
      const obraIds = Array.from(new Set(filas.map((r: any) => r.obra_id).filter(Boolean)));
      const [trabRes, obraRes] = await Promise.all([
        residenteIds.length
          ? supabase.from("trabajadores").select("id, nombre_completo").in("id", residenteIds)
          : Promise.resolve({ data: [] }),
        obraIds.length
          ? supabase.from("obras").select("id, nombre").in("id", obraIds)
          : Promise.resolve({ data: [] }),
      ]);
      const tMap = new Map<string, string>(((trabRes.data ?? []) as any[]).map((t: any): [string, string] => [t.id, t.nombre_completo]));
      const oMap = new Map<string, string>(((obraRes.data ?? []) as any[]).map((o: any): [string, string] => [o.id, o.nombre]));
      return filas
        .map((r: any) => {
          const pendiente = pendientesPorResidente.get(r.residente_id) ?? 0;
          const saldo = Math.max(0, num(r.monto_entregado) - pendiente);
          return {
            id: r.id,
            etiqueta: tMap.get(r.residente_id) ?? "Residente",
            referencia: oMap.get(r.obra_id),
            saldo,
          };
        })
        .filter((r: any) => r.saldo > 0);
    }

    case "1210": {
      const [antRes, estRes] = await Promise.all([
        supabase
          .from("obra_destajo_anticipos")
          .select("destajo_id, monto, pagado")
          .eq("company_id", companyId)
          .eq("pagado", true),
        supabase
          .from("obra_destajo_estimaciones")
          .select("destajo_id, amortizacion_anticipo")
          .eq("company_id", companyId),
      ]);
      const destajoIds = Array.from(
        new Set([
          ...(antRes.data ?? []).map((r: any) => r.destajo_id),
          ...(estRes.data ?? []).map((r: any) => r.destajo_id),
        ]),
      );
      if (destajoIds.length === 0) return [];
      const { data: destajos } = await supabase
        .from("obra_destajos")
        .select("id, destajista_id, nombre, obra_id")
        .in("id", destajoIds);
      const trabIds = Array.from(
        new Set((destajos ?? []).map((d: any) => d.destajista_id).filter(Boolean)),
      );
      const trabRes = trabIds.length
        ? await supabase.from("trabajadores").select("id, nombre_completo").in("id", trabIds)
        : { data: [] };
      const tMap = new Map<string, string>(((trabRes.data ?? []) as any[]).map((t: any): [string, string] => [t.id, t.nombre_completo]));
      const destajoToTrab = new Map<string, string>(
        ((destajos ?? []) as any[]).map((d: any): [string, string] => [d.id, d.destajista_id]),
      );

      const acc = new Map<string, { etiqueta: string; saldo: number }>();
      for (const a of antRes.data ?? []) {
        const tid = destajoToTrab.get(a.destajo_id);
        if (!tid) continue;
        const cur = acc.get(tid) ?? { etiqueta: tMap.get(tid) ?? "Destajista", saldo: 0 };
        cur.saldo += num(a.monto);
        acc.set(tid, cur);
      }
      for (const e of estRes.data ?? []) {
        const tid = destajoToTrab.get(e.destajo_id);
        if (!tid) continue;
        const cur = acc.get(tid);
        if (!cur) continue;
        cur.saldo -= num(e.amortizacion_anticipo);
      }
      return Array.from(acc.entries())
        .filter(([, v]) => v.saldo > 0.01)
        .map(([id, v]) => ({ id, etiqueta: v.etiqueta, saldo: v.saldo }));
    }

    case "2100": {
      const { data: ocs } = await supabase
        .from("ordenes_compra")
        .select("id, folio, total, monto_pagado, proveedor_id")
        .eq("company_id", companyId)
        .in("estatus", ["autorizada", "enviada", "recibida_parcial", "recibida"])
        .neq("estado_pago", "pagado");
      const filas = ocs ?? [];
      const provIds = Array.from(new Set(filas.map((r: any) => r.proveedor_id).filter(Boolean)));
      const provRes = provIds.length
        ? await supabase.from("terceros").select("id, razon_social").in("id", provIds)
        : { data: [] };
      const pMap = new Map<string, string>(((provRes.data ?? []) as any[]).map((p: any): [string, string] => [p.id, p.razon_social]));
      const acc = new Map<string, { etiqueta: string; folios: string[]; saldo: number }>();
      for (const r of filas as any[]) {
        const saldo = Math.max(0, num(r.total) - num(r.monto_pagado));
        if (saldo <= 0) continue;
        const key = r.proveedor_id ?? "sin-proveedor";
        const cur: { etiqueta: string; folios: string[]; saldo: number } = acc.get(key) ?? {
          etiqueta: pMap.get(r.proveedor_id) ?? "Sin proveedor",
          folios: [],
          saldo: 0,
        };

        cur.folios.push(r.folio);
        cur.saldo += saldo;
        acc.set(key, cur);
      }
      return Array.from(acc.entries()).map(([id, v]) => ({
        id,
        etiqueta: v.etiqueta,
        referencia: v.folios.join(", "),
        saldo: v.saldo,
      }));
    }

    case "2110":
    case "2120": {
      const origen = codigo === "2110" ? "destajo_estimacion" : "subcontrato_estimacion";
      const benefTipo = codigo === "2110" ? "trabajador" : "tercero";
      const { data } = await supabase
        .from("cuentas_por_pagar")
        .select("id, folio, monto_total, monto_pagado, beneficiario_id, beneficiario_nombre")
        .eq("company_id", companyId)
        .eq("beneficiario_tipo", benefTipo)
        .eq("origen_tipo", origen)
        .in("estatus", ["pendiente", "parcial"])
        .is("cancelado_at", null);
      const acc = new Map<string, { etiqueta: string; folios: string[]; saldo: number }>();
      for (const r of (data ?? []) as any[]) {
        const saldo = Math.max(0, num(r.monto_total) - num(r.monto_pagado));
        if (saldo <= 0) continue;
        const key = r.beneficiario_id ?? r.id;
        const cur: { etiqueta: string; folios: string[]; saldo: number } = acc.get(key) ?? {
          etiqueta: r.beneficiario_nombre ?? "—",
          folios: [],
          saldo: 0,
        };

        cur.folios.push(r.folio);
        cur.saldo += saldo;
        acc.set(key, cur);
      }
      return Array.from(acc.entries()).map(([id, v]) => ({
        id,
        etiqueta: v.etiqueta,
        referencia: v.folios.join(", "),
        saldo: v.saldo,
      }));
    }

    case "2130": {
      const [nomRes, pagosRes] = await Promise.all([
        supabase
          .from("obra_nominas")
          .select("id, monto_total, semana_inicio, semana_fin, obra_id")
          .eq("company_id", companyId)
          .eq("estatus", "cerrada"),
        supabase
          .from("pagos")
          .select("origen_id, monto, cancelado_at")
          .eq("company_id", companyId)
          .eq("origen_tipo", "nomina")
          .is("cancelado_at", null),
      ]);
      const pagosByNomina = new Map<string, number>();
      for (const p of pagosRes.data ?? []) {
        pagosByNomina.set(
          p.origen_id,
          (pagosByNomina.get(p.origen_id) ?? 0) + num(p.monto),
        );
      }
      const obraIds = Array.from(
        new Set((nomRes.data ?? []).map((n: any) => n.obra_id).filter(Boolean)),
      );
      const obraRes = obraIds.length
        ? await supabase.from("obras").select("id, nombre").in("id", obraIds)
        : { data: [] };
      const oMap = new Map<string, string>(((obraRes.data ?? []) as any[]).map((o: any): [string, string] => [o.id, o.nombre]));
      return (nomRes.data ?? [])
        .map((n: any) => ({
          id: n.id,
          etiqueta: oMap.get(n.obra_id) ?? "Nómina",
          referencia: `Semana ${n.semana_inicio} → ${n.semana_fin}`,
          saldo: Math.max(0, num(n.monto_total) - (pagosByNomina.get(n.id) ?? 0)),
        }))
        .filter((r: DetalleItem) => r.saldo > 0.01);
    }

    case "2150": {
      const [valesRes, pagosRes] = await Promise.all([
        supabase
          .from("vales_gasolina")
          .select("id, folio, monto_autorizado, obra_id")
          .eq("company_id", companyId)
          .in("estatus", ["entregado", "confirmado"]),
        supabase
          .from("pagos")
          .select("origen_id, monto, cancelado_at")
          .eq("company_id", companyId)
          .eq("origen_tipo", "gasolina")
          .is("cancelado_at", null),
      ]);
      const pagosByVale = new Map<string, number>();
      for (const p of pagosRes.data ?? []) {
        pagosByVale.set(p.origen_id, (pagosByVale.get(p.origen_id) ?? 0) + num(p.monto));
      }
      const obraIds = Array.from(
        new Set((valesRes.data ?? []).map((v: any) => v.obra_id).filter(Boolean)),
      );
      const obraRes = obraIds.length
        ? await supabase.from("obras").select("id, nombre").in("id", obraIds)
        : { data: [] };
      const oMap = new Map<string, string>(((obraRes.data ?? []) as any[]).map((o: any): [string, string] => [o.id, o.nombre]));
      return (valesRes.data ?? [])
        .map((v: any) => ({
          id: v.id,
          etiqueta: v.folio,
          referencia: oMap.get(v.obra_id),
          saldo: Math.max(0, num(v.monto_autorizado) - (pagosByVale.get(v.id) ?? 0)),
        }))
        .filter((r: DetalleItem) => r.saldo > 0.01);
    }

    case "2160": {
      const [reembRes, pagosRes] = await Promise.all([
        supabase
          .from("caja_chica_reembolsos")
          .select("id, folio, monto_aprobado, residente_id, obra_id")
          .eq("company_id", companyId)
          .in("estatus", ["enviado_admin"]),
        supabase
          .from("pagos")
          .select("origen_id, monto, cancelado_at")
          .eq("company_id", companyId)
          .eq("origen_tipo", "caja_chica")
          .is("cancelado_at", null),
      ]);
      const pagosByReemb = new Map<string, number>();
      for (const p of pagosRes.data ?? []) {
        pagosByReemb.set(p.origen_id, (pagosByReemb.get(p.origen_id) ?? 0) + num(p.monto));
      }
      const trabIds = Array.from(
        new Set((reembRes.data ?? []).map((r: any) => r.residente_id).filter(Boolean)),
      );
      const trabRes = trabIds.length
        ? await supabase.from("trabajadores").select("id, nombre_completo").in("id", trabIds)
        : { data: [] };
      const tMap = new Map<string, string>(((trabRes.data ?? []) as any[]).map((t: any): [string, string] => [t.id, t.nombre_completo]));
      return (reembRes.data ?? [])
        .map((r: any) => ({
          id: r.id,
          etiqueta: tMap.get(r.residente_id) ?? r.folio,
          referencia: r.folio,
          saldo: Math.max(0, num(r.monto_aprobado) - (pagosByReemb.get(r.id) ?? 0)),
        }))
        .filter((r: DetalleItem) => r.saldo > 0.01);
    }

    case "3100": {
      const { data } = await supabase
        .from("companies")
        .select("capital_social, razon_social")
        .eq("id", companyId)
        .maybeSingle();
      const monto = num(data?.capital_social);
      if (monto <= 0) return [];
      return [{ id: companyId, etiqueta: data?.razon_social ?? "Capital social", saldo: monto }];
    }

    default:
      return [];
  }
}

