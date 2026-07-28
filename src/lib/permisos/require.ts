import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission, overridesFromRows } from "./check";
import type { AppRole } from "@/stores/auth";

/**
 * Enforcement server-side de permisos por rol.
 * - Lee los roles REALES del usuario (ignora rol asumido, que sólo aplica a UI).
 * - Director bypasea sin consultar overrides.
 * - Lanza si el usuario no tiene el permiso.
 */
export async function requirePermission(
  supabase: SupabaseClient,
  userId: string,
  actionKey: string
): Promise<void> {
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!profile?.company_id) throw new Error("Sin empresa asignada");

  const { data: roleRows, error: rErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", profile.company_id);
  if (rErr) throw new Error(rErr.message);
  const roles = (roleRows ?? []).map((r) => r.role as AppRole);

  if (roles.includes("director")) return;

  const { data: permRows, error: qErr } = await supabase
    .from("role_permissions")
    .select("role, action_key, allowed")
    .eq("company_id", profile.company_id);
  if (qErr) throw new Error(qErr.message);
  const overrides = overridesFromRows(permRows ?? []);

  if (!hasPermission(actionKey, roles, overrides)) {
    throw new Error("No tienes permiso para realizar esta acción");
  }
}
