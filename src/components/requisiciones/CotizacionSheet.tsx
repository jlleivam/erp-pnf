import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Send, AlertCircle, CheckCircle2, FileText, Edit } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  getCotizacionRequisicion, listProveedores, guardarPaquete,
  eliminarPaquete, generarOC, enviarOCASupervisor, reabrirOC,
} from "@/lib/api/cotizaciones.functions";
import { getSolicitudesRequisicion } from "@/lib/api/solicitudes-cotizacion.functions";
import { SolicitudesTab } from "./SolicitudesTab";
import { ComparativaTable } from "./ComparativaTable";

export type CotizacionTab = "solicitudes" | "comparativa" | "paquetes" | "ocs";

interface Props {
  requisicionId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTab?: CotizacionTab;
}

type DraftItem = { insumo_id: string; cantidad: number; precio_unitario: number };
type DraftPaquete = {
  id: string | null;
  numero: number;
  proveedor_id: string | null;
  items: DraftItem[];
  dirty: boolean;
};

const OC_BADGE: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  pendiente_autorizacion: { label: "Pendiente autorización", className: "bg-amber-100 text-amber-800" },
  autorizada: { label: "Autorizada", className: "bg-emerald-100 text-emerald-800" },
  rechazada: { label: "Rechazada", className: "bg-rose-100 text-rose-800" },
  pagada: { label: "Pagada", className: "bg-blue-100 text-blue-800" },
};

