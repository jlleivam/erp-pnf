export type TipoPersona = "moral" | "fisica";
export type TerceroCategoria = "proveedor" | "contratista" | "ambos";
export type TerceroDocTipo =
  | "constancia_fiscal"
  | "opinion_sat"
  | "domicilio_fiscal"
  | "repse";

export const CATEGORIAS: { value: TerceroCategoria; label: string }[] = [
  { value: "proveedor", label: "Proveedor" },
  { value: "contratista", label: "Contratista" },
  { value: "ambos", label: "Ambos" },
];

export const CATEGORIA_LABEL: Record<TerceroCategoria, string> = {
  proveedor: "Proveedor",
  contratista: "Contratista",
  ambos: "Ambos",
};

export const CATEGORIA_BADGE: Record<TerceroCategoria, string> = {
  proveedor: "bg-blue-600 text-white hover:bg-blue-600",
  contratista: "bg-teal-600 text-white hover:bg-teal-600",
  ambos: "bg-slate-700 text-white hover:bg-slate-700",
};

export const DOC_LABEL: Record<TerceroDocTipo, string> = {
  constancia_fiscal: "Constancia de Situación Fiscal",
  opinion_sat: "Opinión de cumplimiento SAT",
  domicilio_fiscal: "Comprobante de domicilio fiscal",
  repse: "REPSE",
};

export const DOC_CON_VENCIMIENTO: Record<TerceroDocTipo, boolean> = {
  constancia_fiscal: true,
  opinion_sat: true,
  domicilio_fiscal: false,
  repse: true,
};

export const REGIMENES_MORAL = [
  "601 — General de Ley Personas Morales",
  "603 — Personas Morales con Fines no Lucrativos",
  "620 — Sociedades Cooperativas de Producción",
  "622 — Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras",
  "623 — Opcional para Grupos de Sociedades",
  "626 — Régimen Simplificado de Confianza (RESICO)",
];

export const REGIMENES_FISICA = [
  "605 — Sueldos y Salarios e Ingresos Asimilados",
  "606 — Arrendamiento",
  "607 — Régimen de Enajenación o Adquisición de Bienes",
  "608 — Demás Ingresos",
  "612 — Personas Físicas con Actividades Empresariales y Profesionales",
  "616 — Sin Obligaciones Fiscales",
  "621 — Incorporación Fiscal",
  "626 — Régimen Simplificado de Confianza (RESICO)",
];

export type TerceroDocumento = {
  id: string;
  tipo: TerceroDocTipo;
  url: string;
  fecha_vencimiento: string | null;
  created_at: string;
};

export type TerceroListRow = {
  id: string;
  razon_social: string;
  nombre_comercial: string | null;
  rfc: string;
  tipo_persona: TipoPersona;
  categoria: TerceroCategoria;
  dias_credito: number | null;
  documentos: TerceroDocumento[];
};

export type Tercero = {
  id: string;
  company_id: string;
  tipo_persona: TipoPersona;
  razon_social: string;
  nombre_comercial: string | null;
  rfc: string;
  curp: string | null;
  regimen_fiscal: string | null;
  direccion_fiscal: string | null;
  calle: string | null;
  numero_exterior: string | null;
  numero_interior: string | null;
  colonia: string | null;
  municipio: string | null;
  estado: string | null;
  codigo_postal: string | null;
  telefono: string | null;
  correo: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  categoria: TerceroCategoria;
  categoria_productos: string | null;
  credito_disponible: number | null;
  dias_credito: number | null;
  requiere_factura: boolean;
  banco: string | null;
  clabe: string | null;
  beneficiario: string | null;
  retencion_iva: boolean;
  retencion_iva_pct: number | null;
  retencion_isr: boolean;
  retencion_isr_pct: number | null;
  tipo_trabajos: string | null;
  fondo_garantia: boolean;
  fondo_garantia_pct: number | null;
  created_at: string;
};
