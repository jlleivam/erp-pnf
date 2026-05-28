import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getObraDashboard } from "@/lib/api/obras.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, FileText, Users, Construction } from "lucide-react";

const TIPO_LABELS: Record<string, string> = {
  industrial: "Industrial",
  comercial: "Comercial",
  residencial: "Residencial",
  infraestructura: "Infraestructura",
  vivienda_serie: "Vivienda en serie",
  urbanizacion: "Urbanización",
};

const ROLE_LABELS: Record<string, string> = {
  director: "Director",
  residente: "Residente",
  auxiliar: "Auxiliar",
  administrativo: "Administrativo",
  supervisor: "Supervisor",
};

const MODULES = [
  { to: "estimaciones", label: "Estimaciones" },
  { to: "ordenes-cambio", label: "Órdenes de cambio" },
  { to: "requisiciones", label: "Requisiciones" },
  { to: "nomina", label: "Nómina" },
  { to: "destajos", label: "Destajos" },
  { to: "subcontratos", label: "Subcontratos" },
  { to: "rentas", label: "Rentas" },
  { to: "gasolinas", label: "Gasolinas" },
  { to: "caja-chica", label: "Caja chica" },
  { to: "almacen-obra", label: "Almacén de obra" },
  { to: "tareas", label: "Tareas" },
  { to: "catalogos", label: "Catálogos" },
];

export const Route = createFileRoute("/_authenticated/app/obras/$obraId/")({
  component: ObraDashboard,
});

function ObraDashboard() {
  const { obraId } = Route.useParams();
  const fetchDashboard = useServerFn(getObraDashboard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["obra-dashboard", obraId],
    queryFn: () => fetchDashboard({ data: { obraId } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (error || !data) return <p className="text-sm text-destructive">No se pudo cargar la obra.</p>;

  const { obra, team } = data;

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">{obra.nombre}</h1>
          <Badge variant="secondary">{TIPO_LABELS[obra.tipo_obra] ?? obra.tipo_obra}</Badge>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
            <Users className="size-3.5" /> Cliente
          </div>
          <p className="font-medium">{obra.cliente?.razon_social ?? "Sin cliente"}</p>
          {obra.cliente?.rfc && (
            <p className="text-sm text-muted-foreground mt-1">{obra.cliente.rfc}</p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
            <FileText className="size-3.5" /> Contrato
          </div>
          <p className="font-medium">{obra.numero_contrato ?? "—"}</p>
          {obra.ubicacion && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="size-3" /> {obra.ubicacion}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
            <Calendar className="size-3.5" /> Fechas
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">Inicio:</span> {fmtDate(obra.fecha_inicio)}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Terminación:</span> {fmtDate(obra.fecha_terminacion)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-3">
          <Users className="size-3.5" /> Equipo asignado
        </div>
        {team.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin equipo asignado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {team.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{m.user?.nombre_completo ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{m.user?.email ?? ""}</p>
                </div>
                <Badge variant="outline">{ROLE_LABELS[m.role] ?? m.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Métricas placeholder */}
      <div className="grid gap-4 sm:grid-cols-3">
        {["Avance físico", "Presupuesto ejercido", "Caja chica"].map((m) => (
          <Card key={m} className="p-4 border-dashed">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{m}</p>
            <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
              <Construction className="size-3.5" /> Próximamente
            </p>
          </Card>
        ))}
      </div>

      {/* Módulos */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Módulos de la obra
        </h2>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((mod) => (
            <Link
              key={mod.to}
              to="/app/obras/$obraId/$"
              params={{ obraId, _splat: mod.to }}
              className="rounded-md border border-border bg-card hover:border-primary/40 transition-colors p-3 text-sm"
            >
              {mod.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
