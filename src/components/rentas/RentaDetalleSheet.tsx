import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRenta,
  autorizarRenta,
  rechazarRenta,
  autorizarRenovacion,
  rechazarRenovacion,
  eliminarEvento,
  eliminarPago,
  recalcularPeriodos,
} from "@/lib/api/rentas.functions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle, CheckCircle2, XCircle, Plus, Truck, RotateCcw, PackageCheck, Trash2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { formatMXN, formatDate } from "@/lib/format";
import { CotizarRentaDialog } from "./CotizarRentaDialog";
import { MarcarLlegadaDialog } from "./MarcarLlegadaDialog";
import { RenovarRentaDialog } from "./RenovarRentaDialog";
import { DevolverRentaDialog } from "./DevolverRentaDialog";
import { RegistrarEventoDialog } from "./RegistrarEventoDialog";
import { RegistrarPagoCxPDialog } from "@/components/pagos/RegistrarPagoCxPDialog";
import { RechazarDialog } from "./RechazarDialog";

const ESTATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  solicitada: "Solicitada",
  cotizada: "Cotizada",
  autorizada: "Autorizada",
  rechazada: "Rechazada",
  activa: "Activa",
  devuelta: "Devuelta",
};
const ESTATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "secondary",
  solicitada: "outline",
  cotizada: "outline",
  autorizada: "default",
  rechazada: "destructive",
  activa: "default",
  devuelta: "secondary",
};

const TIPO_EVENTO_LABEL: Record<string, string> = {
  averia: "Avería",
  inactividad: "Inactividad",
  nota: "Nota",
};

