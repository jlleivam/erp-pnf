import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrCreateBorrador,
  guardarRenglonesEstimacion,
  cerrarEstimacion,
} from "@/lib/api/estimaciones.functions";
import { calcularSemana, formatRangoSemana } from "@/lib/estimacion-utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMXN } from "@/lib/format";
import { toast } from "sonner";
import { Save, Lock, AlertTriangle, Search } from "lucide-react";


type VigenteRow = {
  clave: string;
  concepto: string;
  unidad: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  importe: number;
  es_grupo: boolean;
  nivel: number;
  origen: "base" | "modificada" | "agregada";
};

export function CapturaEstimacionSheet({
  obraId,
  semanaInicio,
  onClose,
  onSaved,
}: {
  obraId: string;
  semanaInicio: string; // YYYY-MM-DD (lunes)
  onClose: () => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const fetchBorrador = useServerFn(getOrCreateBorrador);
  const q = useQuery({
    queryKey: ["estimacion-borrador", obraId, semanaInicio],
    queryFn: () => fetchBorrador({ data: { obraId, semanaInicio } }),
  });

  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [confirmCierre, setConfirmCierre] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Inicializar cantidades con lo capturado previamente
  if (!initialized && q.data?.capturados) {
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(q.data.capturados)) {
      init[k] = String(v);
    }
    setCantidades(init);
    setInitialized(true);
  }

  const vigente = (q.data?.vigente ?? []) as VigenteRow[];
  const acumuladoPrevio = (q.data?.acumuladoPrevio ?? {}) as Record<string, number>;
  const estimacion = q.data?.estimacion;
  const isCerrada = estimacion?.estatus === "cerrada";
  const semana = calcularSemana(semanaInicio);

  // Calcular validaciones y totales en cliente
  const computed = useMemo(() => {
    let totalSemana = 0;
    let totalAcum = 0;
    let totalVigente = 0;
    const erroresPorClave = new Map<string, string>();
    for (const r of vigente) {
      if (r.es_grupo) continue;
      const cantStr = cantidades[r.clave] ?? "";
      const cant = Number(cantStr || 0);
      const pu = Number(r.precio_unitario ?? 0);
      const cantVig = Number(r.cantidad ?? 0);
      const acumPrev = Number(acumuladoPrevio[r.clave] ?? 0);
      const nuevoAcum = acumPrev + (Number.isFinite(cant) ? cant : 0);
      if (cant > 0) totalSemana += cant * pu;
      totalAcum += nuevoAcum * pu;
      totalVigente += cantVig * pu;
      if (cantVig > 0 && nuevoAcum > cantVig + 0.0001) {
        erroresPorClave.set(
          r.clave,
          `Excede vigente por ${(nuevoAcum - cantVig).toLocaleString("es-MX", {
            maximumFractionDigits: 2,
          })}`,
        );
      }
    }
    return { totalSemana, totalAcum, totalVigente, erroresPorClave };
  }, [vigente, cantidades, acumuladoPrevio]);

  const visibleRows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return vigente;
    return vigente.filter(
      (r) =>
        r.clave.toLowerCase().includes(f) ||
        r.concepto.toLowerCase().includes(f),
    );
  }, [vigente, filter]);

  const guardar = useServerFn(guardarRenglonesEstimacion);
  const guardarM = useMutation({
    mutationFn: guardar,
    onSuccess: () => {
      toast.success("Borrador guardado");
      qc.invalidateQueries({ queryKey: ["estimaciones", obraId] });
      qc.invalidateQueries({ queryKey: ["estimacion-borrador", obraId, semanaInicio] });
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cerrar = useServerFn(cerrarEstimacion);
  const cerrarM = useMutation({
    mutationFn: cerrar,
    onSuccess: () => {
      toast.success("Estimación cerrada");
      qc.invalidateQueries({ queryKey: ["estimaciones", obraId] });
      setConfirmCierre(false);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleGuardar = (cerrarDespues = false) => {
    if (!estimacion) return;
    if (computed.erroresPorClave.size > 0) {
      toast.error("Hay conceptos que exceden el vigente. Corrige antes de guardar.");
      return;
    }
    const renglones = Object.entries(cantidades)
      .map(([k, v]) => ({ renglon_clave: k, cantidad_ejecutada: Number(v || 0) }))
      .filter((r) => Number.isFinite(r.cantidad_ejecutada) && r.cantidad_ejecutada > 0);

    guardarM.mutate(
      { data: { estimacionId: estimacion.id, renglones } },
      {
        onSuccess: () => {
          if (cerrarDespues) {
            if (renglones.length === 0) {
              toast.error("Captura al menos un concepto antes de cerrar");
              return;
            }
            setConfirmCierre(true);
          }
        },
      },
    );
  };

  const pctAvance = computed.totalVigente > 0 ? (computed.totalAcum / computed.totalVigente) * 100 : 0;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-6xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Estimación semanal
            <Badge variant={isCerrada ? "default" : "secondary"}>
              {isCerrada ? "Cerrada" : "Borrador"}
            </Badge>
            <span className="ml-auto text-sm text-muted-foreground">
              {formatRangoSemana(semana.inicio, semana.fin)}
            </span>
          </SheetTitle>
          <SheetDescription>
            Captura la cantidad ejecutada por concepto durante esta semana.
            Los grupos suman automáticamente.
          </SheetDescription>
        </SheetHeader>

        {q.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Cargando…</p>
        ) : !q.data?.hasBase ? (
          <Card className="mt-6 border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay presupuesto base autorizado. No es posible estimar todavía.
          </Card>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mt-6">
              <StatCard label="Producción semana" value={formatMXN(computed.totalSemana)} />
              <StatCard label="Acumulado a la fecha" value={formatMXN(computed.totalAcum)} />
              <StatCard label="Total vigente" value={formatMXN(computed.totalVigente)} />
              <StatCard
                label="% Avance"
                value={`${pctAvance.toFixed(1)}%`}
                tone={pctAvance > 100 ? "destructive" : "default"}
              />
            </div>

            <div className="flex items-center gap-2 mt-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por clave o concepto…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              {computed.erroresPorClave.size > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" /> {computed.erroresPorClave.size} con exceso
                </Badge>
              )}
            </div>

            <TooltipProvider delayDuration={200}>
              <Card className="mt-4 overflow-x-auto">
                <table className="w-full text-xs table-fixed">
                  <colgroup>
                    <col className="w-24" />
                    <col />
                    <col className="w-14" />
                    <col className="w-20" />
                    <col className="w-20" />
                    <col className="w-24" />
                    <col className="w-28" />
                    <col className="w-16" />
                  </colgroup>
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-center px-2 py-1.5">Clave</th>
                      <th className="text-center px-2 py-1.5">Concepto</th>
                      <th className="text-center px-2 py-1.5">Un.</th>
                      <th className="text-center px-2 py-1.5">Cant. vig.</th>
                      <th className="text-center px-2 py-1.5">Acum. previo</th>
                      <th className="text-center px-2 py-1.5">Esta semana</th>
                      <th className="text-center px-2 py-1.5">Importe sem.</th>
                      <th className="text-center px-2 py-1.5">% Acum.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r) => {
                      const cantStr = cantidades[r.clave] ?? "";
                      const cant = Number(cantStr || 0);
                      const pu = Number(r.precio_unitario ?? 0);
                      const acumPrev = Number(acumuladoPrevio[r.clave] ?? 0);
                      const nuevoAcum = acumPrev + (Number.isFinite(cant) ? cant : 0);
                      const cantVig = Number(r.cantidad ?? 0);
                      const err = computed.erroresPorClave.get(r.clave);
                      const pct = cantVig > 0 ? (nuevoAcum / cantVig) * 100 : 0;
                      const importeSem = cant > 0 ? cant * pu : 0;
                      return (
                        <tr
                          key={r.clave}
                          className={`border-t border-border ${r.es_grupo ? "bg-muted/30 font-medium" : ""}`}
                        >
                          <td
                            className="px-2 py-1 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis text-center"
                            style={{ paddingLeft: `${0.5 + (r.nivel - 1) * 1}rem` }}
                          >
                            {r.clave}
                          </td>
                          <td className="px-2 py-1 max-w-0 text-left">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate whitespace-nowrap overflow-hidden text-ellipsis cursor-default text-left">
                                  {r.concepto}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start" className="max-w-md whitespace-normal">
                                {r.concepto}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-2 py-1 text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis text-center">
                            {r.unidad ?? "—"}
                          </td>
                          <td className="px-2 py-1 text-center tabular-nums whitespace-nowrap">
                            {r.es_grupo
                              ? "—"
                              : cantVig.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-2 py-1 text-center tabular-nums text-muted-foreground whitespace-nowrap">
                            {r.es_grupo
                              ? "—"
                              : acumPrev > 0
                                ? acumPrev.toLocaleString("es-MX", { maximumFractionDigits: 2 })
                                : "—"}
                          </td>
                          <td className="px-2 py-1 text-center whitespace-nowrap">
                            {r.es_grupo ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="any"
                                min={0}
                                disabled={isCerrada}
                                value={cantStr}
                                onChange={(e) =>
                                  setCantidades((s) => ({ ...s, [r.clave]: e.target.value }))
                                }
                                className={`h-7 text-xs text-center tabular-nums ${err ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                title={err ?? ""}
                              />
                            )}
                          </td>
                          <td className="px-2 py-1 text-center tabular-nums whitespace-nowrap">
                            {r.es_grupo ? "—" : importeSem > 0 ? formatMXN(importeSem) : "—"}
                          </td>
                          <td
                            className={`px-2 py-1 text-center tabular-nums whitespace-nowrap ${pct > 100 ? "text-destructive font-medium" : ""}`}
                          >
                            {r.es_grupo ? "—" : `${pct.toFixed(0)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </TooltipProvider>


            {!isCerrada && (
              <div className="flex gap-2 mt-4 flex-wrap justify-end sticky bottom-0 bg-background py-3">
                <Button
                  variant="outline"
                  disabled={guardarM.isPending}
                  onClick={() => handleGuardar(false)}
                >
                  <Save className="size-4 mr-1" />
                  {guardarM.isPending ? "Guardando…" : "Guardar borrador"}
                </Button>
                <Button
                  disabled={guardarM.isPending || cerrarM.isPending}
                  onClick={() => handleGuardar(true)}
                >
                  <Lock className="size-4 mr-1" />
                  Guardar y cerrar semana
                </Button>
              </div>
            )}
          </>
        )}

        <AlertDialog open={confirmCierre} onOpenChange={setConfirmCierre}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cerrar la estimación de esta semana?</AlertDialogTitle>
              <AlertDialogDescription>
                Una vez cerrada, los precios unitarios quedarán congelados y no podrás modificar
                cantidades. Asegúrate de haber capturado toda la producción de la semana.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => estimacion && cerrarM.mutate({ data: { id: estimacion.id } })}
              >
                Cerrar semana
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "destructive";
}) {
  return (
    <Card className={`p-3 ${tone === "destructive" ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold ${tone === "destructive" ? "text-destructive" : ""}`}>
        {value}
      </p>
    </Card>
  );
}
