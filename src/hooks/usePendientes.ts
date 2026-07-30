import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPendientes, type PendientesResult } from "@/lib/api/pendientes.functions";
import { supabase } from "@/integrations/supabase/client";

const PENDIENTES_KEY = ["pendientes"] as const;

const REALTIME_TABLES = [
  "requisiciones",
  "cuentas_por_pagar",
  "obra_nominas",
  "caja_chica_fondos",
  "caja_chica_reembolsos",
  "caja_chica_gastos",
  "vales_gasolina",
  "gastos_oficina",
  "obra_rentas",
  "ordenes_compra",
  "obra_tareas",
  "obra_presupuestos",
  "obra_estimaciones",
  "obra_destajos",
  "obra_subcontratos",
  "obra_gastos_directos",
] as const;

export function usePendientes() {
  const fetchFn = useServerFn(getPendientes);
  return useQuery({
    queryKey: PENDIENTES_KEY,
    queryFn: () => fetchFn() as Promise<PendientesResult>,
    staleTime: Infinity,
    refetchOnWindowFocus: true,
  });
}

/**
 * Se monta UNA sola vez (en AppShell). Suscribe un canal Realtime a todas las
 * tablas que alimentan los badges e invalida la query cuando llega cualquier
 * cambio (con debounce para agrupar ráfagas).
 */
export function usePendientesRealtime() {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const invalidate = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: PENDIENTES_KEY });
      }, 300);
    };

    let channel = supabase.channel("pendientes-badges");
    for (const table of REALTIME_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        invalidate,
      );
    }
    channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [qc]);
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
