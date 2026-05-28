export const IMSS_LABEL: Record<string, string> = {
  alta_activa: "Alta activa",
  sin_alta: "Sin alta",
  en_tramite: "En trámite",
  baja: "Baja",
};

export const IMSS_BADGE: Record<string, string> = {
  alta_activa: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  sin_alta: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  en_tramite: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  baja: "bg-muted text-muted-foreground hover:bg-muted",
};

export const DOCS_LABEL: Record<string, string> = {
  al_dia: "Al día",
  por_vencer: "Por vencer",
  vencido_o_faltante: "Vencido o faltante",
};

export const DOCS_BADGE: Record<string, string> = {
  al_dia: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  por_vencer: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  vencido_o_faltante: "bg-rose-100 text-rose-800 hover:bg-rose-100",
};

export function mascararCurp(curp: string | null | undefined): string {
  if (!curp) return "—";
  if (curp.length < 8) return curp;
  return `${curp.slice(0, 4)}••••••${curp.slice(-4)}`;
}
