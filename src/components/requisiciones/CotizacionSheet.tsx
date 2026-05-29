import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileText, Send } from "lucide-react";
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
  getCotizacionRequisicion, listProveedores, enviarOCASupervisor, reabrirOC,
} from "@/lib/api/cotizaciones.functions";
import { getSolicitudesRequisicion } from "@/lib/api/solicitudes-cotizacion.functions";
import { SolicitudesTab } from "./SolicitudesTab";
import { ComparativaTable } from "./ComparativaTable";
import { useEffectiveRoles } from "@/stores/auth";

export type CotizacionTab = "requisicion" | "solicitudes" | "comparativa" | "ocs";

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
  rechazada: { label: "Rechazada", className: "bg-rose-100 text-rose-800" },
  pagada: { label: "Pagada", className: "bg-blue-100 text-blue-800" },
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
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="requisicion">Requisición</TabsTrigger>
              <TabsTrigger value="solicitudes">Cotizaciones ({(solsQ.data ?? []).length})</TabsTrigger>
              <TabsTrigger value="comparativa">Comparativa</TabsTrigger>
              <TabsTrigger value="ocs">OCs ({ocs.length})</TabsTrigger>
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
              />
            </TabsContent>

            <TabsContent value="comparativa" className="mt-4">
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
                const meta = OC_BADGE[oc.estatus];
                const items = oc.paquete?.items ?? [];
                return (
                  <Card key={oc.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{oc.folio}</p>
                          <Badge className={meta?.className}>{meta?.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{oc.proveedor?.razon_social}</p>
                      </div>
                      <p className="text-lg font-semibold">{mxn(Number(oc.total))}</p>
                    </div>

                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Insumo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">P. Unit</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((it: any) => (
                            <TableRow key={it.id}>
                              <TableCell>{it.insumo?.nombre}</TableCell>
                              <TableCell className="text-right">{Number(it.cantidad)} {it.insumo?.unidad}</TableCell>
                              <TableCell className="text-right">{mxn(Number(it.precio_unitario))}</TableCell>
                              <TableCell className="text-right">{mxn(Number(it.subtotal))}</TableCell>
                            </TableRow>
                          ))}
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
                        Enviada al supervisor · {oc.enviada_at ? formatDate(oc.enviada_at) : "—"}
                      </p>
                    )}
                    {oc.estatus === "autorizada" && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="size-4" /> Autorizada {oc.autorizada_at ? `· ${formatDate(oc.autorizada_at)}` : ""}
                        </p>
                        <Button size="sm" disabled title="Próximamente">Registrar pago</Button>
                      </div>
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
