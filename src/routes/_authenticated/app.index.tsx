import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listObras } from "@/lib/api/obras.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, HardHat, Construction } from "lucide-react";
import { useEffectiveRoles, useEffectiveIsDirector } from "@/stores/auth";
import { ADMIN_MODULES, CONFIG_MODULES, type ModuleEntry } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const fetchObras = useServerFn(listObras);
  const { data: obras, isLoading } = useQuery({
    queryKey: ["obras"],
    queryFn: () => fetchObras(),
  });
  const roles = useEffectiveRoles();
  const director = useEffectiveIsDirector();
  const showAdmin = director || roles.includes("administrativo");

  return (
    <div className="space-y-10">
      {/* Obras */}
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

      {showAdmin && (
        <ModuleSection
          title="Administración"
          description="Módulos administrativos a nivel empresa."
          modules={ADMIN_MODULES}
        />
      )}

      {director && (
        <ModuleSection
          title="Configuración"
          description="Datos de la empresa y opciones generales."
          modules={CONFIG_MODULES}
        />
      )}
    </div>
  );
}

function ModuleSection({
  title,
  description,
  modules,
}: {
  title: string;
  description: string;
  modules: ModuleEntry[];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={`${m.to}-${m.label}`}
              to={m.to}
              className="group rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="size-9 rounded-md bg-muted grid place-items-center text-muted-foreground group-hover:text-foreground transition-colors">
                  <Icon className="size-4" />
                </div>
                {!m.ready && (
                  <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                    <Construction className="size-2.5" /> Pronto
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium leading-snug">{m.label}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
