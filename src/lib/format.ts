export function formatMXN(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(n));
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    const fecha = dt.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const hora = dt.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${fecha}, ${hora}`;
  } catch {
    return d;
  }
}

export type EstadoDoc = "ok" | "por_vencer" | "vencido" | "sin_documento";

export function estadoVencimiento(
  fecha: string | null | undefined,
  url?: string | null | undefined,
): EstadoDoc {
  if (!fecha && !url) return "sin_documento";
  if (!fecha) return "sin_documento";
  const ms = new Date(fecha).getTime();
  if (isNaN(ms)) return "sin_documento";
  const now = Date.now();
  const dias = Math.floor((ms - now) / (1000 * 60 * 60 * 24));
  if (dias < 0) return "vencido";
  if (dias <= 30) return "por_vencer";
  return "ok";
}
