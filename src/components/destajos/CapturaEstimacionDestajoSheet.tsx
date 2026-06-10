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
  const terminos = (q.data?.terminos ?? {
    anticipo_pct: 0,
    anticipo_monto: 0,
    fondo_garantia_pct: 0,
    anticipo_amortizado_prev: 0,
    anticipo_saldo: 0,
    fondo_retenido_prev: 0,
    fondo_liberado_prev: 0,
    fondo_saldo_prev: 0,
  }) as {
    anticipo_pct: number;
    anticipo_monto: number;
    fondo_garantia_pct: number;
    anticipo_amortizado_prev: number;
    anticipo_saldo: number;
    fondo_retenido_prev: number;
    fondo_liberado_prev: number;
    fondo_saldo_prev: number;
  };
  const estatus = (estimacion?.estatus ?? "borrador") as
    | "borrador"
    | "cerrada"
    | "autorizada"
    | "rechazada"
    | "pagada";
  const isCerrada = estatus !== "borrador";
  const isReadOnly = estatus !== "borrador"; // inputs deshabilitados (incluye rechazada — debe reabrirse primero)
  const semana = calcularSemana(semanaInicio);

  const estatusLabel: Record<typeof estatus, string> = {
    borrador: "Borrador",
    cerrada: "Por autorizar",
    autorizada: "Autorizada",
    rechazada: "Rechazada",
    pagada: "Pagada",
  };
  const estatusVariant: Record<typeof estatus, "default" | "secondary" | "destructive" | "outline"> = {
    borrador: "secondary",
    cerrada: "outline",
    autorizada: "default",
    rechazada: "destructive",
    pagada: "default",
  };

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
    const bruto = totalSemana;
    const amortizacion = Math.min(
      terminos.anticipo_saldo,
      bruto * (terminos.anticipo_pct / 100),
    );
    const retencion = bruto * (terminos.fondo_garantia_pct / 100);
    const fondoDisponible = terminos.fondo_saldo_prev + retencion;
    const liberacionNum = Number(liberacionFondo || 0);
    const excedeLiberacion = liberacionNum > fondoDisponible + 0.01;
    const neto = bruto - amortizacion - retencion + liberacionNum;
    return {
      totalSemana,
      totalAcum,
      totalVigente,
      erroresPorClave,
      bruto,
      amortizacion,
      retencion,
      liberacion: liberacionNum,
      fondoDisponible,
      excedeLiberacion,
      neto,
    };
  }, [vigente, cantidades, acumuladoPrevio, terminos, liberacionFondo]);

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
    if (computed.excedeLiberacion) {
      toast.error(
        `La liberación de fondo no puede exceder el fondo disponible (${formatMXN(computed.fondoDisponible)}).`,
      );
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
        <TooltipProvider delayDuration={150}>
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2 flex-wrap text-base">
            Estimación del destajo
            <Badge variant={estatusVariant[estatus]} className="text-[10px] py-0 px-1.5 h-5">
              {estatusLabel[estatus]}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {formatRangoSemana(semana.inicio, semana.fin)}
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Captura la cantidad ejecutada por el destajista en esta semana.
          </SheetDescription>
        </SheetHeader>

        {estatus === "rechazada" && estimacion?.rechazo_motivo && (
          <Card className="mt-3 p-3 border-destructive/40 bg-destructive/5">
            <p className="text-xs uppercase tracking-wider text-destructive font-semibold flex items-center gap-1">
              <AlertTriangle className="size-3" /> Rechazada
            </p>
            <p className="text-sm mt-1">{estimacion.rechazo_motivo}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Corrige las cantidades y vuelve a cerrar la semana para enviarla a autorización.
            </p>
          </Card>
        )}

        {q.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Cargando…</p>
        ) : !q.data?.hasBase ? (
          <Card className="mt-4 border-dashed p-6 text-center text-sm text-muted-foreground">
            El destajo no tiene presupuesto base autorizado.
          </Card>
        ) : (
          <>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 mt-3">
              <StatCard label="Producción semana" value={formatMXN(computed.totalSemana)} />
              <StatCard label="Acumulado" value={formatMXN(computed.totalAcum)} />
              <StatCard label="Contratado" value={formatMXN(computed.totalVigente)} />
              <StatCard
                label="% Avance"
                value={`${pctAvance.toFixed(1)}%`}
                tone={pctAvance > 100 ? "destructive" : "default"}
              />
            </div>

            <div className="flex items-center gap-2 mt-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
                <Input
                  className="pl-7 h-8 text-sm"
                  placeholder="Buscar por clave o concepto…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              {computed.erroresPorClave.size > 0 && (
                <Badge variant="destructive" className="gap-1 text-[10px] py-0 px-1.5 h-5">
                  <AlertTriangle className="size-3" /> {computed.erroresPorClave.size} con exceso
                </Badge>
              )}
            </div>

            <Card className="mt-3 overflow-x-auto">
              <table className="w-full text-[13px] table-fixed">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left py-1.5 px-2 w-16">Clave</th>
                    <th className="text-left py-1.5 px-2">Concepto</th>
                    <th className="text-center py-1.5 px-2 w-12">Un.</th>
                    <th className="text-center py-1.5 px-2 w-20">Cant. vig.</th>
                    <th className="text-center py-1.5 px-2 w-20">Acum. prev.</th>
                    <th className="text-center py-1.5 px-2 w-24">Esta semana</th>
                    <th className="text-center py-1.5 px-2 w-28">Importe sem.</th>
                    <th className="text-center py-1.5 px-2 w-16">% Acum.</th>
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
                          className="py-1 px-2 tabular-nums"
                          style={{ paddingLeft: `${0.5 + (r.nivel - 1) * 0.75}rem` }}
                        >
                          {r.clave}
                        </td>
                        <td className="py-1 px-2 truncate">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate cursor-default">{r.concepto}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start" className="max-w-xs">
                              {r.concepto}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="py-1 px-2 text-center text-muted-foreground">{r.unidad ?? "—"}</td>
                        <td className="py-1 px-2 text-center tabular-nums">
                          {r.es_grupo
                            ? "—"
                            : cantVig.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 px-2 text-center tabular-nums text-muted-foreground">
                          {r.es_grupo
                            ? "—"
                            : acumPrev > 0
                              ? acumPrev.toLocaleString("es-MX", { maximumFractionDigits: 2 })
                              : "—"}
                        </td>
                        <td className="py-1 px-2 text-center">
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
                              className={`h-7 text-center tabular-nums px-1 ${err ? "border-destructive focus-visible:ring-destructive" : ""}`}
                              title={err ?? ""}
                            />
                          )}
                        </td>
                        <td className="py-1 px-2 text-center tabular-nums">
                          {r.es_grupo ? "—" : importeSem > 0 ? formatMXN(importeSem) : "—"}
                        </td>
                        <td
                          className={`py-1 px-2 text-center tabular-nums ${pct > 100 ? "text-destructive font-medium" : ""}`}
                        >
                          {r.es_grupo ? "—" : `${pct.toFixed(0)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {(terminos.anticipo_pct > 0 || terminos.fondo_garantia_pct > 0) && (
              <Card className="mt-4 p-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Cálculo de pago de la semana
                </p>
                <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2">
                  <Row label="Bruto (producción semana)" value={formatMXN(computed.bruto)} />
                  {terminos.anticipo_pct > 0 && (
                    <Row
                      label={`(−) Amortización anticipo ${terminos.anticipo_pct}%`}
                      value={`−${formatMXN(computed.amortizacion)}`}
                      hint={`Saldo anticipo antes: ${formatMXN(terminos.anticipo_saldo)}`}
                    />
                  )}
                  {terminos.fondo_garantia_pct > 0 && (
                    <Row
                      label={`(−) Retención fondo ${terminos.fondo_garantia_pct}%`}
                      value={`−${formatMXN(computed.retencion)}`}
                    />
                  )}
                  {terminos.fondo_garantia_pct > 0 && !isCerrada && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs flex-1">
                        (+) Liberar fondo en esta semana
                      </span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        max={computed.fondoDisponible}
                        value={liberacionFondo}
                        onChange={(e) => setLiberacionFondo(e.target.value)}
                        className="h-8 w-32 text-right tabular-nums"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  {terminos.fondo_garantia_pct > 0 && isCerrada && computed.liberacion > 0 && (
                    <Row
                      label="(+) Liberación fondo"
                      value={`+${formatMXN(computed.liberacion)}`}
                    />
                  )}
                </div>
                <div className="border-t mt-2 pt-2 flex justify-between font-semibold">
                  <span>Neto a pagar</span>
                  <span className="tabular-nums">{formatMXN(computed.neto)}</span>
                </div>
                {terminos.fondo_garantia_pct > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Fondo disponible al cierre: {formatMXN(computed.fondoDisponible - computed.liberacion)}
                  </p>
                )}
              </Card>
            )}


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
              <AlertDialogTitle>¿Cerrar y enviar a autorización?</AlertDialogTitle>
              <AlertDialogDescription>
                Se congelan precios y cantidades de esta semana y se envía al supervisor
                de la obra para que la autorice. La cuenta por pagar al contratista y el
                asiento contable se generan hasta que el supervisor autorice.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  estimacion &&
                  cerrarM.mutate({
                    data: {
                      id: estimacion.id,
                      liberacionFondo: Number(liberacionFondo || 0),
                    },
                  })
                }
              >
                Cerrar semana
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </TooltipProvider>
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
    <Card className={`p-2 ${tone === "destructive" ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${tone === "destructive" ? "text-destructive" : ""}`}>
        {value}
      </p>
    </Card>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">
        {label}
        {hint && <span className="block text-[10px]">{hint}</span>}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
