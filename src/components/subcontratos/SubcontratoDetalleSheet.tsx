import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSubcontrato,
  crearOrdenCambioSubcontrato,
  enviarPresupuestoSubcontrato,
  autorizarPresupuestoSubcontrato,
  rechazarPresupuestoSubcontrato,
  reabrirPresupuestoSubcontrato,
  
  getSubcontratoAnticipo,
  solicitarPagoAnticipoSubcontrato,
  cancelarSolicitudAnticipoSubcontrato,
} from "@/lib/api/subcontratos.functions";
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
import { Plus, Send, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";
import { CapturaSubcontratoSheet } from "./CapturaSubcontratoSheet";
import { CapturaOrdenCambioSubcontratoSheet } from "./CapturaOrdenCambioSubcontratoSheet";
import { EstimacionesSubcontratoTab } from "./EstimacionesSubcontratoTab";

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
  enviado: "Pendiente autorización",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
};
const ESTATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "secondary",
  enviado: "outline",
  autorizado: "default",
  rechazado: "destructive",
};

export function SubcontratoDetalleSheet({
  subcontratoId,
  canAuthorize,
  onClose,
  onChanged,
}: {
  subcontratoId: string;
  canAuthorize: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const fetchDet = useServerFn(getSubcontrato);
  const q = useQuery({
    queryKey: ["subcontrato", subcontratoId],
    queryFn: () => fetchDet({ data: { id: subcontratoId } }),
  });

  const [editingBaseId, setEditingBaseId] = useState<string | null>(null);
  const [editingOcId, setEditingOcId] = useState<string | null>(null);
  const [creatingOc, setCreatingOc] = useState(false);
  const [rejecting, setRejecting] = useState<Presupuesto | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["subcontrato", subcontratoId] });
    onChanged?.();
  };

  const enviar = useServerFn(enviarPresupuestoSubcontrato);
  const enviarM = useMutation({
    mutationFn: enviar,
    onSuccess: () => { toast.success("Enviado a autorización"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const autorizar = useServerFn(autorizarPresupuestoSubcontrato);
  const autorizarM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => { toast.success("Autorizado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rechazar = useServerFn(rechazarPresupuestoSubcontrato);
  const rechazarM = useMutation({
    mutationFn: rechazar,
    onSuccess: () => { toast.success("Rechazado"); setRejecting(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reabrir = useServerFn(reabrirPresupuestoSubcontrato);
  const reabrirM = useMutation({
    mutationFn: reabrir,
    onSuccess: () => { toast.success("Reabierto como borrador"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const subcontrato = q.data?.subcontrato as any;
  const presupuestos = (q.data?.presupuestos ?? []) as Presupuesto[];
  const base = presupuestos.find((p) => p.tipo === "base");
  const adendas = presupuestos.filter((p) => p.tipo === "adenda");
  const baseAutorizada = base?.estatus === "autorizado";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {subcontrato?.nombre ?? "Subcontrato"}
            {subcontrato && (
              <Badge variant={ESTATUS_VARIANT[subcontrato.estatus]}>
                {ESTATUS_LABEL[subcontrato.estatus]}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {subcontrato?.contratista?.razon_social
              ? `Contratista: ${subcontrato.contratista.razon_social}`
              : "Cargando contratista…"}
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
                <TabsTrigger value="estimaciones" disabled={!baseAutorizada}>
                  Estimaciones
                </TabsTrigger>
              </TabsList>

              <TabsContent value="presupuesto" className="mt-4 space-y-3">
                {base && (
                  <PresupuestoCard
                    p={base}
                    canAuthorize={canAuthorize}
                    onEdit={() => setEditingBaseId(base.id)}
                    onEnviar={() => enviarM.mutate({ data: { presupuestoId: base.id } })}
                    onAutorizar={() => autorizarM.mutate({ data: { presupuestoId: base.id } })}
                    onRechazar={() => setRejecting(base)}
                    onReabrir={() => reabrirM.mutate({ data: { presupuestoId: base.id } })}
                  />
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
                  <PresupuestoCard
                    key={oc.id}
                    p={oc}
                    canAuthorize={canAuthorize}
                    onEdit={() => setEditingOcId(oc.id)}
                    onEnviar={() => enviarM.mutate({ data: { presupuestoId: oc.id } })}
                    onAutorizar={() => autorizarM.mutate({ data: { presupuestoId: oc.id } })}
                    onRechazar={() => setRejecting(oc)}
                    onReabrir={() => reabrirM.mutate({ data: { presupuestoId: oc.id } })}
                  />
                ))}
              </TabsContent>

              <TabsContent value="terminos" className="mt-4">
                <TerminosTab subcontrato={subcontrato} canEdit={!q.isLoading} onChanged={refresh} />
              </TabsContent>

              <TabsContent value="estimaciones" className="mt-4">
                <EstimacionesSubcontratoTab
                  subcontratoId={subcontratoId}
                  obraId={subcontrato?.obra_id ?? null}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {editingBaseId && (
          <CapturaSubcontratoSheet
            presupuestoSubcontratoId={editingBaseId}
            onClose={() => setEditingBaseId(null)}
            onSaved={() => { refresh(); }}
          />
        )}

        {editingOcId && (
          <CapturaOrdenCambioSubcontratoSheet
            subcontratoId={subcontratoId}
            presupuestoSubcontratoId={editingOcId}
            onClose={() => setEditingOcId(null)}
            onSaved={() => { refresh(); }}
          />
        )}

        {creatingOc && (
          <CrearOcDialog
            subcontratoId={subcontratoId}
            numeroSugerido={Math.max(0, ...adendas.map((a) => a.numero)) + 1}
            onClose={() => setCreatingOc(false)}
            onCreated={(id) => {
              setCreatingOc(false);
              refresh();
              setEditingOcId(id);
            }}
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
          {p.estatus === "rechazado" && p.rechazo_motivo && (
            <p className="text-xs text-destructive mt-1">Motivo: {p.rechazo_motivo}</p>
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
  subcontratoId,
  numeroSugerido,
  onClose,
  onCreated,
}: {
  subcontratoId: string;
  numeroSugerido: number;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(`Orden de cambio ${numeroSugerido}`);
  const [descripcion, setDescripcion] = useState("");
  const crear = useServerFn(crearOrdenCambioSubcontrato);
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
                  subcontratoId,
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
  subcontrato,
  canEdit,
  onChanged,
}: {
  subcontrato: any;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const fetchAnt = useServerFn(getSubcontratoAnticipo);
  const antQ = useQuery({
    queryKey: ["subcontrato-anticipo", subcontrato?.id],
    queryFn: () => fetchAnt({ data: { subcontratoId: subcontrato!.id } }),
    enabled: !!subcontrato?.id,
  });

  const [editing, setEditing] = useState(false);
  const [anticipoPct, setAnticipoPct] = useState<string>(String(subcontrato?.anticipo_pct ?? 0));
  const [fondoPct, setFondoPct] = useState<string>(String(subcontrato?.fondo_garantia_pct ?? 0));

  const update = useServerFn(actualizarTerminosSubcontrato);
  const updM = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Términos actualizados");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["subcontrato-anticipo", subcontrato?.id] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const solicitar = useServerFn(solicitarPagoAnticipoSubcontrato);
  const cancelar = useServerFn(cancelarSolicitudAnticipoSubcontrato);
  const [solicitNotas, setSolicitNotas] = useState<string>("");
  const [solicitOpen, setSolicitOpen] = useState(false);
  const solicitarM = useMutation({
    mutationFn: solicitar,
    onSuccess: () => {
      toast.success("Solicitud de pago enviada");
      setSolicitOpen(false);
      setSolicitNotas("");
      qc.invalidateQueries({ queryKey: ["subcontrato-anticipo", subcontrato?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelarM = useMutation({
    mutationFn: cancelar,
    onSuccess: () => {
      toast.success("Solicitud cancelada");
      qc.invalidateQueries({ queryKey: ["subcontrato-anticipo", subcontrato?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!subcontrato) return null;
  const anticipoPctNum = Number(subcontrato.anticipo_pct ?? 0);
  const anticipoMonto = Number(subcontrato.anticipo_monto ?? 0);
  const fondoPctNum = Number(subcontrato.fondo_garantia_pct ?? 0);
  const antData = antQ.data;
  const anticipoRegistro = antData?.anticipo;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
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
              <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                {anticipoRegistro.pagado ? (
                  <>
                    <Badge>Anticipo pagado</Badge>
                    {(anticipoRegistro.pagado_at || anticipoRegistro.fecha) && (
                      <span className="text-muted-foreground">
                        el {new Date(anticipoRegistro.pagado_at ?? anticipoRegistro.fecha).toLocaleDateString("es-MX")}
                      </span>
                    )}
                    {(anticipoRegistro as any).pagado_por_nombre && (
                      <span className="text-muted-foreground">
                        · pagado por {(anticipoRegistro as any).pagado_por_nombre}
                      </span>
                    )}
                  </>
                ) : anticipoRegistro.solicitado_at ? (
                  <>
                    <Badge variant="secondary">Solicitado</Badge>
                    <span className="text-muted-foreground">
                      el {new Date(anticipoRegistro.solicitado_at).toLocaleDateString("es-MX")}
                    </span>
                  </>
                ) : (
                  <Badge variant="outline">Por solicitar</Badge>
                )}
              </div>
            )}

            {anticipoRegistro?.solicitud_notas && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                "{anticipoRegistro.solicitud_notas}"
              </p>
            )}
          </div>
          {anticipoMonto > 0 && anticipoRegistro && !anticipoRegistro.pagado && (
            <div className="flex gap-2">
              {!anticipoRegistro.solicitado_at ? (
                <Button
                  size="sm"
                  disabled={!canEdit}
                  onClick={() => setSolicitOpen(true)}
                >
                  Solicitar pago
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancelarM.isPending}
                  onClick={() => cancelarM.mutate({ data: { subcontratoId: subcontrato.id } })}
                >
                  Cancelar solicitud
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <Dialog open={solicitOpen} onOpenChange={setSolicitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pago de anticipo de subcontrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Subcontrato</span>
                <span className="font-medium text-right">{subcontrato.nombre}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Contratista</span>
                <span className="font-medium text-right">
                  {subcontrato?.contratista?.razon_social ?? "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Fecha</span>
                <span className="font-medium text-right">
                  {new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Folio</span>
                <span className="text-muted-foreground italic text-right">Se asignará al enviar</span>
              </div>
            </div>
            <div>
              <Label className="text-sm">Notas para administrativo (opcional)</Label>
              <Textarea
                value={solicitNotas}
                onChange={(e) => setSolicitNotas(e.target.value)}
                rows={3}
                placeholder="Detalles, urgencia, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSolicitOpen(false)}>Cancelar</Button>
            <Button
              disabled={solicitarM.isPending}
              onClick={() => solicitarM.mutate({ data: { subcontratoId: subcontrato.id, notas: solicitNotas.trim() || undefined } })}
            >
              {solicitarM.isPending ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    subcontratoId: subcontrato.id,
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
