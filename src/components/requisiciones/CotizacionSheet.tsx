import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileText, Send, Wallet, Trash2 } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  getCotizacionRequisicion, listProveedores, enviarOCASupervisor, reabrirOC, enviarOCAProveedor,
} from "@/lib/api/cotizaciones.functions";
import { listPagosOC, cancelarPagoOC } from "@/lib/api/pagos.functions";
import { RegistrarPagoOCDialog } from "@/components/pagos/RegistrarPagoOCDialog";
import { RecepcionDialog } from "@/components/almacen/RecepcionDialog";

import { getSolicitudesRequisicion } from "@/lib/api/solicitudes-cotizacion.functions";
import { SolicitudesTab } from "./SolicitudesTab";
import { ComparativaTable } from "./ComparativaTable";
import { RecepcionesTab } from "./RecepcionesTab";
import { useEffectiveRoles } from "@/stores/auth";
import { usePermisos } from "@/hooks/usePermisos";

export type CotizacionTab = "requisicion" | "solicitudes" | "comparativa" | "ocs" | "recepciones";

interface Props {
  requisicionId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTab?: CotizacionTab;
}

const OC_BADGE: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  pendiente_autorizacion: { label: "Pendiente autorización", className: "bg-amber-100 text-amber-800" },
  autorizada: { label: "Autorizada", className: "bg-emerald-100 text-emerald-800" },
  enviada: { label: "Enviada al proveedor", className: "bg-blue-100 text-blue-800" },
  recibida_parcial: { label: "Recibida parcial", className: "bg-cyan-100 text-cyan-800" },
  recibida: { label: "Recibida", className: "bg-teal-100 text-teal-800" },
  rechazada: { label: "Rechazada", className: "bg-rose-100 text-rose-800" },
  pagada: { label: "Pagada", className: "bg-violet-100 text-violet-800" },
};



const REQ_BADGE: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  enviada: { label: "Enviada", className: "bg-blue-100 text-blue-800" },
  en_cotizacion: { label: "En cotización", className: "bg-amber-100 text-amber-800" },
  cotizada: { label: "Cotizada", className: "bg-indigo-100 text-indigo-800" },
  autorizada: { label: "Autorizada", className: "bg-emerald-100 text-emerald-800" },
  oc_generada: { label: "OC generada", className: "bg-emerald-100 text-emerald-800" },
  completada: { label: "Completada", className: "bg-emerald-100 text-emerald-800" },
  rechazada: { label: "Rechazada", className: "bg-rose-100 text-rose-800" },
};

