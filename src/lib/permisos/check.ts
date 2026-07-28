import { CATALOGO_ACCIONES, type PermRole } from "./catalogo";
import type { AppRole } from "@/stores/auth";

export type OverridesMap = Map<string, boolean>; // key: `${role}::${action_key}`

export function overridesFromRows(
  rows: Array<{ role: string; action_key: string; allowed: boolean }>
): OverridesMap {
  const m = new Map<string, boolean>();
  for (const r of rows) m.set(`${r.role}::${r.action_key}`, r.allowed);
  return m;
}

/**
 * ¿Alguno de los `roles` del usuario tiene el permiso `actionKey`?
 * - Director siempre `true`.
 * - Se combina el override de la empresa (si existe) con el default del catálogo.
 * - Unión sobre múltiples roles: alcanza con que UNO tenga el check.
 */
export function hasPermission(
  actionKey: string,
  roles: AppRole[],
  overrides: OverridesMap
): boolean {
  if (roles.includes("director")) return true;
  const accion = CATALOGO_ACCIONES.find((a) => a.key === actionKey);
  if (!accion) return false;
  for (const r of roles) {
    if (r === "director") return true;
    const role = r as PermRole;
    const override = overrides.get(`${role}::${actionKey}`);
    const allowed = override ?? accion.defaults[role];
    if (allowed) return true;
  }
  return false;
}
