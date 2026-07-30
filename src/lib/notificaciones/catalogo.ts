import type { AppRole } from "@/stores/auth";

export type NotifRole = AppRole; // incluye director

export interface TipoNotificacion {
  key: string;
  modulo: string;
  label: string;
  descripcion?: string;
  defaults: Record<NotifRole, boolean>;
}

const ALL: Record<NotifRole, boolean> = {
  director: true, residente: true, auxiliar: true, administrativo: true, supervisor: true,
};
const D: Record<NotifRole, boolean> = {
  director: true, residente: false, auxiliar: false, administrativo: false, supervisor: false,
};
const DA: Record<NotifRole, boolean> = {
  director: true, residente: false, auxiliar: false, administrativo: true, supervisor: false,
};
const DS: Record<NotifRole, boolean> = {
  director: true, residente: false, auxiliar: false, administrativo: false, supervisor: true,
};
const DAS: Record<NotifRole, boolean> = {
  director: true, residente: false, auxiliar: false, administrativo: true, supervisor: true,
};
const DR: Record<NotifRole, boolean> = {
  director: true, residente: true, auxiliar: false, administrativo: false, supervisor: false,
};
const DAR: Record<NotifRole, boolean> = {
  director: true, residente: true, auxiliar: false, administrativo: true, supervisor: false,
};

