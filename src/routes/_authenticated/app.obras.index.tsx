import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listObras } from "@/lib/api/obras.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, HardHat } from "lucide-react";
import { usePermisos } from "@/hooks/usePermisos";
import { PendientesBadge } from "@/components/PendientesBadge";
import { useTotalPendientesObra } from "@/hooks/usePendientes";

export const Route = createFileRoute("/_authenticated/app/obras/")({
  component: ObrasPage,
});

function ObrasPage() {
  const fetchObras = useServerFn(listObras);
  const { data: obras, isLoading } = useQuery({
    queryKey: ["obras"],
    queryFn: () => fetchObras(),
  });
  const { can } = usePermisos();
  const puedeCrearObra = can("obras.crear");

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Obras</h1>
            <p className="text-sm text-muted-foreground">Selecciona una obra para abrir sus módulos.</p>
          </div>
          {puedeCrearObra && (
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
              {puedeCrearObra ? "Crea tu primera obra para comenzar." : "Pide al Director o Administrativo que dé de alta una obra."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {obras.map((o) => (
              <ObraCard key={o.id} obra={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ObraCard({ obra: o }: { obra: any }) {
  const total = useTotalPendientesObra(o.id);
  return (
    <Link to="/app/obras/$obraId" params={{ obraId: o.id }}>
      <Card className="p-4 hover:border-primary/40 transition-colors h-full relative">
        {total > 0 && (
          <PendientesBadge count={total} className="absolute top-2 right-2" />
        )}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-snug pr-6">{o.nombre}</h3>
          {o.unidad_negocio && (
            <Badge variant="secondary" className="text-xs">
              {o.unidad_negocio.nombre}
            </Badge>
          )}
        </div>
        {o.cliente && (
          <p className="text-sm text-muted-foreground mt-2">{o.cliente.razon_social}</p>
        )}
        {o.numero_contrato && (
          <p className="text-xs text-muted-foreground mt-1">Contrato: {o.numero_contrato}</p>
        )}
      </Card>
    </Link>
  );
}
