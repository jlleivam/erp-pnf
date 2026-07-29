import type { AppRole } from "@/stores/auth";

export type PermRole = Exclude<AppRole, "director">;

export interface AccionCatalogo {
  key: string;
  modulo: string;
  label: string;
  descripcion?: string;
  defaults: Record<PermRole, boolean>;
}

const T = { residente: true, auxiliar: false, administrativo: false, supervisor: false };
const S = { residente: false, auxiliar: false, administrativo: false, supervisor: true };
const A = { residente: false, auxiliar: false, administrativo: true, supervisor: false };
const AS = { residente: false, auxiliar: false, administrativo: true, supervisor: true };
const ALL = { residente: true, auxiliar: true, administrativo: true, supervisor: true };
const NONE = { residente: false, auxiliar: false, administrativo: false, supervisor: false };

export const CATALOGO_ACCIONES: AccionCatalogo[] = [
  // Obras
  { key: "obras.crear", modulo: "Obras", label: "Crear obra", defaults: A },
  { key: "obras.editar", modulo: "Obras", label: "Editar obra", defaults: A },
  { key: "obras.eliminar", modulo: "Obras", label: "Eliminar obra", defaults: NONE },
  { key: "obras.asignar_team", modulo: "Obras", label: "Asignar equipo a obra", defaults: A },
  // Presupuestos
  { key: "presupuestos.crear_base", modulo: "Presupuestos", label: "Crear/editar presupuesto base", defaults: NONE },
  
  { key: "presupuestos.autorizar_base", modulo: "Presupuestos", label: "Autorizar/rechazar presupuesto base", defaults: NONE },
  { key: "presupuestos.eliminar_base", modulo: "Presupuestos", label: "Eliminar presupuesto base", defaults: NONE },
  { key: "presupuestos.crear_oc", modulo: "Presupuestos", label: "Crear/editar orden de cambio", defaults: T },
  { key: "presupuestos.enviar_oc", modulo: "Presupuestos", label: "Enviar orden de cambio a autorización", defaults: T },
  { key: "presupuestos.autorizar_oc", modulo: "Presupuestos", label: "Autorizar/rechazar orden de cambio", defaults: S },
  { key: "presupuestos.eliminar_oc", modulo: "Presupuestos", label: "Eliminar orden de cambio", defaults: T },


  // Requisiciones
  { key: "requisiciones.crear", modulo: "Requisiciones", label: "Crear requisición", defaults: { ...T, supervisor: true } },
  { key: "requisiciones.aprobar", modulo: "Requisiciones", label: "Aprobar requisición", defaults: S },
  { key: "requisiciones.rechazar", modulo: "Requisiciones", label: "Rechazar requisición", defaults: S },
  { key: "requisiciones.ver_oc", modulo: "Requisiciones", label: "Ver órdenes de compra generadas", defaults: AS },

  // Cotizaciones
  { key: "cotizaciones.gestionar", modulo: "Cotizaciones", label: "Gestionar cotizaciones (SC, capturar respuestas, paquetes)", defaults: A },

  // Órdenes de compra
  { key: "oc.crear", modulo: "Órdenes de compra", label: "Crear y enviar orden de compra", defaults: A },
  { key: "oc.autorizar", modulo: "Órdenes de compra", label: "Autorizar orden de compra", defaults: S },
  { key: "oc.cancelar", modulo: "Órdenes de compra", label: "Rechazar / cancelar / reabrir orden de compra", defaults: AS },

  // Almacén
  { key: "almacen.recibir", modulo: "Almacén", label: "Recibir material", defaults: T },
  { key: "almacen.cerrar_semana", modulo: "Almacén", label: "Cerrar semana de almacén", defaults: T },
  { key: "almacen.desbloquear_semana", modulo: "Almacén", label: "Autorizar desbloqueo de semana", defaults: A },

  // Caja chica
  { key: "caja_chica.solicitar_fondo", modulo: "Caja chica", label: "Solicitar fondo", defaults: T },
  { key: "caja_chica.autorizar_fondo", modulo: "Caja chica", label: "Autorizar fondo", defaults: A },
  { key: "caja_chica.registrar_gasto", modulo: "Caja chica", label: "Registrar gasto", defaults: T },
  { key: "caja_chica.aprobar_gasto", modulo: "Caja chica", label: "Aprobar gasto (supervisor)", defaults: S },
  { key: "caja_chica.solicitar_reembolso", modulo: "Caja chica", label: "Solicitar reembolso semanal", defaults: T },
  { key: "caja_chica.autorizar_reembolso", modulo: "Caja chica", label: "Autorizar reembolso", defaults: A },
  { key: "caja_chica.reclasificar_comprobante", modulo: "Caja chica", label: "Reclasificar comprobante", defaults: A },

  // Cuentas por pagar / Pagos
  { key: "cxp.ver", modulo: "Cuentas por pagar", label: "Ver cuentas por pagar", defaults: AS },
  { key: "cxp.registrar_pago", modulo: "Cuentas por pagar", label: "Registrar pago", defaults: A },
  { key: "cxp.cancelar_pago", modulo: "Cuentas por pagar", label: "Cancelar pago", defaults: A },

  // Nómina de obra
  { key: "nomina_obra.registrar_asistencia", modulo: "Nómina de obra", label: "Registrar asistencia", defaults: T },
  { key: "nomina_obra.generar", modulo: "Nómina de obra", label: "Generar nómina semanal", defaults: T },
  { key: "nomina_obra.autorizar", modulo: "Nómina de obra", label: "Autorizar nómina", defaults: A },

  // Destajos / Subcontratos
  { key: "destajos.crear", modulo: "Destajos", label: "Crear destajo", defaults: A },
  { key: "destajos.estimar", modulo: "Destajos", label: "Registrar estimación", defaults: T },
  { key: "destajos.autorizar_estimacion", modulo: "Destajos", label: "Autorizar estimación", defaults: S },
  { key: "subcontratos.crear", modulo: "Subcontratos", label: "Crear subcontrato", defaults: A },
  { key: "subcontratos.autorizar_estimacion", modulo: "Subcontratos", label: "Autorizar estimación de subcontrato", defaults: S },

  // Gastos de oficina
  { key: "gastos_oficina.solicitar", modulo: "Gastos de oficina", label: "Solicitar gasto de oficina", defaults: A },
  { key: "gastos_oficina.autorizar", modulo: "Gastos de oficina", label: "Autorizar gasto de oficina", defaults: NONE },
  { key: "gastos_oficina.gestionar_personal", modulo: "Gastos de oficina", label: "Gestionar personal de oficina", defaults: A },

  // Catálogos
  { key: "catalogos.terceros", modulo: "Catálogos", label: "Editar catálogo de terceros", defaults: A },
  { key: "catalogos.trabajadores", modulo: "Catálogos", label: "Editar catálogo de trabajadores", defaults: A },
  { key: "catalogos.insumos", modulo: "Catálogos", label: "Editar catálogo de insumos", defaults: A },
  { key: "catalogos.clientes", modulo: "Catálogos", label: "Editar catálogo de clientes", defaults: A },

  // Contabilidad
  { key: "contabilidad.ver_balance", modulo: "Contabilidad", label: "Ver balance general", defaults: A },
  { key: "contabilidad.ver_condensado", modulo: "Contabilidad", label: "Ver condensado semanal", defaults: A },
];

// suppress unused
void ALL;

export const MODULOS_ORDEN = Array.from(new Set(CATALOGO_ACCIONES.map((a) => a.modulo)));
