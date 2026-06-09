import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMiRolEnObra } from "@/lib/api/obra-role.functions";

export function useObraRole(obraId: string | null | undefined) {
  const fetchRole = useServerFn(getMiRolEnObra);
  const q = useQuery({
    queryKey: ["obra-role", obraId],
    queryFn: () => fetchRole({ data: { obraId: obraId as string } }),
    enabled: !!obraId,
  });
  return {
    role: q.data?.role ?? null,
    isResidente: !!q.data?.isResidente,
    isSupervisor: !!q.data?.isSupervisor,
    loading: q.isLoading,
  };
}
