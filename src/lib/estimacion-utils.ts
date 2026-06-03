// Utilidades para estimaciones semanales (cliente y servidor).

/**
 * Dada una fecha cualquiera, devuelve el rango de la semana ISO (lunes a domingo)
 * que la contiene, como strings YYYY-MM-DD.
 */
export function calcularSemana(date: Date | string): { inicio: string; fin: string } {
  const d = typeof date === "string" ? new Date(date + "T12:00:00") : new Date(date);
  // getDay(): 0=Dom, 1=Lun, ... 6=Sab. Queremos lunes como inicio.
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + diffToMon);
  lunes.setHours(0, 0, 0, 0);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return { inicio: toISODate(lunes), fin: toISODate(domingo) };
}

export function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatRangoSemana(inicio: string, fin: string): string {
  const i = new Date(inicio + "T12:00:00");
  const f = new Date(fin + "T12:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  return `${fmt(i)} – ${fmt(f)} ${f.getFullYear()}`;
}

/**
 * Número de semana 1-based relativo a la fecha de inicio de la obra.
 * La primera semana ISO (lunes-domingo) que contiene `fechaInicioObra` es la semana 1.
 */
export function numeroSemanaObra(
  fechaInicioObra: string,
  semanaInicio: string,
): number {
  const primer = calcularSemana(fechaInicioObra).inicio;
  const a = new Date(primer + "T12:00:00").getTime();
  const b = new Date(semanaInicio + "T12:00:00").getTime();
  const diffDias = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDias / 7) + 1;
}

/**
 * Rango legible de una semana. Para la semana 1, inicia en `fechaInicioObra`
 * (puede ser parcial, p.ej. jueves-domingo). Para el resto, lunes-domingo completo.
 */
export function rangoSemanaObra(
  fechaInicioObra: string,
  semanaInicio: string,
): string {
  const { inicio, fin } = calcularSemana(semanaInicio);
  const esPrimera = numeroSemanaObra(fechaInicioObra, semanaInicio) === 1;
  const inicioReal = esPrimera && fechaInicioObra > inicio ? fechaInicioObra : inicio;
  return formatRangoSemana(inicioReal, fin);
}

export type EstimacionRenglonInput = {
  renglon_clave: string;
  cantidad_ejecutada: number;
};
