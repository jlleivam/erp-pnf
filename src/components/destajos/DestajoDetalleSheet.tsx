import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDestajo,
  crearOrdenCambioDestajo,
  enviarPresupuestoDestajo,
  autorizarPresupuestoDestajo,
  rechazarPresupuestoDestajo,
  reabrirPresupuestoDestajo,
  actualizarTerminosDestajo,
  getDestajoAnticipo,
  solicitarPagoAnticipoDestajo,
  cancelarSolicitudAnticipoDestajo,
} from "@/lib/api/destajos.functions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Send, CheckCircle2, XCircle, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";
import { CapturaDestajoSheet } from "./CapturaDestajoSheet";
import { CapturaOrdenCambioDestajoSheet } from "./CapturaOrdenCambioDestajoSheet";
import { AsignarTrabajadoresDialog } from "./AsignarTrabajadoresDialog";
import { EstimacionesDestajoTab } from "./EstimacionesDestajoTab";
import { RenglonesDestajoView } from "./RenglonesDestajoView";

type Presupuesto = {
  id: string;
  tipo: "base" | "adenda";
  numero: number;
  nombre: string;
  descripcion: string | null;
  estatus: "borrador" | "enviado" | "autorizado" | "rechazado";
  monto_total: number;
  rechazo_motivo: string | null;
  autorizado_at: string | null;
  enviado_at: string | null;
};

const ESTATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  enviado: "Por autorizar",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
};
const ESTATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "secondary",
  enviado: "outline",
  autorizado: "default",
  rechazado: "destructive",
};

