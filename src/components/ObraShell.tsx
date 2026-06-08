import { Outlet, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { getObraDashboard } from "@/lib/api/obras.functions";

export function ObraShell() {
  const { obraId } = useParams({ from: "/_authenticated/app/obras/$obraId" });
  const fetchDashboard = useServerFn(getObraDashboard);
  const dashboard = useQuery({
    queryKey: ["obra-dashboard", obraId],
    queryFn: () => fetchDashboard({ data: { obraId } }),
  });
  const obra = dashboard.data?.obra;

  return (
    <div className="min-h-full bg-background flex flex-col">
      <div className="border-b border-border bg-background">
        <div className="max-w-5xl w-full mx-auto px-4 md:px-0 py-3 flex items-center gap-3 min-w-0">
          <Link
            to="/app"
            className="shrink-0 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Volver a obras"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate">
              {obra?.nombre ?? "…"}
            </h1>
            {obra && (obra.cliente?.razon_social || obra.numero_contrato) && (
              <p className="text-xs text-muted-foreground truncate">
                {obra.cliente?.razon_social ?? "Sin cliente"}
                {obra.numero_contrato ? ` · ${obra.numero_contrato}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
      <main className="flex-1 p-4 md:p-0 md:pt-4 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
