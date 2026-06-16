// Catálogo contable predefinido para constructora.
// Balance gerencial simplificado: cada categoría se deriva en vivo
// de las tablas operativas existentes (sin partida doble).

export type GrupoContable = "activo" | "pasivo" | "capital";
export type SubgrupoContable =
  | "circulante"
  | "fijo"
  | "corto_plazo"
  | "largo_plazo"
  | "capital";

export type CategoriaContable = {
  codigo: string;
  nombre: string;
  grupo: GrupoContable;
  subgrupo: SubgrupoContable;
  descripcion: string;
  /** Indica si el cálculo está implementado en v1 */
  disponible: boolean;
  /** Ruta sugerida para drill-down (módulo origen) */
  linkModulo?: string;
};

export const CATALOGO_CONTABLE: CategoriaContable[] = [
  // ===== ACTIVO CIRCULANTE =====
  {
    codigo: "1100",
    nombre: "Bancos",
    grupo: "activo",
    subgrupo: "circulante",
    descripcion: "Saldo actual de cuentas bancarias.",
    disponible: true,
    linkModulo: "/app/admin/tesoreria",
  },
  {
    codigo: "1110",
    nombre: "Caja fuerte",
    grupo: "activo",
    subgrupo: "circulante",
    descripcion: "Efectivo resguardado en caja fuerte de la empresa.",
    disponible: true,
    linkModulo: "/app/admin/tesoreria",
  },
  {
    codigo: "1120",
    nombre: "Caja chica",
    grupo: "activo",
    subgrupo: "circulante",
    descripcion: "Fondos entregados a residentes para gastos menores.",
    disponible: true,
    linkModulo: "/app/admin/caja-chica",
  },
  {
    codigo: "1200",
    nombre: "Anticipos a proveedores",
    grupo: "activo",
    subgrupo: "circulante",
    descripcion: "Anticipos pagados a proveedores aún no amortizados.",
    disponible: false,
  },
  {
    codigo: "1210",
    nombre: "Anticipos a destajistas",
    grupo: "activo",
    subgrupo: "circulante",
    descripcion: "Anticipos pagados a destajistas pendientes de amortizar en estimaciones.",
    disponible: true,
  },
  {
    codigo: "1220",
    nombre: "Anticipos a subcontratistas",
    grupo: "activo",
    subgrupo: "circulante",
    descripcion: "Anticipos pagados a subcontratistas pendientes de amortizar.",
    disponible: false,
  },
  {
    codigo: "1300",
    nombre: "Obras en proceso",
    grupo: "activo",
    subgrupo: "circulante",
    descripcion: "Costo acumulado de obras activas no facturado al cliente.",
    disponible: false,
  },
  {
    codigo: "1400",
    nombre: "Almacén",
    grupo: "activo",
    subgrupo: "circulante",
    descripcion: "Valor del inventario en almacén central y de obra.",
    disponible: false,
  },

  // ===== PASIVO CORTO PLAZO =====
  {
    codigo: "2100",
    nombre: "Proveedores por pagar",
    grupo: "pasivo",
    subgrupo: "corto_plazo",
    descripcion: "Órdenes de compra autorizadas pendientes de pago total.",
    disponible: true,
    linkModulo: "/app/admin/cuentas-por-pagar",
  },
  {
    codigo: "2110",
    nombre: "Destajistas por pagar",
    grupo: "pasivo",
    subgrupo: "corto_plazo",
    descripcion: "Estimaciones de destajo cerradas pendientes de pago.",
    disponible: true,
  },
  {
    codigo: "2120",
    nombre: "Subcontratistas por pagar",
    grupo: "pasivo",
    subgrupo: "corto_plazo",
    descripcion: "Estimaciones de subcontrato cerradas pendientes de pago.",
    disponible: true,
  },
  {
    codigo: "2130",
    nombre: "Nómina por pagar",
    grupo: "pasivo",
    subgrupo: "corto_plazo",
    descripcion: "Nóminas cerradas pendientes de pago.",
    disponible: true,
  },
  {
    codigo: "2140",
    nombre: "Rentas por pagar",
    grupo: "pasivo",
    subgrupo: "corto_plazo",
    descripcion: "Pagos de renta de maquinaria pendientes.",
    disponible: false,
  },
  {
    codigo: "2150",
    nombre: "Vales de gasolina por reembolsar",
    grupo: "pasivo",
    subgrupo: "corto_plazo",
    descripcion: "Vales de gasolina autorizados sin reembolsar.",
    disponible: true,
  },
  {
    codigo: "2160",
    nombre: "Caja chica por reembolsar",
    grupo: "pasivo",
    subgrupo: "corto_plazo",
    descripcion: "Reembolsos de caja chica aprobados pendientes de reponer.",
    disponible: true,
  },
  {
    codigo: "2170",
    nombre: "Cuentas por pagar - Caja chica",
    grupo: "pasivo",
    subgrupo: "corto_plazo",
    descripcion: "Fondos de caja chica autorizados pendientes de entregar al residente.",
    disponible: true,
  },

  // ===== CAPITAL =====
  {
    codigo: "3100",
    nombre: "Capital social",
    grupo: "capital",
    subgrupo: "capital",
    descripcion: "Aportación inicial de los socios. Configurable por el director.",
    disponible: true,
    linkModulo: "/app/configuracion",
  },
  {
    codigo: "3200",
    nombre: "Resultado del ejercicio",
    grupo: "capital",
    subgrupo: "capital",
    descripcion:
      "Cuadre del balance: Activo − Pasivo − Capital social. En esta fase es una aproximación al resultado acumulado.",
    disponible: true,
  },
];

export const GRUPO_LABELS: Record<GrupoContable, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  capital: "Capital",
};

export const SUBGRUPO_LABELS: Record<SubgrupoContable, string> = {
  circulante: "Circulante",
  fijo: "Fijo",
  corto_plazo: "Corto plazo",
  largo_plazo: "Largo plazo",
  capital: "Capital contable",
};