export function RentaDetalleSheet({
  rentaId,
  canAuthorize,
  canCotizar,
  canPagar,
  defaultTab,
  onClose,
  onChanged,
}: {
  rentaId: string;
  canAuthorize: boolean;
  canCotizar: boolean;
  canPagar: boolean;
  defaultTab?: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const fetchDet = useServerFn(getRenta);
  const q = useQuery({
    queryKey: ["renta", rentaId],
    queryFn: () => fetchDet({ data: { id: rentaId } }),
  });

  const [cotizando, setCotizando] = useState(false);
  const [llegando, setLlegando] = useState(false);
  const [renovando, setRenovando] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);
  const [creandoEvento, setCreandoEvento] = useState(false);
  const [pagandoCxP, setPagandoCxP] = useState<{ cxpId: string; folio: string; saldo: number; beneficiario: string } | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [rechazandoRenovId, setRechazandoRenovId] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["renta", rentaId] });
    onChanged?.();
  };

  const autorizar = useServerFn(autorizarRenta);
  const autorizarM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => { toast.success("Autorizada"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rechazar = useServerFn(rechazarRenta);
  const rechazarM = useMutation({
    mutationFn: rechazar,
    onSuccess: () => { toast.success("Rechazada"); setRechazando(false); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const autRenov = useServerFn(autorizarRenovacion);
  const autRenovM = useMutation({
    mutationFn: autRenov,
    onSuccess: () => { toast.success("Renovación autorizada"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const recRenov = useServerFn(rechazarRenovacion);
  const recRenovM = useMutation({
    mutationFn: recRenov,
    onSuccess: () => { toast.success("Renovación rechazada"); setRechazandoRenovId(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delEvento = useServerFn(eliminarEvento);
  const delEventoM = useMutation({
    mutationFn: delEvento,
    onSuccess: () => { toast.success("Evento eliminado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delPago = useServerFn(eliminarPago);
  const delPagoM = useMutation({
    mutationFn: delPago,
    onSuccess: () => { toast.success("Periodo eliminado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const recalc = useServerFn(recalcularPeriodos);
  const recalcM = useMutation({
    mutationFn: recalc,
    onSuccess: (r: any) => {
      toast.success(r?.generados > 0 ? `${r.generados} periodo(s) generados` : "Sin periodos nuevos");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data as any;
  const renta = data?.renta;
  const renovaciones = (data?.renovaciones ?? []) as any[];
  const eventos = (data?.eventos ?? []) as any[];
  const pagos = (data?.pagos ?? []) as any[];

  const alerta =
    renta?.estatus === "activa" &&
    data?.dias_restantes != null &&
    data.dias_restantes <= renta.dias_aviso_vencimiento;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {renta?.equipo ?? "Renta"}
            {renta && (
              <Badge variant={ESTATUS_VARIANT[renta.estatus]}>
                {ESTATUS_LABEL[renta.estatus]}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {renta?.proveedor?.razon_social
              ? `Proveedor: ${renta.proveedor.razon_social}`
              : renta?.estatus === "borrador"
                ? "Sin cotización aún"
                : "Cargando proveedor…"}
          </SheetDescription>
        </SheetHeader>

        {q.isLoading || !renta ? (
          <p className="text-sm text-muted-foreground mt-6">Cargando…</p>
        ) : (
          <div className="mt-6 space-y-4">
            {alerta && (
              <Card className="p-3 border-yellow-500/40 bg-yellow-500/5 flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-yellow-600" />
                <span>
                  Renta próxima a vencer{" "}
                  <strong>
                    {data.dias_restantes < 0
                      ? `(vencida hace ${Math.abs(data.dias_restantes)} días)`
                      : `(en ${data.dias_restantes} días)`}
                  </strong>
                  . Renueva o coordina devolución.
                </span>
              </Card>
            )}

            {renta.estatus === "rechazada" && renta.rechazo_motivo && (
              <Card className="p-3 border-destructive/40 bg-destructive/5 text-sm">
                <strong>Rechazada:</strong> {renta.rechazo_motivo}
              </Card>
            )}

            <Card className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Item label="Cantidad" value={String(renta.cantidad)} />
              <Item label="Periodicidad" value={renta.periodicidad ?? "—"} />
              <Item
                label="Periodos estimados"
                value={
                  renta.periodos_estimados != null
                    ? `${renta.periodos_estimados} ${
                        renta.periodicidad === "diaria" ? "días"
                        : renta.periodicidad === "semanal" ? "semanas"
                        : renta.periodicidad === "quincenal" ? "quincenas"
                        : renta.periodicidad === "mensual" ? "meses"
                        : ""
                      }`.trim()
                    : "—"
                }
              />
              <Item label="Tarifa" value={formatMXN(renta.tarifa_unitaria)} />
              <Item label="Depósito" value={formatMXN(renta.deposito)} />
              <Item label="Llegada" value={formatDate(renta.fecha_llegada_real)} />
              <Item label="Vence" value={formatDate(renta.fecha_fin_programada)} />
              <Item label="Devolución" value={formatDate(renta.fecha_devolucion_real)} />
              <Item label="Acumulado" value={formatMXN(data.monto_acumulado)} hint={`${data.dias_acumulados} días`} />
            </Card>

            <Tabs defaultValue={defaultTab ?? "vigencia"}>
              <TabsList>
                <TabsTrigger value="cotizacion">Cotización</TabsTrigger>
                <TabsTrigger value="vigencia">Vigencia</TabsTrigger>
                <TabsTrigger value="bitacora">Bitácora ({eventos.length})</TabsTrigger>
                <TabsTrigger value="pagos">Pagos ({pagos.length})</TabsTrigger>
              </TabsList>

              {/* COTIZACION */}
              <TabsContent value="cotizacion" className="mt-4 space-y-3">
                {renta.descripcion && (
                  <Card className="p-3 text-sm">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Notas de la solicitud
                    </p>
                    {renta.descripcion}
                  </Card>
                )}
                {renta.condiciones && (
                  <Card className="p-3 text-sm">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      Condiciones del proveedor
                    </p>
                    {renta.condiciones}
                  </Card>
                )}
                <div className="flex gap-2 flex-wrap">
                  {(renta.estatus === "borrador" || renta.estatus === "rechazada") && canCotizar && (
                    <Button size="sm" onClick={() => setCotizando(true)}>
                      {renta.estatus === "rechazada" ? "Re-cotizar" : "Cotizar"}
                    </Button>
                  )}
                  {renta.estatus === "cotizada" && canAuthorize && (
                    <>
                      <Button size="sm" onClick={() => autorizarM.mutate({ data: { id: rentaId } })}>
                        <CheckCircle2 className="size-4 mr-1" /> Autorizar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRechazando(true)}>
                        <XCircle className="size-4 mr-1" /> Rechazar
                      </Button>
                    </>
                  )}
                  {renta.estatus === "cotizada" && !canAuthorize && (
                    <p className="text-xs text-muted-foreground">
                      Esperando autorización del supervisor.
                    </p>
                  )}
                  {renta.estatus === "cotizada" && canCotizar && (
                    <Button size="sm" variant="ghost" onClick={() => setCotizando(true)}>
                      Editar cotización
                    </Button>
                  )}
                </div>
              </TabsContent>

              {/* VIGENCIA */}
              <TabsContent value="vigencia" className="mt-4 space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {renta.estatus === "autorizada" && (
                    <Button size="sm" onClick={() => setLlegando(true)}>
                      <Truck className="size-4 mr-1" /> Marcar llegada
                    </Button>
                  )}
                  {renta.estatus === "activa" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setRenovando(true)}>
                        <RotateCcw className="size-4 mr-1" /> Solicitar renovación
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDevolviendo(true)}>
                        <PackageCheck className="size-4 mr-1" /> Marcar devolución
                      </Button>
                    </>
                  )}
                </div>

                {renovaciones.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Renovaciones
                    </p>
                    {renovaciones.map((r) => (
                      <Card key={r.id} className="p-3 text-sm flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">Renovación {r.numero}</span>
                            <Badge variant={ESTATUS_VARIANT[r.estatus]}>{ESTATUS_LABEL[r.estatus] ?? r.estatus}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(r.fecha_fin_anterior)} → {formatDate(r.fecha_fin_nueva)}
                            {r.tarifa_nueva != null && ` · Nueva tarifa ${formatMXN(r.tarifa_nueva)}`}
                          </p>
                          {r.motivo && <p className="text-xs mt-1">{r.motivo}</p>}
                          {r.estatus === "rechazada" && r.rechazo_motivo && (
                            <p className="text-xs text-destructive mt-1">Motivo: {r.rechazo_motivo}</p>
                          )}
                        </div>
                        {r.estatus === "pendiente" && canAuthorize && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => autRenovM.mutate({ data: { id: r.id } })}>
                              Autorizar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRechazandoRenovId(r.id)}>
                              Rechazar
                            </Button>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* BITACORA */}
              <TabsContent value="bitacora" className="mt-4 space-y-3">
                <div>
                  <Button size="sm" onClick={() => setCreandoEvento(true)}>
                    <Plus className="size-4 mr-1" /> Registrar evento
                  </Button>
                </div>
                {eventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin eventos aún.</p>
                ) : (
                  eventos.map((e) => (
                    <Card key={e.id} className="p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{TIPO_EVENTO_LABEL[e.tipo] ?? e.tipo}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(e.fecha_inicio)}
                              {e.fecha_fin ? ` → ${formatDate(e.fecha_fin)}` : ""}
                            </span>
                          </div>
                          <p className="mt-1">{e.descripcion}</p>
                        </div>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => delEventoM.mutate({ data: { id: e.id } })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* PAGOS — periodos devengados */}
              <TabsContent value="pagos" className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {canPagar && (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => recalcM.mutate({ data: { rentaId } })}
                      disabled={recalcM.isPending}
                    >
                      <RefreshCw className="size-4 mr-1" />
                      {recalcM.isPending ? "Recalculando…" : "Recalcular periodos"}
                    </Button>
                  )}
                  <div className="text-sm grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 ml-auto">
                    <span className="text-muted-foreground">Devengado:</span>
                    <strong className="text-right tabular-nums col-span-1 sm:col-span-2">{formatMXN(data.total_devengado ?? 0)}</strong>
                    <span className="text-muted-foreground">Pagado:</span>
                    <strong className="text-right tabular-nums col-span-1 sm:col-span-2">{formatMXN(data.total_pagado)}</strong>
                    <span className="text-muted-foreground">Por pagar:</span>
                    <strong className="text-right tabular-nums col-span-1 sm:col-span-2">
                      {formatMXN(Math.max(0, Number(data.total_devengado ?? 0) - Number(data.total_pagado)))}
                    </strong>
                  </div>
                </div>
                {pagos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay periodos devengados. Se generarán automáticamente cuando la renta esté activa, o usa "Recalcular periodos".
                  </p>
                ) : (
                  <Card className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left p-2">Periodo</th>
                          <th className="text-left p-2">CxP</th>
                          <th className="text-left p-2">Vence</th>
                          <th className="text-left p-2">Estatus</th>
                          <th className="text-right p-2">Monto</th>
                          <th className="text-right p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagos.map((p: any) => {
                          const saldo = p.cxp
                            ? Math.max(0, Number(p.cxp.monto_total) - Number(p.cxp.monto_pagado))
                            : Number(p.monto);
                          const pagado = p.estatus === "pagado" || (p.cxp && saldo <= 0.01);
                          const cxpEstatus = p.cxp?.estatus ?? p.estatus;
                          const vencida =
                            !pagado && p.fecha_vencimiento &&
                            new Date(p.fecha_vencimiento) < new Date();
                          return (
                            <tr key={p.id} className="border-t border-border">
                              <td className="p-2">
                                {formatDate(p.periodo_inicio)} – {formatDate(p.periodo_fin)}
                              </td>
                              <td className="p-2 font-mono text-xs">
                                {p.cxp?.folio ?? "—"}
                              </td>
                              <td className="p-2">
                                <span className={vencida ? "text-destructive font-medium" : ""}>
                                  {formatDate(p.fecha_vencimiento)}
                                </span>
                              </td>
                              <td className="p-2">
                                <Badge
                                  variant={
                                    pagado ? "default"
                                    : vencida ? "destructive"
                                    : cxpEstatus === "pagada_parcial" ? "outline"
                                    : "secondary"
                                  }
                                >
                                  {pagado ? "Pagado"
                                    : cxpEstatus === "pagada_parcial" ? "Parcial"
                                    : vencida ? "Vencido"
                                    : "Pendiente"}
                                </Badge>
                              </td>
                              <td className="p-2 text-right tabular-nums">
                                {formatMXN(p.monto)}
                                {!pagado && p.cxp && saldo !== Number(p.monto) && (
                                  <div className="text-xs text-muted-foreground">
                                    Saldo {formatMXN(saldo)}
                                  </div>
                                )}
                              </td>
                              <td className="p-2 text-right whitespace-nowrap">
                                {!pagado && canPagar && p.cxp && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      setPagandoCxP({
                                        cxpId: p.cxp.id,
                                        folio: p.cxp.folio,
                                        saldo,
                                        beneficiario: renta.proveedor?.razon_social ?? "Proveedor",
                                      })
                                    }
                                  >
                                    Pagar
                                  </Button>
                                )}
                                {!pagado && (
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={() => delPagoM.mutate({ data: { id: p.id } })}
                                    title="Eliminar periodo (solo director)"
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {cotizando && renta && (
          <CotizarRentaDialog
            rentaId={rentaId}
            initialProveedorId={renta.proveedor_id}
            initialPeriodicidad={renta.periodicidad}
            initialTarifa={renta.tarifa_unitaria}
            initialDeposito={renta.deposito}
            initialCondiciones={renta.condiciones}
            onClose={() => setCotizando(false)}
            onSaved={() => { setCotizando(false); refresh(); }}
          />
        )}
        {llegando && (
          <MarcarLlegadaDialog
            rentaId={rentaId}
            periodicidad={renta?.periodicidad ?? null}
            periodosEstimados={renta?.periodos_estimados ?? null}
            onClose={() => setLlegando(false)}
            onSaved={() => { setLlegando(false); refresh(); }}
          />
        )}
        {renovando && renta?.fecha_fin_programada && (
          <RenovarRentaDialog
            rentaId={rentaId}
            fechaFinActual={renta.fecha_fin_programada}
            tarifaActual={Number(renta.tarifa_unitaria)}
            onClose={() => setRenovando(false)}
            onSaved={() => { setRenovando(false); refresh(); }}
          />
        )}
        {devolviendo && (
          <DevolverRentaDialog
            rentaId={rentaId}
            onClose={() => setDevolviendo(false)}
            onSaved={() => { setDevolviendo(false); refresh(); }}
          />
        )}
        {creandoEvento && (
          <RegistrarEventoDialog
            rentaId={rentaId}
            onClose={() => setCreandoEvento(false)}
            onSaved={() => { setCreandoEvento(false); refresh(); }}
          />
        )}
        {pagandoCxP && (
          <RegistrarPagoCxPDialog
            cxpId={pagandoCxP.cxpId}
            folio={pagandoCxP.folio}
            beneficiarioNombre={pagandoCxP.beneficiario}
            saldoPendiente={pagandoCxP.saldo}
            open
            onOpenChange={(o) => !o && setPagandoCxP(null)}
            onSaved={() => { setPagandoCxP(null); refresh(); }}
          />
        )}
        {rechazando && (
          <RechazarDialog
            title="Rechazar cotización"
            onClose={() => setRechazando(false)}
            onConfirm={(motivo) => rechazarM.mutate({ data: { id: rentaId, motivo } })}
            pending={rechazarM.isPending}
          />
        )}
        {rechazandoRenovId && (
          <RechazarDialog
            title="Rechazar renovación"
            onClose={() => setRechazandoRenovId(null)}
            onConfirm={(motivo) =>
              recRenovM.mutate({ data: { id: rechazandoRenovId, motivo } })
            }
            pending={recRenovM.isPending}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Item({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
