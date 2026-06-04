import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listObras } from "@/lib/api/obras.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, HardHat } from "lucide-react";
import { useEffectiveIsDirector } from "@/stores/auth";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const fetchObras = useServerFn(listObras);
  const { data: obras, isLoading } = useQuery({
    queryKey: ["obras"],
    queryFn: () => fetchObras(),
  });
  const director = useEffectiveIsDirector();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Obras</h1>
            <p className="text-sm text-muted-foreground">Selecciona una obra para abrir sus módulos.</p>
          </div>
          {director && (
            <Button asChild>
              <Link to="/app/obras/nueva">
                <Plus className="size-4 mr-1" /> Nueva obra
              </Link>
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : !obras || obras.length === 0 ? (
          <Card className="p-10 text-center border-dashed">
            <HardHat className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">Aún no hay obras</p>
            <p className="text-sm text-muted-foreground mt-1">
              {director ? "Crea tu primera obra para comenzar." : "Pide al Director que dé de alta una obra."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {obras.map((o) => (
              <Link key={o.id} to="/app/obras/$obraId" params={{ obraId: o.id }}>
                <Card className="p-4 hover:border-primary/40 transition-colors h-full">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-snug">{o.nombre}</h3>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {o.tipo_obra.replace("_", " ")}
                    </Badge>
                  </div>
                  {o.cliente && (
                    <p className="text-sm text-muted-foreground mt-2">{o.cliente.razon_social}</p>
                  )}
                  {o.numero_contrato && (
                    <p className="text-xs text-muted-foreground mt-1">Contrato: {o.numero_contrato}</p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
