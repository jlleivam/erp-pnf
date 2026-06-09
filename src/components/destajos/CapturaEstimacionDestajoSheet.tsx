import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrCreateEstimacionDestajo,
  guardarEstimacionDestajo,
  cerrarEstimacionDestajo,
} from "@/lib/api/destajos.functions";
import { calcularSemana, formatRangoSemana } from "@/lib/estimacion-utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
};

export function CapturaEstimacionDestajoSheet({
  destajoId,
  semanaInicio,
  onClose,
  onSaved,
}: {
  destajoId: string;
  semanaInicio: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const fetchBorrador = useServerFn(getOrCreateEstimacionDestajo);
  const q = useQuery({
    queryKey: ["destajo-estimacion-borrador", destajoId, semanaInicio],
    queryFn: () => fetchBorrador({ data: { destajoId, semanaInicio } }),
  });

  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [confirmCierre, setConfirmCierre] = useState(false);
  const [liberacionFondo, setLiberacionFondo] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  if (!initialized && q.data?.capturados) {
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(q.data.capturados)) init[k] = String(v);
    setCantidades(init);
    setInitialized(true);
  }

  const vigente = (q.data?.vigente ?? []) as VigenteRow[];
  const acumuladoPrevio = (q.data?.acumuladoPrevio ?? {}) as Record<string, number>;
  const estimacion = q.data?.estimacion as any;
  const isCerrada = estimacion?.estatus === "cerrada";
  const semana = calcularSemana(semanaInicio);

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
          `Excede vigente por ${(nuevoAcum - cantVig).toLocaleString("es-MX", { maximumFractionDigits: 2 })}`,
        );
      }
    }
    return { totalSemana, totalAcum, totalVigente, erroresPorClave };
  }, [vigente, cantidades, acumuladoPrevio]);

  const visibleRows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return vigente;
    return vigente.filter(
      (r) => r.clave.toLowerCase().includes(f) || r.concepto.toLowerCase().includes(f),
    );
  }, [vigente, filter]);

  const guardar = useServerFn(guardarEstimacionDestajo);
  const guardarM = useMutation({
    mutationFn: guardar,
    onSuccess: () => {
      toast.success("Borrador guardado");
      qc.invalidateQueries({ queryKey: ["destajo-estimaciones", destajoId] });
      qc.invalidateQueries({ queryKey: ["destajo-estimacion-borrador", destajoId, semanaInicio] });
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cerrar = useServerFn(cerrarEstimacionDestajo);
  const cerrarM = useMutation({
    mutationFn: cerrar,
    onSuccess: () => {
      toast.success("Estimación cerrada");
      qc.invalidateQueries({ queryKey: ["destajo-estimaciones", destajoId] });
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
            Estimación del destajo
            <Badge variant={isCerrada ? "default" : "secondary"}>
              {isCerrada ? "Cerrada" : "Borrador"}
            </Badge>
            <span className="ml-auto text-sm text-muted-foreground">
              {formatRangoSemana(semana.inicio, semana.fin)}
            </span>
          </SheetTitle>
          <SheetDescription>
            Captura la cantidad ejecutada por el destajista en esta semana.
          </SheetDescription>
        </SheetHeader>

        {q.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Cargando…</p>
        ) : !q.data?.hasBase ? (
          <Card className="mt-6 border-dashed p-8 text-center text-sm text-muted-foreground">
            El destajo no tiene presupuesto base autorizado.
          </Card>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mt-6">
              <StatCard label="Producción semana" value={formatMXN(computed.totalSemana)} />
              <StatCard label="Acumulado" value={formatMXN(computed.totalAcum)} />
              <StatCard label="Contratado" value={formatMXN(computed.totalVigente)} />
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

            <Card className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 w-24">Clave</th>
                    <th className="text-left p-2">Concepto</th>
                    <th className="text-left p-2 w-16">Un.</th>
                    <th className="text-right p-2 w-24">Cant. vig.</th>
                    <th className="text-right p-2 w-24">Acum. prev.</th>
                    <th className="text-right p-2 w-28">Esta semana</th>
                    <th className="text-right p-2 w-32">Importe sem.</th>
                    <th className="text-right p-2 w-20">% Acum.</th>
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
                          className="p-2 tabular-nums"
                          style={{ paddingLeft: `${0.5 + (r.nivel - 1) * 1}rem` }}
                        >
                          {r.clave}
                        </td>
                        <td className="p-2">{r.concepto}</td>
                        <td className="p-2 text-muted-foreground">{r.unidad ?? "—"}</td>
                        <td className="p-2 text-right tabular-nums">
                          {r.es_grupo
                            ? "—"
                            : cantVig.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right tabular-nums text-muted-foreground">
                          {r.es_grupo
                            ? "—"
                            : acumPrev > 0
                              ? acumPrev.toLocaleString("es-MX", { maximumFractionDigits: 2 })
                              : "—"}
                        </td>
                        <td className="p-2 text-right">
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
                              className={`h-8 text-right tabular-nums ${err ? "border-destructive focus-visible:ring-destructive" : ""}`}
                              title={err ?? ""}
                            />
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {r.es_grupo ? "—" : importeSem > 0 ? formatMXN(importeSem) : "—"}
                        </td>
                        <td
                          className={`p-2 text-right tabular-nums ${pct > 100 ? "text-destructive font-medium" : ""}`}
                        >
                          {r.es_grupo ? "—" : `${pct.toFixed(0)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

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
                Una vez cerrada se congelan precios y cantidades. Este será el monto a pagar
                al destajista por la semana.
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
