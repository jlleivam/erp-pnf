import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRolePermissions } from "@/lib/api/permisos.functions";
import { hasPermission, overridesFromRows } from "@/lib/permisos/check";
import { useEffectiveRoles, useRealIsDirector } from "@/stores/auth";

/**
 * Fuente de verdad en cliente para permisos por rol.
 * `can(actionKey)` evalúa contra los roles efectivos (respeta rol asumido del director).
 */
export function usePermisos() {
  const listFn = useServerFn(listRolePermissions);
  const roles = useEffectiveRoles();
  const isDirector = useRealIsDirector();

  const q = useQuery({
    queryKey: ["role_permissions"],
    queryFn: () => listFn(),
    staleTime: 5 * 60 * 1000,
  });

  const overrides = useMemo(() => {
    const items = ((q.data as { items?: Array<{ role: string; action_key: string; allowed: boolean }> } | undefined)?.items) ?? [];
    return overridesFromRows(items);
  }, [q.data]);

  const can = useMemo(() => {
    return (actionKey: string) => hasPermission(actionKey, roles, overrides);
  }, [roles, overrides]);

  return { can, isDirector, isLoading: q.isLoading };
}
