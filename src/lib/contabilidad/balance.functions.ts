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
        .eq("estatus", "autorizado"),
      // Caja chica reembolsos aprobados sin reponer
      supabase
        .from("caja_chica_reembolsos")
        .select("monto_aprobado, estatus")
        .eq("company_id", companyId)
        .in("estatus", ["enviado_admin"]),
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

    const cajaChica = sum(cajaChicaRes.data, "monto_entregado");

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
