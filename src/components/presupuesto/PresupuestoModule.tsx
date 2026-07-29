import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPresupuestos,
  crearPresupuesto,
  eliminarPresupuesto,
  solicitarAutorizacionPresupuesto,
  autorizarPresupuesto,
  rechazarPresupuesto,
  reabrirPresupuesto,
} from "@/lib/api/presupuestos.functions";
import { usePermisos } from "@/hooks/usePermisos";
import { useAuthStore } from "@/stores/auth";


import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Trash2, Eye, Send, Check, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { CapturaPresupuestoSheet } from "./CapturaPresupuestoSheet";
import { CapturaOrdenCambioSheet } from "./CapturaOrdenCambioSheet";
import { VerPresupuestoSheet } from "./VerPresupuestoSheet";
import { VerVigenteSheet } from "./VerVigenteSheet";
import { formatMXN } from "@/lib/format";
const formatCurrency = formatMXN;

type EstatusPresupuesto = "borrador" | "solicitada" | "autorizado" | "rechazada";

type Presupuesto = {
  id: string;
  tipo: "base" | "adenda";
  numero: number;
  nombre: string;
  descripcion: string | null;
  estatus: EstatusPresupuesto;
  monto_total: number;
  enviado_at?: string | null;
  enviado_por?: string | null;
  autorizado_at: string | null;
  autorizado_por?: string | null;
  rechazado_at?: string | null;
  rechazado_por?: string | null;
  rechazo_motivo?: string | null;
  created_at: string;
};

function estatusLabel(e: EstatusPresupuesto) {
  switch (e) {
    case "borrador":
      return "Borrador";
    case "solicitada":
      return "Solicitada";
    case "autorizado":
      return "Autorizada";
    case "rechazada":
      return "Rechazada";
  }
}

function estatusVariant(e: EstatusPresupuesto): "default" | "secondary" | "destructive" | "outline" {
  switch (e) {
    case "autorizado":
      return "default";
    case "solicitada":
      return "outline";
    case "rechazada":
      return "destructive";
    default:
      return "secondary";
  }
}

