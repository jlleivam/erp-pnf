export function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function buildMapsHref(ubicacion: string | null | undefined): string | null {
  if (!ubicacion) return null;
  const v = ubicacion.trim();
  if (!v) return null;
  return isUrl(v)
    ? v
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
}

export function ubicacionDisplayText(ubicacion: string | null | undefined): string {
  if (!ubicacion) return "";
  const v = ubicacion.trim();
  return isUrl(v) ? "Ver en Google Maps" : v;
}
