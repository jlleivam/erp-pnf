export type RequisicionEstatus =
  | "borrador"
  | "enviada"
  | "en_cotizacion"
  | "pendiente_autorizacion"
  | "oc_generada"
  | "completada"
  | "rechazada";

export const ESTATUS_META: Record<RequisicionEstatus, { label: string; badge: string }> = {
  borrador: { label: "Borrador", badge: "bg-slate-100 text-slate-700" },
  enviada: { label: "Enviada", badge: "bg-gray-200 text-gray-800" },
  en_cotizacion: { label: "En cotización", badge: "bg-amber-100 text-amber-800" },
  pendiente_autorizacion: { label: "Pendiente autorización", badge: "bg-purple-100 text-purple-800" },
  oc_generada: { label: "OC generada", badge: "bg-blue-100 text-blue-800" },
  completada: { label: "Completada", badge: "bg-emerald-100 text-emerald-800" },
  rechazada: { label: "Rechazada", badge: "bg-rose-100 text-rose-800" },
};

export const TIMELINE_STEPS: Array<{
  key: "enviada" | "en_cotizacion" | "pendiente_autorizacion" | "oc_generada" | "completada";
  label: string;
  atField: string;
  porField: string | null;
}> = [
  { key: "enviada", label: "Requisición enviada", atField: "enviada_at", porField: "solicitante" },
  { key: "en_cotizacion", label: "En cotización", atField: "cotizacion_at", porField: "cotizacion_responsable" },
  { key: "pendiente_autorizacion", label: "Pendiente de autorización", atField: "autorizacion_at", porField: "autorizacion_responsable" },
  { key: "oc_generada", label: "Orden de compra generada", atField: "oc_at", porField: "oc_responsable" },
  { key: "completada", label: "Material recibido en obra", atField: "completada_at", porField: "completada_responsable" },
];
