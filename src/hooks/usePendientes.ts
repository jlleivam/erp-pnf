import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPendientes, type PendientesResult } from "@/lib/api/pendientes.functions";

export function usePendientes() {
  const fetchFn = useServerFn(getPendientes);
  return useQuery({
    queryKey: ["pendientes"],
    queryFn: () => fetchFn() as Promise<PendientesResult>,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function usePendientesAdmin() {
  const q = usePendientes();
  return q.data?.admin ?? {};
}

export function usePendientesObra(obraId: string | undefined) {
  const q = usePendientes();
  return useMemo(() => {
    if (!obraId) return {} as Record<string, number>;
    return q.data?.obras?.[obraId] ?? {};
  }, [q.data, obraId]);
}

export function useTotalPendientesObra(obraId: string | undefined) {
  const counts = usePendientesObra(obraId);
  return Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
}

/** Extrae la última parte de una ruta tipo /app/admin/xxx o /app/obras/:id/yyy */
export function moduleKeyFromPath(path: string): string {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
