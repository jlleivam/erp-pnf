import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/devengar-rentas")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: asientos, error: aErr } = await supabaseAdmin.rpc(
            "devengar_asientos_rentas_activas",
          );
          if (aErr) {
            return new Response(
              JSON.stringify({ ok: false, error: aErr.message }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
          const { data: periodos, error: pErr } = await supabaseAdmin.rpc(
            "generar_periodos_rentas_activas",
          );
          if (pErr) {
            return new Response(
              JSON.stringify({ ok: false, error: pErr.message }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
          return new Response(
            JSON.stringify({
              ok: true,
              asientos_diarios: Number(asientos ?? 0),
              periodos_generados: Number(periodos ?? 0),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({ ok: false, error: e?.message ?? "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