export function PresupuestoModule({ obraId }: { obraId: string }) {
  const { can } = usePermisos();
  const userId = useAuthStore((s) => s.userId);

  const qc = useQueryClient();
  const fetchList = useServerFn(listPresupuestos);
  const listQ = useQuery({
    queryKey: ["presupuestos", obraId],
    queryFn: () => fetchList({ data: { obraId } }),
  });

  const search = useSearch({ strict: false }) as { tab?: string; ver?: string };
  const navigate = useNavigate();

  const [creating, setCreating] = useState<null | "base" | "adenda">(null);
  const [editing, setEditing] = useState<{ id: string; tipo: "base" | "adenda" } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [verVigente, setVerVigente] = useState(false);
  const [toDelete, setToDelete] = useState<Presupuesto | null>(null);
  const [rechazando, setRechazando] = useState<Presupuesto | null>(null);
  const [tab, setTab] = useState<string>(search.tab === "adendas" ? "adendas" : "base");

  // Auto-open OC from notification link (?ver=<id>&tab=adendas)
  useEffect(() => {
    if (search.ver) {
      setViewing(search.ver);
      if (search.tab === "adendas") setTab("adendas");
      // Limpiar search params para que cerrar el sheet no lo vuelva a abrir
      navigate({
        to: ".",
        search: (prev: any) => ({ ...prev, ver: undefined, tab: undefined }),
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.ver]);


  const remove = useServerFn(eliminarPresupuesto);
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Presupuesto eliminado");
      qc.invalidateQueries({ queryKey: ["presupuestos", obraId] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const solicitar = useServerFn(solicitarAutorizacionPresupuesto);
  const solicitarM = useMutation({
    mutationFn: solicitar,
    onSuccess: () => {
      toast.success("Solicitud enviada al supervisor");
      qc.invalidateQueries({ queryKey: ["presupuestos", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autorizar = useServerFn(autorizarPresupuesto);
  const autorizarM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => {
      toast.success("Orden de cambio autorizada");
      qc.invalidateQueries({ queryKey: ["presupuestos", obraId] });
      qc.invalidateQueries({ queryKey: ["presupuesto-vigente", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reabrir = useServerFn(reabrirPresupuesto);
  const reabrirM = useMutation({
    mutationFn: reabrir,
    onSuccess: () => {
      toast.success("OC reabierta a borrador");
      qc.invalidateQueries({ queryKey: ["presupuestos", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const presupuestos = (listQ.data ?? []) as Presupuesto[];
  const base = presupuestos.find((p) => p.tipo === "base");
  const adendas = presupuestos.filter((p) => p.tipo === "adenda");
  const totalBase = base?.estatus === "autorizado" ? base.monto_total : 0;
  const totalAdendas = adendas
    .filter((a) => a.estatus === "autorizado")
    .reduce((s, a) => s + Number(a.monto_total), 0);
  const totalVigente = totalBase + totalAdendas;

  const puedeCrearOC = director || isResidente;

  const refresh = () => qc.invalidateQueries({ queryKey: ["presupuestos", obraId] });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presupuesto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Presupuesto base + órdenes de cambio. El residente solicita y el supervisor autoriza.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {base?.estatus === "autorizado" && (
            <Button variant="outline" onClick={() => setVerVigente(true)}>
              <Eye className="size-4 mr-1" /> Ver vigente
            </Button>
          )}
          {director && !base && (
            <Button onClick={() => setCreating("base")}>
              <Plus className="size-4 mr-1" /> Crear presupuesto base
            </Button>
          )}
          {puedeCrearOC && base?.estatus === "autorizado" && (
            <Button variant="outline" onClick={() => setCreating("adenda")}>
              <Plus className="size-4 mr-1" /> Nueva orden de cambio
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Base autorizada</p>
          <p className="mt-2 text-xl font-semibold">{formatCurrency(totalBase)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Σ Órdenes de cambio
          </p>
          <p
            className={`mt-2 text-xl font-semibold ${
              totalAdendas < 0 ? "text-destructive" : ""
            }`}
          >
            {formatCurrency(totalAdendas)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {adendas.filter((a) => a.estatus === "autorizado").length} de {adendas.length}
          </p>
        </Card>
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total vigente</p>
          <p className="mt-2 text-xl font-semibold">{formatCurrency(totalVigente)}</p>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="base">Base</TabsTrigger>
          <TabsTrigger value="adendas">Órdenes de cambio ({adendas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="base" className="mt-4">
          {listQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : !base ? (
            <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
              Aún no hay presupuesto base. {director && "Crea uno para empezar."}
            </Card>
          ) : (
            <PresupuestoCard
              p={base}
              director={director}
              isResidente={isResidente}
              isSupervisor={isSupervisor}
              onView={() => setViewing(base.id)}
              onEdit={() => setEditing({ id: base.id, tipo: "base" })}
              onDelete={() => setToDelete(base)}
              onSolicitar={() => solicitarM.mutate({ data: { id: base.id } })}
              onAutorizar={() => autorizarM.mutate({ data: { id: base.id } })}
              onRechazar={() => setRechazando(base)}
              onReabrir={() => reabrirM.mutate({ data: { id: base.id } })}
              busy={solicitarM.isPending || autorizarM.isPending || reabrirM.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="adendas" className="mt-4 space-y-3">
          {adendas.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
              Sin órdenes de cambio registradas.
            </Card>
          ) : (
            adendas.map((a) => (
              <PresupuestoCard
                key={a.id}
                p={a}
                director={director}
                isResidente={isResidente}
                isSupervisor={isSupervisor}
                onView={() => setViewing(a.id)}
                onEdit={() => setEditing({ id: a.id, tipo: "adenda" })}
                onDelete={() => setToDelete(a)}
                onSolicitar={() => solicitarM.mutate({ data: { id: a.id } })}
                onAutorizar={() => autorizarM.mutate({ data: { id: a.id } })}
                onRechazar={() => setRechazando(a)}
                onReabrir={() => reabrirM.mutate({ data: { id: a.id } })}
                busy={solicitarM.isPending || autorizarM.isPending || reabrirM.isPending}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {creating && (
        <CrearPresupuestoDialog
          obraId={obraId}
          tipo={creating}
          numeroSugerido={
            creating === "adenda" ? Math.max(0, ...adendas.map((a) => a.numero)) + 1 : 0
          }
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            const tipo = creating;
            setCreating(null);
            refresh();
            if (tipo) setEditing({ id, tipo });
          }}
        />
      )}

      {editing && editing.tipo === "base" && (
        <CapturaPresupuestoSheet
          presupuestoId={editing.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}

      {editing && editing.tipo === "adenda" && (
        <CapturaOrdenCambioSheet
          obraId={obraId}
          presupuestoId={editing.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            qc.invalidateQueries({ queryKey: ["presupuesto-vigente", obraId] });
            setEditing(null);
          }}
        />
      )}

      {verVigente && (
        <VerVigenteSheet obraId={obraId} onClose={() => setVerVigente(false)} />
      )}


      {viewing && (
        <VerPresupuestoSheet
          presupuestoId={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.nombre}" y todos sus renglones. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && removeM.mutate({ data: { id: toDelete.id } })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rechazando && (
        <RechazarOCDialog
          presupuesto={rechazando}
          obraId={obraId}
          onClose={() => setRechazando(null)}
        />
      )}
    </div>
  );
}

function PresupuestoCard({
  p,
  director,
  isResidente,
  isSupervisor,
  onView,
  onEdit,
  onDelete,
  onSolicitar,
  onAutorizar,
  onRechazar,
  onReabrir,
  busy,
}: {
  p: Presupuesto;
  director: boolean;
  isResidente: boolean;
  isSupervisor: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSolicitar: () => void;
  onAutorizar: () => void;
  onRechazar: () => void;
  onReabrir: () => void;
  busy: boolean;
}) {
  const esOC = p.tipo === "adenda";
  const label = p.tipo === "base" ? "Presupuesto base" : `Orden de cambio ${p.numero}`;

  // Permisos derivados por estado
  const puedeEditar =
    p.estatus === "borrador" &&
    (esOC ? director || isResidente : director);
  const puedeEliminar =
    (p.estatus === "borrador" || p.estatus === "rechazada") &&
    (esOC ? director || isResidente : director);
  const puedeSolicitar =
    esOC && p.estatus === "borrador" && (director || isResidente);
  const puedeAutorizar =
    esOC
      ? p.estatus === "solicitada" && (director || isSupervisor)
      : p.estatus === "borrador" && director;
  const puedeRechazar =
    esOC && p.estatus === "solicitada" && (director || isSupervisor);
  const puedeReabrir =
    esOC && p.estatus === "rechazada" && (director || isResidente);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{label}</p>
            <Badge variant={estatusVariant(p.estatus)}>{estatusLabel(p.estatus)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{p.nombre}</p>
          {p.descripcion && (
            <p className="text-xs text-muted-foreground mt-1">{p.descripcion}</p>
          )}
          {p.estatus === "rechazada" && p.rechazo_motivo && (
            <p className="text-xs text-destructive mt-2">
              <span className="font-medium">Motivo del rechazo:</span> {p.rechazo_motivo}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold ${esOC && Number(p.monto_total) < 0 ? "text-destructive" : ""}`}>
            {esOC ? "Δ " : ""}{formatCurrency(p.monto_total)}
          </p>
          {p.autorizado_at && p.estatus === "autorizado" && (
            <p className="text-xs text-muted-foreground mt-1">
              Autorizada: {new Date(p.autorizado_at).toLocaleDateString("es-MX")}
            </p>
          )}
          {p.enviado_at && p.estatus === "solicitada" && (
            <p className="text-xs text-muted-foreground mt-1">
              Solicitada: {new Date(p.enviado_at).toLocaleDateString("es-MX")}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Button size="sm" variant="outline" onClick={onView}>
          <FileText className="size-4 mr-1" /> Ver
        </Button>
        {puedeEditar && (
          <Button size="sm" onClick={onEdit}>
            Editar
          </Button>
        )}
        {puedeSolicitar && (
          <Button size="sm" variant="secondary" onClick={onSolicitar} disabled={busy}>
            <Send className="size-4 mr-1" /> Solicitar autorización
          </Button>
        )}
        {puedeAutorizar && (
          <Button size="sm" onClick={onAutorizar} disabled={busy}>
            <Check className="size-4 mr-1" /> Autorizar
          </Button>
        )}
        {puedeRechazar && (
          <Button size="sm" variant="destructive" onClick={onRechazar} disabled={busy}>
            <X className="size-4 mr-1" /> Rechazar
          </Button>
        )}
        {puedeReabrir && (
          <Button size="sm" variant="outline" onClick={onReabrir} disabled={busy}>
            <RotateCcw className="size-4 mr-1" /> Volver a borrador
          </Button>
        )}
        {puedeEliminar && (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function CrearPresupuestoDialog({
  obraId,
  tipo,
  numeroSugerido,
  onClose,
  onCreated,
}: {
  obraId: string;
  tipo: "base" | "adenda";
  numeroSugerido: number;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [nombre, setNombre] = useState(
    tipo === "base" ? "Presupuesto base" : `Orden de cambio ${numeroSugerido}`,
  );
  const [descripcion, setDescripcion] = useState("");
  const crear = useServerFn(crearPresupuesto);
  const m = useMutation({
    mutationFn: crear,
    onSuccess: (res) => {
      toast.success("Presupuesto creado");
      onCreated(res.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tipo === "base" ? "Crear presupuesto base" : "Nueva orden de cambio"}</DialogTitle>
          <DialogDescription>
            Se creará en estado borrador. Después podrás capturar los movimientos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={tipo === "adenda" ? "Motivo de la orden de cambio…" : ""}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending || !nombre.trim()}
            onClick={() =>
              m.mutate({
                data: {
                  obraId,
                  tipo,
                  nombre: nombre.trim(),
                  descripcion: descripcion.trim() || undefined,
                },
              })
            }
          >
            {m.isPending ? "Creando…" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RechazarOCDialog({
  presupuesto,
  obraId,
  onClose,
}: {
  presupuesto: Presupuesto;
  obraId: string;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const qc = useQueryClient();
  const rechazar = useServerFn(rechazarPresupuesto);
  const m = useMutation({
    mutationFn: rechazar,
    onSuccess: () => {
      toast.success("OC rechazada");
      qc.invalidateQueries({ queryKey: ["presupuestos", obraId] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar orden de cambio</DialogTitle>
          <DialogDescription>
            {presupuesto.nombre}. El residente podrá volver a borrador para corregir.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>Motivo del rechazo</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explica al residente qué debe corregir…"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={m.isPending || motivo.trim().length < 3}
            onClick={() => m.mutate({ data: { id: presupuesto.id, motivo: motivo.trim() } })}
          >
            {m.isPending ? "Rechazando…" : "Rechazar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