const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function CotizacionSheet({ requisicionId, open, onOpenChange, initialTab = "solicitudes" }: Props) {
  const qc = useQueryClient();
  const fetchCot = useServerFn(getCotizacionRequisicion);
  const fetchProv = useServerFn(listProveedores);
  const fetchSols = useServerFn(getSolicitudesRequisicion);
  const guardarFn = useServerFn(guardarPaquete);
  const eliminarFn = useServerFn(eliminarPaquete);
  const generarFn = useServerFn(generarOC);
  const enviarFn = useServerFn(enviarOCASupervisor);
  const reabrirFn = useServerFn(reabrirOC);

  const [tab, setTab] = useState<CotizacionTab>(initialTab);
  const [drafts, setDrafts] = useState<DraftPaquete[]>([]);
  const [hydrated, setHydrated] = useState(false);

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

  // Hidratar drafts cuando llega la data
  useMemo(() => {
    if (!cotQ.data || hydrated) return;
    const paquetes = (cotQ.data as any).paquetes ?? [];
    setDrafts(paquetes.map((p: any) => ({
      id: p.id,
      numero: p.numero,
      proveedor_id: p.proveedor_id,
      items: (p.items ?? []).map((it: any) => ({
        insumo_id: it.insumo_id,
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario ?? 0),
      })),
      dirty: false,
    })));
    setHydrated(true);
  }, [cotQ.data, hydrated]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cotizacion", requisicionId] });
    qc.invalidateQueries({ queryKey: ["requisiciones"] });
    setHydrated(false);
  };

  if (!open) return null;

  const req = (cotQ.data as any)?.requisicion;
  const reqItems: any[] = req?.items ?? [];
  const ocs: any[] = (cotQ.data as any)?.ocs ?? [];
  const proveedores: any[] = provQ.data ?? [];

  // insumos usados en otros paquetes (drafts en memoria)
  const insumosUsadosEnOtros = (draftIdx: number) => {
    const set = new Set<string>();
    drafts.forEach((p, i) => {
      if (i === draftIdx) return;
      p.items.forEach((it) => set.add(it.insumo_id));
    });
    return set;
  };

  const totalRequisicion = drafts.reduce(
    (s, p) => s + p.items.reduce((ss, it) => ss + it.cantidad * it.precio_unitario, 0), 0
  );
  const insumosCubiertos = new Set<string>();
  drafts.forEach((p) => p.items.forEach((it) => insumosCubiertos.add(it.insumo_id)));

  const handleAddPaquete = () => {
    setDrafts((d) => [...d, {
      id: null,
      numero: (d[d.length - 1]?.numero ?? 0) + 1,
      proveedor_id: null,
      items: [],
      dirty: true,
    }]);
  };

  const handleAddInsumo = (idx: number, insumoId: string) => {
    const reqItem = reqItems.find((r) => r.insumo?.id === insumoId);
    if (!reqItem) return;
    setDrafts((d) => d.map((p, i) => i === idx ? {
      ...p,
      items: [...p.items, {
        insumo_id: insumoId,
        cantidad: Number(reqItem.cantidad),
        precio_unitario: 0,
      }],
      dirty: true,
    } : p));
  };

  const handleRemoveInsumo = (idx: number, insumoId: string) => {
    setDrafts((d) => d.map((p, i) => i === idx ? {
      ...p, items: p.items.filter((it) => it.insumo_id !== insumoId), dirty: true,
    } : p));
  };

  const handlePrecio = (idx: number, insumoId: string, precio: number) => {
    setDrafts((d) => d.map((p, i) => i === idx ? {
      ...p,
      items: p.items.map((it) => it.insumo_id === insumoId ? { ...it, precio_unitario: precio } : it),
      dirty: true,
    } : p));
  };

  const handleProveedor = (idx: number, provId: string) => {
    setDrafts((d) => d.map((p, i) => i === idx ? { ...p, proveedor_id: provId, dirty: true } : p));
  };

  const handleRemovePaquete = async (idx: number) => {
    const p = drafts[idx];
    if (p.id) {
      try {
        await eliminarFn({ data: { paqueteId: p.id } });
        toast.success("Paquete eliminado");
        invalidate();
      } catch (e: any) {
        toast.error(e?.message ?? "Error");
        return;
      }
    } else {
      setDrafts((d) => d.filter((_, i) => i !== idx));
    }
  };

  const guardarMut = useMutation({
    mutationFn: async (idx: number) => {
      const p = drafts[idx];
      return guardarFn({
        data: {
          requisicionId,
          paqueteId: p.id ?? undefined,
          proveedorId: p.proveedor_id,
          insumos: p.items,
        },
      });
    },
    onSuccess: () => { toast.success("Paquete guardado"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const generarMut = useMutation({
    mutationFn: async (idx: number) => {
      const p = drafts[idx];
      // guardar antes
      const r = await guardarFn({
        data: {
          requisicionId,
          paqueteId: p.id ?? undefined,
          proveedorId: p.proveedor_id,
          insumos: p.items,
        },
      });
      const paqueteId = (r as any).id ?? p.id;
      return generarFn({ data: { paqueteId } });
    },
    onSuccess: () => { toast.success("OC creada en borrador"); setTab("ocs"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cotización · {req?.folio ?? "—"}</SheetTitle>
          <SheetDescription>
            Arma paquetes por proveedor y genera órdenes de compra para autorización
          </SheetDescription>
        </SheetHeader>

        {cotQ.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as CotizacionTab)} className="mt-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="solicitudes">Cotizaciones ({(solsQ.data ?? []).length})</TabsTrigger>
              <TabsTrigger value="comparativa">Comparativa</TabsTrigger>
              <TabsTrigger value="paquetes">Paquetes</TabsTrigger>
              <TabsTrigger value="ocs">OCs ({ocs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="solicitudes" className="mt-4">
              <SolicitudesTab
                requisicionId={requisicionId}
                reqItems={reqItems}
                proveedores={proveedores}
                solicitudes={solsQ.data ?? []}
              />
            </TabsContent>

            <TabsContent value="comparativa" className="mt-4">
              <ComparativaTable reqItems={reqItems} solicitudes={solsQ.data ?? []} />
            </TabsContent>

            <TabsContent value="paquetes" className="space-y-4 mt-4">
              <Card className="p-3 bg-muted/40 border-dashed">
                <p className="text-sm flex items-start gap-2">
                  <AlertCircle className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>Agrupa los insumos en paquetes por proveedor. Cada paquete generará una OC independiente para autorización del supervisor.</span>
                </p>
              </Card>

              {drafts.map((p, idx) => {
                const usados = insumosUsadosEnOtros(idx);
                const disponibles = reqItems.filter(
                  (r) => !usados.has(r.insumo.id) && !p.items.find((it) => it.insumo_id === r.insumo.id)
                );
                const totalPaquete = p.items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);
                const oc = ocs.find((o) => o.paquete_id === p.id);
                const locked = oc && oc.estatus !== "borrador" && oc.estatus !== "rechazada";
                const puedeGenerar = !!p.proveedor_id && p.items.length > 0 && p.items.some((it) => it.precio_unitario > 0);

                return (
                  <Card key={p.id ?? `new-${idx}`} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-foreground">Paquete {p.numero}</h3>
                      <div className="flex gap-2">
                        {oc && (
                          <Badge className={OC_BADGE[oc.estatus]?.className}>
                            OC {oc.folio}
                          </Badge>
                        )}
                        {!locked && (
                          <Button size="sm" variant="ghost" onClick={() => handleRemovePaquete(idx)}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Proveedor</label>
                      <Select
                        value={p.proveedor_id ?? undefined}
                        onValueChange={(v) => handleProveedor(idx, v)}
                        disabled={!!locked}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecciona proveedor" /></SelectTrigger>
                        <SelectContent>
                          {proveedores.map((pr: any) => (
                            <SelectItem key={pr.id} value={pr.id}>{pr.razon_social}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Insumo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="w-36">P. Unitario</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {p.items.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-4">
                                Sin insumos en este paquete
                              </TableCell>
                            </TableRow>
                          )}
                          {p.items.map((it) => {
                            const ri = reqItems.find((r) => r.insumo.id === it.insumo_id);
                            return (
                              <TableRow key={it.insumo_id}>
                                <TableCell>{ri?.insumo.nombre ?? "—"}</TableCell>
                                <TableCell className="text-right">
                                  {it.cantidad} {ri?.insumo.unidad}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={it.precio_unitario || ""}
                                    disabled={!!locked}
                                    onChange={(e) => handlePrecio(idx, it.insumo_id, Number(e.target.value) || 0)}
                                  />
                                </TableCell>
                                <TableCell className="text-right">{mxn(it.cantidad * it.precio_unitario)}</TableCell>
                                <TableCell>
                                  {!locked && (
                                    <Button size="sm" variant="ghost" onClick={() => handleRemoveInsumo(idx, it.insumo_id)}>
                                      <Trash2 className="size-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {!locked && disponibles.length > 0 && (
                      <Select value="" onValueChange={(v) => handleAddInsumo(idx, v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="+ Agregar insumo al paquete" />
                        </SelectTrigger>
                        <SelectContent>
                          {disponibles.map((r) => (
                            <SelectItem key={r.insumo.id} value={r.insumo.id}>
                              {r.insumo.nombre} ({r.cantidad} {r.insumo.unidad})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium">Total paquete: {mxn(totalPaquete)}</span>
                      <div className="flex gap-2">
                        {!locked && p.dirty && (
                          <Button size="sm" variant="outline" onClick={() => guardarMut.mutate(idx)} disabled={guardarMut.isPending}>
                            Guardar
                          </Button>
                        )}
                        {!locked && (
                          <Button
                            size="sm"
                            onClick={() => generarMut.mutate(idx)}
                            disabled={!puedeGenerar || generarMut.isPending}
                          >
                            <FileText className="size-4 mr-1" />
                            {oc?.estatus === "rechazada" ? "Regenerar OC" : "Generar OC"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              <Button variant="outline" className="w-full" onClick={handleAddPaquete}>
                <Plus className="size-4 mr-1" /> Agregar paquete con otro proveedor
              </Button>

              <Card className="p-3 flex items-center justify-between bg-muted/40">
                <span className="text-sm">
                  <strong>{insumosCubiertos.size}</strong> de <strong>{reqItems.length}</strong> insumos cubiertos
                </span>
                <span className="text-sm font-semibold">Total: {mxn(totalRequisicion)}</span>
              </Card>
            </TabsContent>

            <TabsContent value="ocs" className="space-y-3 mt-4">
              {ocs.length === 0 && (
                <Card className="p-8 text-center border-dashed">
                  <FileText className="size-8 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Aún no hay órdenes de compra</p>
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
                        <Button size="sm" variant="outline" onClick={() => setTab("cotizar")}>
                          <Edit className="size-4 mr-1" /> Editar
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
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => reabrirMut.mutate(oc.id)} disabled={reabrirMut.isPending}>
                            Revisar y reenviar
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
