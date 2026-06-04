import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getObraDashboard } from "@/lib/api/obras.functions";
import {
  getEstadoResultadosSemana,
  getEstadoResultadosAcumulado,
  getObraSemanaBoundaries,
} from "@/lib/api/estado-resultados.functions";
import { numeroSemanaObra, rangoSemanaObra } from "@/lib/estimacion-utils";
import {
  listMisTareasObra,
  actualizarTareaEstatus,
} from "@/lib/api/tareas.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MapPin,
  Copy,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus,
  ListTodo,
} from "lucide-react";
import { formatMXN, formatDate } from "@/lib/format";
import { buildMapsHref, ubicacionDisplayText } from "@/lib/ubicacion";
import { NuevaTareaDialog } from "@/components/tareas/NuevaTareaDialog";


const ROLE_LABELS: Record<string, string> = {
  director: "Director",
  residente: "Residente",
  auxiliar: "Auxiliar",
  administrativo: "Administrativo",
  supervisor: "Supervisor",
};

export const Route = createFileRoute("/_authenticated/app/obras/$obraId/")({
  component: ObraDashboard,
});

// Lunes de la semana actual como YYYY-MM-DD
function lunesSemanaActual(): string {
  const d = new Date();
  const day = d.getDay(); // 0=dom, 1=lun, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function ObraDashboard() {
  const { obraId } = Route.useParams();
  const fetchDashboard = useServerFn(getObraDashboard);
  const fetchSemana = useServerFn(getEstadoResultadosSemana);
  const fetchTareas = useServerFn(listMisTareasObra);

  const fetchAcumulado = useServerFn(getEstadoResultadosAcumulado);
  const fetchBoundaries = useServerFn(getObraSemanaBoundaries);

  const semanaInicio = lunesSemanaActual();

  const dashboard = useQuery({
    queryKey: ["obra-dashboard", obraId],
    queryFn: () => fetchDashboard({ data: { obraId } }),
  });

  const semana = useQuery({
    queryKey: ["obra-semana", obraId, semanaInicio],
    queryFn: () => fetchSemana({ data: { obraId, semanaInicio } }),
  });

  const acumulado = useQuery({
    queryKey: ["obra-acumulado", obraId],
    queryFn: () => fetchAcumulado({ data: { obraId } }),
  });

  const boundaries = useQuery({
    queryKey: ["obra-semana-boundaries", obraId],
    queryFn: () => fetchBoundaries({ data: { obraId } }),
  });

  const tareas = useQuery({
    queryKey: ["mis-tareas-obra", obraId],
    queryFn: () => fetchTareas({ data: { obraId } }),
  });

  if (dashboard.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (dashboard.error || !dashboard.data)
    return <p className="text-sm text-destructive">No se pudo cargar la obra.</p>;

  const { obra, team } = dashboard.data;

  return (
    <div className="space-y-6">
      <ObraHeader obra={obra} team={team} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PanelEstadoResultados
          obraId={obraId}
          inicio={semanaInicio}
          isLoading={semana.isLoading || acumulado.isLoading}
          dataSemana={semana.data}
          dataAcumulado={acumulado.data}
          boundaries={boundaries.data}
        />
        <PanelTareas obraId={obraId} isLoading={tareas.isLoading} tareas={tareas.data ?? []} />
      </div>
    </div>
  );
}

// ============================================================
// Header compacto — info general en 2 líneas
// ============================================================

function ObraHeader({
  obra,
  team,
}: {
  obra: {
    nombre: string;
    unidad_negocio: { id: string; nombre: string } | null;
    numero_contrato: string | null;
    ubicacion: string | null;
    fecha_inicio: string | null;
    fecha_terminacion: string | null;
    cliente: { razon_social: string; rfc: string | null } | null;
  };
  team: Array<{ id: string; role: string; user: { nombre_completo: string } | null }>;
}) {
  const copiarUbicacion = async () => {
    if (!obra.ubicacion) return;
    try {
      await navigator.clipboard.writeText(obra.ubicacion);
      toast.success("Ubicación copiada");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const mapsHref = buildMapsHref(obra.ubicacion);
  const ubicacionTexto = ubicacionDisplayText(obra.ubicacion);

  const initials = (name?: string | null) =>
    (name ?? "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");

  const visibleTeam = team.slice(0, 3);
  const extra = team.length - visibleTeam.length;

  return (
    <header className="border-b border-border pb-4 space-y-2">
      {/* Línea 1: título + cliente + contrato + avatares */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">{obra.nombre}</h1>
          {obra.unidad_negocio && (
            <Badge variant="secondary" className="text-xs">
              {obra.unidad_negocio.nombre}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            · {obra.cliente?.razon_social ?? "Sin cliente"}
            {obra.numero_contrato && ` · ${obra.numero_contrato}`}
          </span>
        </div>

        {team.length > 0 && (
          <div className="flex -space-x-2">
            {visibleTeam.map((m) => (
              <div
                key={m.id}
                title={`${m.user?.nombre_completo ?? "—"} · ${ROLE_LABELS[m.role] ?? m.role}`}
                className="size-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium"
              >
                {initials(m.user?.nombre_completo)}
              </div>
            ))}
            {extra > 0 && (
              <div className="size-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                +{extra}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Línea 2: meta (ubicación + fechas) */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm text-muted-foreground">
        {obra.ubicacion ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            <span>{obra.ubicacion}</span>
            <a
              href={mapsHref!}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir en Google Maps"
              className="hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3.5" />
            </a>
            <button
              onClick={copiarUbicacion}
              title="Copiar ubicación"
              className="hover:text-foreground transition-colors"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> <span>Sin ubicación</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          <span>
            {formatDate(obra.fecha_inicio) || "—"} → {formatDate(obra.fecha_terminacion) || "—"}
          </span>
        </div>
      </div>
    </header>
  );
}

// ============================================================
// Panel 2 — Estado de resultados (semana actual)
// ============================================================

type ResultadoData = {
  semana_inicio?: string;
  semana_fin?: string;
  produccion: number;
  costos_total: number;
  resultado: number;
  margen: number;
};

function PanelEstadoResultados({
  obraId,
  inicio,
  isLoading,
  dataSemana,
  dataAcumulado,
  boundaries,
}: {
  obraId: string;
  inicio: string;
  isLoading: boolean;
  dataSemana: ResultadoData | undefined;
  dataAcumulado: ResultadoData | undefined;
  boundaries: { fechaInicio: string; primerSemana: string; semanaActual: string } | undefined;
}) {
  const numSemana = boundaries ? numeroSemanaObra(boundaries.fechaInicio, inicio) : null;

  const rangoSemana = boundaries
    ? rangoSemanaObra(boundaries.fechaInicio, inicio)
    : new Date(inicio).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  const subSemana = numSemana ? `Semana ${numSemana} · ${rangoSemana}` : rangoSemana;
  const subGlobal = "Desde inicio · hoy";

  return (
    <Card className="p-4 space-y-4 flex flex-col">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <TrendingUp className="size-3.5" />
        Resultado
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 flex-1">
        <Link
          to="/app/obras/$obraId/$"
          params={{ obraId, _splat: "estado-resultados" }}
          hash="semana"
          className="rounded-md p-2 -m-2 hover:bg-muted/50 transition-colors"
        >
          <ResultadoColumna
            titulo="Semana"
            subtitulo={subSemana}
            isLoading={isLoading}
            data={dataSemana}
          />
        </Link>
        <Link
          to="/app/obras/$obraId/$"
          params={{ obraId, _splat: "estado-resultados" }}
          hash="global"
          className="rounded-md p-2 -m-2 hover:bg-muted/50 transition-colors sm:border-l sm:border-border sm:pl-4 border-t border-border pt-4 sm:border-t-0 mt-4 sm:mt-0"
        >
          <ResultadoColumna
            titulo="Global"
            subtitulo={subGlobal}
            isLoading={isLoading}
            data={dataAcumulado}
          />
        </Link>
      </div>
    </Card>
  );
}

function ResultadoColumna({
  titulo,
  subtitulo,
  isLoading,
  data,
}: {
  titulo: string;
  subtitulo: string;
  isLoading: boolean;
  data: ResultadoData | undefined;
}) {
  const positivo = (data?.resultado ?? 0) >= 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium">{titulo}</p>
        <p className="text-[11px] text-muted-foreground">{subtitulo}</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-7 w-28" />
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs text-muted-foreground">Producción</p>
            <p className="text-base font-semibold">{formatMXN(data?.produccion ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gasto</p>
            <p className="text-base font-semibold">{formatMXN(data?.costos_total ?? 0)}</p>
          </div>
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {positivo ? (
                <TrendingUp className="size-3 text-emerald-600" />
              ) : (
                <TrendingDown className="size-3 text-destructive" />
              )}
              {positivo ? "Utilidad" : "Pérdida"}
            </p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p
                className={`text-xl font-bold ${
                  positivo ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {formatMXN(data?.resultado ?? 0)}
              </p>
              <Badge variant={positivo ? "default" : "destructive"} className="text-xs">
                {((data?.margen ?? 0) * 100).toFixed(1)}%
              </Badge>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Panel 3 — Mis tareas pendientes
// ============================================================

function PanelTareas({
  obraId,
  isLoading,
  tareas,
}: {
  obraId: string;
  isLoading: boolean;
  tareas: Array<{
    id: string;
    titulo: string;
    fecha_limite: string | null;
    estatus: string;
  }>;
}) {
  const [openNueva, setOpenNueva] = useState(false);
  const qc = useQueryClient();
  const actualizar = useServerFn(actualizarTareaEstatus);

  const mEstatus = useMutation({
    mutationFn: (vars: { id: string; estatus: "completada" | "pendiente" }) =>
      actualizar({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mis-tareas-obra", obraId] });
      qc.invalidateQueries({ queryKey: ["tareas-obra", obraId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <Card className="p-4 space-y-4 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <ListTodo className="size-3.5" /> Mis tareas pendientes
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpenNueva(true)}>
          <Plus className="size-3.5" /> Nueva
        </Button>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tareas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No tienes tareas pendientes en esta obra.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tareas.map((t) => (
              <TareaRow
                key={t.id}
                tarea={t}
                onToggle={(checked) =>
                  mEstatus.mutate({ id: t.id, estatus: checked ? "completada" : "pendiente" })
                }
              />
            ))}
          </ul>
        )}
      </div>

      <Button asChild variant="outline" size="sm" className="w-full">
        <Link to="/app/obras/$obraId/$" params={{ obraId, _splat: "tareas" }}>
          Ver todas <ArrowRight className="size-3.5" />
        </Link>
      </Button>

      <NuevaTareaDialog obraId={obraId} open={openNueva} onOpenChange={setOpenNueva} />
    </Card>
  );
}

function TareaRow({
  tarea,
  onToggle,
}: {
  tarea: { id: string; titulo: string; fecha_limite: string | null };
  onToggle: (checked: boolean) => void;
}) {
  let urgencyClass = "text-muted-foreground";
  if (tarea.fecha_limite) {
    const ms = new Date(tarea.fecha_limite).getTime() - Date.now();
    const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (dias < 0) urgencyClass = "text-destructive font-medium";
    else if (dias <= 3) urgencyClass = "text-amber-600 dark:text-amber-400";
  }

  return (
    <li className="py-2 flex items-center gap-3">
      <Checkbox onCheckedChange={(v) => onToggle(Boolean(v))} />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{tarea.titulo}</p>
        {tarea.fecha_limite && (
          <p className={`text-xs ${urgencyClass}`}>{formatDate(tarea.fecha_limite)}</p>
        )}
      </div>
    </li>
  );
}