const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function CotizacionSheet({ requisicionId, open, onOpenChange, initialTab = "requisicion" }: Props) {
  const qc = useQueryClient();
  const fetchCot = useServerFn(getCotizacionRequisicion);
  const fetchProv = useServerFn(listProveedores);
  const fetchSols = useServerFn(getSolicitudesRequisicion);
  const enviarFn = useServerFn(enviarOCASupervisor);
  const reabrirFn = useServerFn(reabrirOC);
  const enviarProvFn = useServerFn(enviarOCAProveedor);


  const roles = useEffectiveRoles();

  const [tab, setTab] = useState<CotizacionTab>(initialTab);

  const cotQ = useQuery({
    queryKey: ["cotizacion", requisicionId],
    queryFn: () => fetchCot({ data: { requisicionId } }),
    enabled: open,
  });
  const provQ = useQuery({
    queryKey: ["proveedores-list"],
    queryFn: () => fetchProv(),
    enabled: open,
  });
  const solsQ = useQuery({
    queryKey: ["solicitudes", requisicionId],
    queryFn: () => fetchSols({ data: { requisicionId } }),
    enabled: open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cotizacion", requisicionId] });
    qc.invalidateQueries({ queryKey: ["requisiciones"] });
  };

  const enviarMut = useMutation({
    mutationFn: (ocId: string) => enviarFn({ data: { ocId } }),
    onSuccess: () => { toast.success("OC enviada al supervisor"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const reabrirMut = useMutation({
    mutationFn: (ocId: string) => reabrirFn({ data: { ocId } }),
    onSuccess: () => { toast.success("OC reabierta"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const enviarProvMut = useMutation({
    mutationFn: (ocId: string) => enviarProvFn({ data: { ocId } }),
    onSuccess: () => { toast.success("OC marcada como enviada al proveedor"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const { can } = usePermisos();
  const puedeGestionar = can("cotizaciones.gestionar");
  const puedeCrearOC = can("oc.crear");
  const puedeCancelarOC = can("oc.cancelar");
  const isAdmin = puedeGestionar || puedeCrearOC;
  void roles;


  if (!open) return null;

  const req = (cotQ.data as any)?.requisicion;
  const reqItems: any[] = req?.items ?? [];
  const paquetes: any[] = (cotQ.data as any)?.paquetes ?? [];
  const ocs: any[] = (cotQ.data as any)?.ocs ?? [];
  const proveedores: any[] = provQ.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cotización · {req?.folio ?? "—"}</SheetTitle>
          <SheetDescription>
            Compara precios, asigna proveedores y autoriza pedidos
          </SheetDescription>
        </SheetHeader>

        {cotQ.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as CotizacionTab)} className="mt-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="requisicion">Requisición</TabsTrigger>
              <TabsTrigger value="solicitudes">Cotizaciones ({(solsQ.data ?? []).length})</TabsTrigger>
              <TabsTrigger value="comparativa">Comparativa</TabsTrigger>
              <TabsTrigger value="ocs">OCs ({ocs.length})</TabsTrigger>
              <TabsTrigger value="recepciones">Recepciones</TabsTrigger>
            </TabsList>

            <TabsContent value="requisicion" className="mt-4 space-y-4">
              <Card className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold">{req?.folio ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitante: {req?.solicitante ?? "—"}
                    </p>
                  </div>
                  {req?.estatus && (
                    <Badge className={REQ_BADGE[req.estatus]?.className ?? "bg-slate-100 text-slate-700"}>
                      {REQ_BADGE[req.estatus]?.label ?? req.estatus}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>Creada: {req?.created_at ? formatDate(req.created_at) : "—"}</p>
                  <p>Enviada: {req?.enviada_at ? formatDate(req.enviada_at) : "—"}</p>
                </div>
                {req?.notas && (
                  <p className="text-sm bg-muted/40 p-2 rounded-md">
                    <strong>Notas:</strong> {req.notas}
                  </p>
                )}
              </Card>

              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Fecha requerida</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reqItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                          Sin insumos
                        </TableCell>
                      </TableRow>
                    )}
                    {reqItems.map((it: any) => (
                      <TableRow key={it.id}>
                        <TableCell>{it.insumo?.nombre}</TableCell>
                        <TableCell className="text-right">
                          {Number(it.cantidad)} {it.insumo?.unidad}
                        </TableCell>
                        <TableCell>{it.fecha_requerida ? formatDate(it.fecha_requerida) : "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{it.nota ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="solicitudes" className="mt-4">
              <SolicitudesTab
                requisicionId={requisicionId}
                reqItems={reqItems}
                proveedores={proveedores}
                solicitudes={solsQ.data ?? []}
                bloqueadoPorOC={ocs.some((o: any) => o.estatus !== "rechazada")}
              />
            </TabsContent>

            <TabsContent
              value="comparativa"
              forceMount
              className="mt-4 data-[state=inactive]:hidden"
            >
              <ComparativaTable
                reqItems={reqItems}
                solicitudes={solsQ.data ?? []}
                paquetes={paquetes}
                ocs={ocs}
                requisicionId={requisicionId}
                roles={roles}
              />
            </TabsContent>

            <TabsContent value="ocs" className="space-y-3 mt-4">
              {ocs.length === 0 && (
                <Card className="p-8 text-center border-dashed">
                  <FileText className="size-8 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Aún no hay órdenes de compra</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Asigna proveedores en Comparativa y envíalos a autorización.
                  </p>
                </Card>
              )}
              {ocs.map((oc) => {
                const items = oc.paquete?.items ?? [];
                const total = Number(oc.total);
                const pagado = Number(oc.monto_pagado ?? 0);
                const saldoPendiente = +(total - pagado).toFixed(2);
                const estadoPagoRaw: "pendiente" | "parcial" | "pagado" = oc.estado_pago ?? "pendiente";
                const fullyPaid = estadoPagoRaw === "pagado" || (pagado > 0 && pagado + 0.01 >= total);
                const estadoPago: "pendiente" | "parcial" | "pagado" = fullyPaid ? "pagado" : estadoPagoRaw;
                const recibidoMap: Record<string, number> = oc.recibido_por_insumo ?? {};
                const recepcionCompleta: boolean = !!oc.recepcion_completa;
                const cerrada = recepcionCompleta && estadoPago === "pagado";
                const meta = OC_BADGE[oc.estatus];
                const puedePagar =
                  can("cxp.registrar_pago") &&
                  (oc.estatus === "autorizada" || oc.estatus === "enviada" || oc.estatus === "recibida_parcial" || oc.estatus === "recibida") &&
                  !fullyPaid;
                const puedeRecibirRol = roles.includes("director") || roles.includes("residente");
                const puedeRecibir =
                  puedeRecibirRol &&
                  (oc.estatus === "enviada" || oc.estatus === "recibida_parcial") && !cerrada;
                return (
                  <Card key={oc.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{oc.folio}</p>
                          {cerrada ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Cerrada</Badge>
                          ) : (
                            <>
                              <Badge className={meta?.className}>{meta?.label}</Badge>
                              {(oc.estatus === "autorizada" || oc.estatus === "enviada" || oc.estatus === "recibida_parcial" || oc.estatus === "recibida" || estadoPago !== "pendiente") && (
                                <Badge
                                  className={
                                    estadoPago === "pagado"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : estadoPago === "parcial"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-100 text-slate-700"
                                  }
                                >
                                  {estadoPago === "pagado" ? "Pagada" : estadoPago === "parcial" ? "Pago parcial" : "Sin pago"}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{oc.proveedor?.razon_social}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">{mxn(total)}</p>
                        {pagado > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Pagado {mxn(pagado)} · pend. {mxn(saldoPendiente)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Insumo</TableHead>
                            <TableHead className="text-right">Pedido</TableHead>
                            <TableHead className="text-right">Recibido</TableHead>
                            <TableHead className="text-right">P. Unit</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((it: any) => {
                            const pedido = Number(it.cantidad);
                            const recibido = Number(recibidoMap[it.insumo?.id] ?? 0);
                            const cls =
                              recibido <= 0
                                ? "text-muted-foreground"
                                : recibido + 1e-6 < pedido
                                  ? "text-amber-700"
                                  : "text-emerald-700";
                            return (
                              <TableRow key={it.id}>
                                <TableCell>{it.insumo?.nombre}</TableCell>
                                <TableCell className="text-right">{pedido} {it.insumo?.unidad}</TableCell>
                                <TableCell className={`text-right font-medium ${cls}`}>{recibido} {it.insumo?.unidad}</TableCell>
                                <TableCell className="text-right">{mxn(Number(it.precio_unitario))}</TableCell>
                                <TableCell className="text-right">{mxn(Number(it.subtotal))}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {oc.estatus === "borrador" && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setTab("comparativa")}>
                          Editar en Comparativa
                        </Button>
                        <Button size="sm" onClick={() => enviarMut.mutate(oc.id)} disabled={enviarMut.isPending}>
                          <Send className="size-4 mr-1" /> Enviar a supervisor
                        </Button>
                      </div>
                    )}
                    {oc.estatus === "pendiente_autorizacion" && (
                      <p className="text-sm text-muted-foreground">
                        Enviada al supervisor · {oc.enviada_supervisor_at ? formatDate(oc.enviada_supervisor_at) : "—"}
                      </p>
                    )}
                    {oc.estatus === "autorizada" && (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="size-4" /> Autorizada {oc.autorizada_at ? `· ${formatDate(oc.autorizada_at)}` : ""}
                        </p>
                        {puedeCrearOC && (
                          <Button
                            size="sm"
                            onClick={() => enviarProvMut.mutate(oc.id)}
                            disabled={enviarProvMut.isPending}
                          >
                            <Send className="size-4 mr-1" /> Marcar como enviada al proveedor
                          </Button>
                        )}
                      </div>
                    )}
                    {(oc.estatus === "enviada" || oc.estatus === "recibida_parcial" || oc.estatus === "recibida") && !cerrada && (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm flex items-center gap-1 text-blue-700">
                          <Send className="size-4" /> Enviada al proveedor {oc.enviada_proveedor_at ? `· ${formatDate(oc.enviada_proveedor_at)}` : ""}
                        </p>
                        {puedeRecibir && (
                          <OCRecepcionButton ocId={oc.id} onSaved={invalidate} />
                        )}
                      </div>
                    )}
                    {cerrada && (
                      <p className="text-sm flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="size-4" /> Cerrada
                        {oc.ultima_recepcion_at ? ` · ${formatDate(oc.ultima_recepcion_at)}` : ""}
                      </p>
                    )}
                    {oc.estatus === "rechazada" && (
                      <div className="space-y-2">
                        {oc.notas_supervisor && (
                          <p className="text-sm text-rose-700 bg-rose-50 p-2 rounded-md">
                            <strong>Motivo:</strong> {oc.notas_supervisor}
                          </p>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setTab("comparativa")}>
                            Revisar en Comparativa
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => reabrirMut.mutate(oc.id)} disabled={reabrirMut.isPending}>
                            Reabrir
                          </Button>
                        </div>
                      </div>
                    )}

                    {(oc.estatus === "autorizada" || oc.estatus === "enviada" || oc.estatus === "recibida_parcial" || oc.estatus === "recibida" || pagado > 0) && (
                      <OCPagosPanel
                        ocId={oc.id}
                        ocFolio={oc.folio}
                        saldoPendiente={saldoPendiente}
                        puedePagar={puedePagar}
                        puedeCancelar={puedeCancelarOC}
                        onChange={invalidate}
                      />
                    )}
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OCPagosPanel({
  ocId, ocFolio, saldoPendiente, puedePagar, puedeCancelar, onChange,
}: {
  ocId: string;
  ocFolio: string;
  saldoPendiente: number;
  puedePagar: boolean;
  puedeCancelar: boolean;
  onChange: () => void;
}) {
  const fetchPagos = useServerFn(listPagosOC);
  const cancelarFn = useServerFn(cancelarPagoOC);
  const [openDialog, setOpenDialog] = useState(false);
  const qc = useQueryClient();

  const pagosQ = useQuery({
    queryKey: ["pagos-oc", ocId],
    queryFn: () => fetchPagos({ data: { ocId } }),
  });
  const pagos: any[] = pagosQ.data ?? [];

  const cancelMut = useMutation({
    mutationFn: (pagoId: string) => cancelarFn({ data: { pagoId } }),
    onSuccess: () => {
      toast.success("Pago cancelado");
      qc.invalidateQueries({ queryKey: ["pagos-oc", ocId] });
      qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <div className="border-t pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1">
          <Wallet className="size-4" /> Pagos
        </p>
        {puedePagar && (
          <Button size="sm" onClick={() => setOpenDialog(true)}>
            Registrar pago
          </Button>
        )}
      </div>

      {pagos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin pagos registrados.</p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Ref.</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                {puedeCancelar && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.fecha)}</TableCell>
                  <TableCell>{p.cuenta?.nombre}</TableCell>
                  <TableCell className="capitalize">{p.metodo}</TableCell>
                  <TableCell className="text-xs">{p.referencia ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{mxn(Number(p.monto))}</TableCell>
                  {puedeCancelar && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Cancelar pago"
                        onClick={() => {
                          if (confirm("¿Cancelar este pago? Se revertirá el saldo de la cuenta y de la OC.")) {
                            cancelMut.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-rose-600" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RegistrarPagoOCDialog
        ocId={ocId}
        ocFolio={ocFolio}
        saldoPendiente={saldoPendiente}
        open={openDialog}
        onOpenChange={setOpenDialog}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["pagos-oc", ocId] });
          qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
          onChange();
        }}
      />
    </div>
  );
}

function OCRecepcionButton({ ocId, onSaved }: { ocId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Registrar recepción
      </Button>
      {open && (
        <RecepcionDialog
          ocId={ocId}
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              qc.invalidateQueries({ queryKey: ["almacen"] });
              onSaved();
            }
          }}
        />
      )}
    </>
  );
}