export function DestajoDetalleSheet({
  destajoId,
  canAuthorize,
  onClose,
  onChanged,
}: {
  destajoId: string;
  canAuthorize: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const fetchDet = useServerFn(getDestajo);
  const q = useQuery({
    queryKey: ["destajo", destajoId],
    queryFn: () => fetchDet({ data: { id: destajoId } }),
  });

  const [editingBaseId, setEditingBaseId] = useState<string | null>(null);
  const [editingOcId, setEditingOcId] = useState<string | null>(null);
  const [asignar, setAsignar] = useState(false);
  const [creatingOc, setCreatingOc] = useState(false);
  const [rejecting, setRejecting] = useState<Presupuesto | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["destajo", destajoId] });
    onChanged?.();
  };

  const enviar = useServerFn(enviarPresupuestoDestajo);
  const enviarM = useMutation({
    mutationFn: enviar,
    onSuccess: () => { toast.success("Enviado a autorización"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const autorizar = useServerFn(autorizarPresupuestoDestajo);
  const autorizarM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => { toast.success("Autorizado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rechazar = useServerFn(rechazarPresupuestoDestajo);
  const rechazarM = useMutation({
    mutationFn: rechazar,
    onSuccess: () => { toast.success("Rechazado"); setRejecting(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reabrir = useServerFn(reabrirPresupuestoDestajo);
  const reabrirM = useMutation({
    mutationFn: reabrir,
    onSuccess: () => { toast.success("Reabierto como borrador"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const destajo = q.data?.destajo as any;
  const presupuestos = (q.data?.presupuestos ?? []) as Presupuesto[];
  const trabajadores = (q.data?.trabajadores ?? []) as any[];
  const base = presupuestos.find((p) => p.tipo === "base");
  const adendas = presupuestos.filter((p) => p.tipo === "adenda");
  const baseAutorizada = base?.estatus === "autorizado";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {destajo?.nombre ?? "Destajo"}
            {destajo && (
              <Badge variant={ESTATUS_VARIANT[destajo.estatus]}>
                {ESTATUS_LABEL[destajo.estatus]}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {destajo?.destajista?.nombre_completo
              ? `Destajista: ${destajo.destajista.nombre_completo}`
              : "Cargando destajista…"}
          </SheetDescription>
        </SheetHeader>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground mt-6">Cargando…</p>
        ) : (
          <div className="mt-6">
            <Tabs defaultValue="presupuesto">
              <TabsList>
                <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
                <TabsTrigger value="terminos">Términos</TabsTrigger>
                <TabsTrigger value="trabajadores">
                  Trabajadores ({trabajadores.length})
                </TabsTrigger>
                <TabsTrigger value="estimaciones" disabled={!baseAutorizada}>
                  Estimaciones
                </TabsTrigger>
              </TabsList>

              <TabsContent value="presupuesto" className="mt-4 space-y-4">
                {base && (
                  <div className="space-y-2">
                    <PresupuestoCard
                      p={base}
                      canAuthorize={canAuthorize}
                      onEdit={() => setEditingBaseId(base.id)}
                      onEnviar={() => enviarM.mutate({ data: { presupuestoId: base.id } })}
                      onAutorizar={() => autorizarM.mutate({ data: { presupuestoId: base.id } })}
                      onRechazar={() => setRejecting(base)}
                      onReabrir={() => reabrirM.mutate({ data: { presupuestoId: base.id } })}
                    />
                    <RenglonesDestajoView presupuestoDestajoId={base.id} />
                  </div>
                )}
                {baseAutorizada && (
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreatingOc(true)}
                    >
                      <Plus className="size-4 mr-1" /> Nueva orden de cambio
                    </Button>
                  </div>
                )}
                {adendas.map((oc) => (
                  <div key={oc.id} className="space-y-2">
                    <PresupuestoCard
                      p={oc}
                      canAuthorize={canAuthorize}
                      onEdit={() => setEditingOcId(oc.id)}
                      onEnviar={() => enviarM.mutate({ data: { presupuestoId: oc.id } })}
                      onAutorizar={() => autorizarM.mutate({ data: { presupuestoId: oc.id } })}
                      onRechazar={() => setRejecting(oc)}
                      onReabrir={() => reabrirM.mutate({ data: { presupuestoId: oc.id } })}
                    />
                    <RenglonesDestajoView presupuestoDestajoId={oc.id} />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="terminos" className="mt-4">
                <TerminosTab destajo={destajo} canEdit={!q.isLoading} onChanged={refresh} />
              </TabsContent>



              <TabsContent value="trabajadores" className="mt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Trabajadores asignados al destajo.
                  </p>
                  <Button size="sm" onClick={() => setAsignar(true)}>
                    <Users className="size-4 mr-1" /> Gestionar asignación
                  </Button>
                </div>
                {trabajadores.length === 0 ? (
                  <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
                    Sin trabajadores asignados.
                  </Card>
                ) : (
                  <Card className="divide-y">
                    {trabajadores.map((a) => {
                      const esDestajista = a.trabajador_id === destajo?.destajista_id;
                      return (
                        <div key={a.id} className="p-3 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{a.trabajador?.nombre_completo ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.trabajador?.puesto ?? "—"}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {esDestajista && <Badge>Destajista</Badge>}
                            <Badge variant="secondary">Activo</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                )}

              </TabsContent>

              <TabsContent value="estimaciones" className="mt-4">
                <EstimacionesDestajoTab destajoId={destajoId} />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {editingBaseId && (
          <CapturaDestajoSheet
            presupuestoDestajoId={editingBaseId}
            onClose={() => setEditingBaseId(null)}
            onSaved={() => { refresh(); }}
          />
        )}

        {editingOcId && (
          <CapturaOrdenCambioDestajoSheet
            destajoId={destajoId}
            presupuestoDestajoId={editingOcId}
            onClose={() => setEditingOcId(null)}
            onSaved={() => { refresh(); }}
          />
        )}

        {creatingOc && (
          <CrearOcDialog
            destajoId={destajoId}
            numeroSugerido={Math.max(0, ...adendas.map((a) => a.numero)) + 1}
            onClose={() => setCreatingOc(false)}
            onCreated={(id) => {
              setCreatingOc(false);
              refresh();
              setEditingOcId(id);
            }}
          />
        )}

        {asignar && (
          <AsignarTrabajadoresDialog
            destajoId={destajoId}
            destajistaId={destajo?.destajista_id}
            asignadosActuales={trabajadores.map((t) => t.trabajador_id)}
            onClose={() => setAsignar(false)}
            onSaved={() => { setAsignar(false); refresh(); }}
          />
        )}


        {rejecting && (
          <RechazarDialog
            presupuesto={rejecting}
            onClose={() => setRejecting(null)}
            onConfirm={(motivo) =>
              rechazarM.mutate({ data: { presupuestoId: rejecting.id, motivo } })
            }
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PresupuestoCard({
  p,
  canAuthorize,
  onEdit,
  onEnviar,
  onAutorizar,
  onRechazar,
  onReabrir,
}: {
  p: Presupuesto;
  canAuthorize: boolean;
  onEdit: () => void;
  onEnviar: () => void;
  onAutorizar: () => void;
  onRechazar: () => void;
  onReabrir: () => void;
}) {
  const label = p.tipo === "base" ? "Presupuesto base" : `Orden de cambio ${p.numero}`;
  const esOC = p.tipo === "adenda";
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{label}</p>
            <Badge variant={ESTATUS_VARIANT[p.estatus]}>{ESTATUS_LABEL[p.estatus]}</Badge>
          </div>
          {p.descripcion && (
            <p className="text-xs text-muted-foreground mt-1">{p.descripcion}</p>
          )}
          {((p.estatus === "rechazado") ||
            (p.tipo === "base" && p.estatus === "borrador" && p.rechazo_motivo)) &&
            p.rechazo_motivo && (
              <p className="text-xs text-destructive mt-1">
                Rechazado · Motivo: {p.rechazo_motivo}
              </p>
            )}

        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold ${esOC && Number(p.monto_total) < 0 ? "text-destructive" : ""}`}>
            {esOC ? "Δ " : ""}{formatMXN(p.monto_total)}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-4 flex-wrap">
        {p.estatus === "borrador" && (
          <>
            <Button size="sm" onClick={onEdit}>Editar</Button>
            <Button size="sm" variant="outline" onClick={onEnviar}>
              <Send className="size-4 mr-1" /> Solicitar autorización
            </Button>
          </>
        )}
        {p.estatus === "enviado" && canAuthorize && (
          <>
            <Button size="sm" onClick={onAutorizar}>
              <CheckCircle2 className="size-4 mr-1" /> Autorizar
            </Button>
            <Button size="sm" variant="outline" onClick={onRechazar}>
              <XCircle className="size-4 mr-1" /> Rechazar
            </Button>
          </>
        )}
        {p.estatus === "enviado" && !canAuthorize && (
          <p className="text-xs text-muted-foreground">
            Esperando autorización del supervisor.
          </p>
        )}
        {p.estatus === "rechazado" && (
          <Button size="sm" variant="outline" onClick={onReabrir}>
            <RefreshCw className="size-4 mr-1" /> Reabrir como borrador
          </Button>
        )}
        {(p.estatus === "autorizado" || p.estatus === "enviado") && (
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Ver detalle
          </Button>
        )}
      </div>
    </Card>
  );
}

function RechazarDialog({
  presupuesto,
  onClose,
  onConfirm,
}: {
  presupuesto: Presupuesto;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar {presupuesto.nombre}</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Motivo del rechazo</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explica por qué se rechaza…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={motivo.trim().length < 3}
            onClick={() => onConfirm(motivo.trim())}
          >
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CrearOcDialog({
  destajoId,
  numeroSugerido,
  onClose,
  onCreated,
}: {
  destajoId: string;
  numeroSugerido: number;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(`Orden de cambio ${numeroSugerido}`);
  const [descripcion, setDescripcion] = useState("");
  const crear = useServerFn(crearOrdenCambioDestajo);
  const m = useMutation({
    mutationFn: crear,
    onSuccess: (res) => onCreated(res.id),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva orden de cambio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Motivo / descripción</Label>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending || !nombre.trim()}
            onClick={() =>
              m.mutate({
                data: {
                  destajoId,
                  nombre: nombre.trim(),
                  descripcion: descripcion.trim() || undefined,
                },
              })
            }
          >
            {m.isPending ? "Creando…" : "Crear OC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TerminosTab({
  destajo,
  canEdit,
  onChanged,
}: {
  destajo: any;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const fetchAnt = useServerFn(getDestajoAnticipo);
  const antQ = useQuery({
    queryKey: ["destajo-anticipo", destajo?.id],
    queryFn: () => fetchAnt({ data: { destajoId: destajo!.id } }),
    enabled: !!destajo?.id,
  });

  const [editing, setEditing] = useState(false);
  const [anticipoPct, setAnticipoPct] = useState<string>(String(destajo?.anticipo_pct ?? 0));
  const [fondoPct, setFondoPct] = useState<string>(String(destajo?.fondo_garantia_pct ?? 0));

  const update = useServerFn(actualizarTerminosDestajo);
  const updM = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Términos actualizados");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["destajo-anticipo", destajo?.id] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marcar = useServerFn(marcarAnticipoPagado);
  const marcarM = useMutation({
    mutationFn: marcar,
    onSuccess: () => {
      toast.success("Anticipo marcado como pagado");
      qc.invalidateQueries({ queryKey: ["destajo-anticipo", destajo?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!destajo) return null;
  const anticipoPctNum = Number(destajo.anticipo_pct ?? 0);
  const anticipoMonto = Number(destajo.anticipo_monto ?? 0);
  const fondoPctNum = Number(destajo.fondo_garantia_pct ?? 0);
  const antData = antQ.data;
  const anticipoRegistro = antData?.anticipo;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Anticipo</p>
            <p className="text-lg font-semibold">
              {anticipoPctNum.toFixed(2)}% · {formatMXN(anticipoMonto)}
            </p>
            {anticipoMonto > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Amortizado: {formatMXN(antData?.anticipoAmortizado ?? 0)} · Saldo:{" "}
                {formatMXN(Math.max(0, anticipoMonto - (antData?.anticipoAmortizado ?? 0)))}
              </p>
            )}
            {anticipoRegistro && (
              <p className="text-xs mt-1">
                {anticipoRegistro.pagado ? (
                  <Badge>Pagado</Badge>
                ) : (
                  <Badge variant="secondary">Pendiente de pago</Badge>
                )}
              </p>
            )}
          </div>
          {anticipoMonto > 0 && anticipoRegistro && !anticipoRegistro.pagado && (
            <Button
              size="sm"
              disabled={marcarM.isPending}
              onClick={() => marcarM.mutate({ data: { destajoId: destajo.id } })}
            >
              Marcar pagado
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Fondo de garantía</p>
        <p className="text-lg font-semibold">{fondoPctNum.toFixed(2)}% por estimación</p>
        <p className="text-xs text-muted-foreground mt-1">
          Retenido: {formatMXN(antData?.fondoRetenido ?? 0)} · Liberado:{" "}
          {formatMXN(antData?.fondoLiberado ?? 0)} · Saldo:{" "}
          {formatMXN(antData?.fondoSaldo ?? 0)}
        </p>
      </Card>

      {!editing ? (
        <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => setEditing(true)}>
          Editar términos
        </Button>
      ) : (
        <Card className="p-4 space-y-3">
          <div>
            <Label className="text-sm">Anticipo (%)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={100}
              value={anticipoPct}
              onChange={(e) => setAnticipoPct(e.target.value)}
              className="w-32 mt-1"
            />
          </div>
          <div>
            <Label className="text-sm">Fondo de garantía (%)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={100}
              value={fondoPct}
              onChange={(e) => setFondoPct(e.target.value)}
              className="w-32 mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={updM.isPending}
              onClick={() =>
                updM.mutate({
                  data: {
                    destajoId: destajo.id,
                    anticipoPct: Number(anticipoPct || 0),
                    fondoGarantiaPct: Number(fondoPct || 0),
                  },
                })
              }
            >
              {updM.isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
          {anticipoRegistro?.pagado && (
            <p className="text-xs text-destructive">
              El anticipo ya fue marcado como pagado; no podrás cambiar el %.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