export const CATALOGO_NOTIFICACIONES: TipoNotificacion[] = [
  // General
  { key: "bienvenida", modulo: "General", label: "Bienvenida al crear empresa", defaults: D },

  // Requisiciones
  { key: "requisicion_enviada", modulo: "Requisiciones", label: "Requisición enviada", defaults: DS },
  { key: "requisicion_aprobada", modulo: "Requisiciones", label: "Requisición aprobada", defaults: DAR },
  { key: "requisicion_rechazada", modulo: "Requisiciones", label: "Requisición rechazada", defaults: DAR },

  // Cotizaciones / OC de requisición
  { key: "oc_pendiente", modulo: "Órdenes de compra", label: "OC pendiente de autorizar", defaults: DA },
  { key: "oc_autorizada", modulo: "Órdenes de compra", label: "OC autorizada", defaults: DAR },
  { key: "oc_rechazada", modulo: "Órdenes de compra", label: "OC rechazada", defaults: DAR },

  // OC presupuesto
  { key: "oc_presupuesto_solicitada", modulo: "Órdenes de compra", label: "OC de presupuesto solicitada", defaults: DA },
  { key: "oc_presupuesto_autorizada", modulo: "Órdenes de compra", label: "OC de presupuesto autorizada", defaults: DAR },
  { key: "oc_presupuesto_rechazada", modulo: "Órdenes de compra", label: "OC de presupuesto rechazada", defaults: DAR },

  // OC subcontrato
  { key: "oc_subcontrato_solicitada", modulo: "Órdenes de compra", label: "OC de subcontrato solicitada", defaults: DA },
  { key: "oc_subcontrato_autorizada", modulo: "Órdenes de compra", label: "OC de subcontrato autorizada", defaults: DAR },
  { key: "oc_subcontrato_rechazada", modulo: "Órdenes de compra", label: "OC de subcontrato rechazada", defaults: DAR },

  // Almacén
  { key: "almacen_recepcion", modulo: "Almacén", label: "Recepción registrada", defaults: DA },
  { key: "almacen_desbloqueo_solicitado", modulo: "Almacén", label: "Solicitud de desbloqueo de semana", defaults: DA },
  { key: "almacen_desbloqueo_resuelto", modulo: "Almacén", label: "Resolución de desbloqueo", defaults: DR },

  // Gastos de obra
  { key: "gasto_obra_solicitado", modulo: "Gastos de obra", label: "Gasto de obra por autorizar", defaults: DS },
  { key: "gasto_obra_autorizado", modulo: "Gastos de obra", label: "Gasto de obra autorizado", defaults: DAR },
  { key: "gasto_obra_rechazado", modulo: "Gastos de obra", label: "Gasto de obra rechazado", defaults: DAR },
  { key: "gasto_obra_pagado", modulo: "Gastos de obra", label: "Gasto de obra pagado", defaults: DAR },

  // Caja chica
  { key: "caja_chica_fondo_solicitado", modulo: "Caja chica", label: "Fondo solicitado", defaults: DA },
  { key: "caja_chica_fondo_autorizado", modulo: "Caja chica", label: "Fondo autorizado", defaults: DR },
  { key: "caja_chica_gasto_pendiente", modulo: "Caja chica", label: "Gasto pendiente de aprobar", defaults: DS },
  { key: "caja_chica_reembolso_solicitado", modulo: "Caja chica", label: "Reembolso solicitado", defaults: DA },
  { key: "caja_chica_reembolso_autorizado", modulo: "Caja chica", label: "Reembolso autorizado", defaults: DR },

  // Cuentas por pagar / Pagos
  { key: "pago_registrado", modulo: "Cuentas por pagar", label: "Pago registrado", defaults: DA },

  // Destajos
  { key: "destajo_solicitado", modulo: "Destajos", label: "Destajo solicitado", defaults: DA },
  { key: "destajo_autorizado", modulo: "Destajos", label: "Destajo autorizado", defaults: DR },
  { key: "destajo_rechazado", modulo: "Destajos", label: "Destajo rechazado", defaults: DR },
  { key: "destajo_estimacion_cerrada", modulo: "Destajos", label: "Estimación de destajo cerrada", defaults: DS },
  { key: "destajo_estimacion_autorizada", modulo: "Destajos", label: "Estimación de destajo autorizada", defaults: DR },
  { key: "destajo_estimacion_rechazada", modulo: "Destajos", label: "Estimación de destajo rechazada", defaults: DR },
  { key: "destajo_anticipo_solicitado", modulo: "Destajos", label: "Anticipo de destajo solicitado", defaults: DA },
  { key: "destajo_anticipo_pagado", modulo: "Destajos", label: "Anticipo de destajo pagado", defaults: DR },

  // Subcontratos
  { key: "subcontrato_estimacion_cerrada", modulo: "Subcontratos", label: "Estimación de subcontrato cerrada", defaults: DS },
  { key: "subcontrato_estimacion_autorizada", modulo: "Subcontratos", label: "Estimación de subcontrato autorizada", defaults: DR },
  { key: "subcontrato_estimacion_rechazada", modulo: "Subcontratos", label: "Estimación de subcontrato rechazada", defaults: DR },
  { key: "subcontrato_anticipo_solicitado", modulo: "Subcontratos", label: "Anticipo de subcontrato solicitado", defaults: DA },
  { key: "subcontrato_anticipo_pagado", modulo: "Subcontratos", label: "Anticipo de subcontrato pagado", defaults: DR },

  // Rentas
  { key: "renta_solicitada", modulo: "Rentas", label: "Renta solicitada", defaults: DA },
  { key: "renta_cotizada", modulo: "Rentas", label: "Renta cotizada", defaults: DR },
  { key: "renta_vencimiento", modulo: "Rentas", label: "Aviso de vencimiento de renta", defaults: DAR },

  // Trabajadores
  { key: "trabajador_alta_solicitada", modulo: "Trabajadores", label: "Alta de trabajador solicitada", defaults: DA },
  { key: "trabajador_alta_autorizada", modulo: "Trabajadores", label: "Alta de trabajador autorizada", defaults: DR },

  // Gastos de oficina
  { key: "gasto_oficina_solicitado", modulo: "Gastos de oficina", label: "Gasto de oficina solicitado", defaults: D },
  { key: "gasto_oficina_autorizado", modulo: "Gastos de oficina", label: "Gasto de oficina autorizado", defaults: DA },
  { key: "gasto_oficina_rechazado", modulo: "Gastos de oficina", label: "Gasto de oficina rechazado", defaults: DA },

  // Vales de gasolina
  { key: "vale_gasolina_solicitado", modulo: "Vales de gasolina", label: "Vale de gasolina solicitado", defaults: DA },
  { key: "vale_gasolina_autorizado", modulo: "Vales de gasolina", label: "Vale de gasolina autorizado", defaults: DR },
];

// suppress unused warnings for palettes not currently referenced
void ALL; void DAS;

export const MODULOS_NOTIF_ORDEN = Array.from(
  new Set(CATALOGO_NOTIFICACIONES.map((n) => n.modulo)),
);
