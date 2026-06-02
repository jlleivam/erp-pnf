import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPresupuestos,
  crearPresupuesto,
  eliminarPresupuesto,
} from "@/lib/api/presupuestos.functions";
import { useEffectiveIsDirector } from "@/stores/auth";
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
import { Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CapturaPresupuestoSheet } from "./CapturaPresupuestoSheet";
import { VerPresupuestoSheet } from "./VerPresupuestoSheet";
import { formatCurrency } from "@/lib/format";

type Presupuesto = {
  id: string;
  tipo: "base" | "adenda";
  numero: number;
  nombre: string;
  descripcion: string | null;
  estatus: "borrador" | "autorizado";
  monto_total: number;
  autorizado_at: string | null;
  created_at: string;
};

export function PresupuestoModule({ obraId }: { obraId: string }) {
  const director = useEffectiveIsDirector();
  const qc = useQueryClient();
  const fetchList = useServerFn(listPresupuestos);
  const listQ = useQuery({
    queryKey: ["presupuestos", obraId],
    queryFn: () => fetchList({ data: { obraId } }),
  });

  const [creating, setCreating] = useState<null | "base" | "adenda">(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Presupuesto | null>(null);

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

  const presupuestos = (listQ.data ?? []) as Presupuesto[];
  const base = presupuestos.find((p) => p.tipo === "base");
  const adendas = presupuestos.filter((p) => p.tipo === "adenda");
  const totalBase = base?.estatus === "autorizado" ? base.monto_total : 0;
  const totalAdendas = adendas
    .filter((a) => a.estatus === "autorizado")
    .reduce((s, a) => s + Number(a.monto_total), 0);
  const totalVigente = totalBase + totalAdendas;

  const refresh = () => qc.invalidateQueries({ queryKey: ["presupuestos", obraId] });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presupuesto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Presupuesto base + adendas aditivas. Estructura WBS hasta 5 niveles.
          </p>
        </div>
        {director && !base && (
          <Button onClick={() => setCreating("base")}>
            <Plus className="size-4 mr-1" /> Crear presupuesto base
          </Button>
        )}
        {director && base?.estatus === "autorizado" && (
          <Button variant="outline" onClick={() => setCreating("adenda")}>
            <Plus className="size-4 mr-1" /> Agregar adenda
          </Button>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Base autorizada</p>
          <p className="mt-2 text-xl font-semibold">{formatCurrency(totalBase)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Adendas autorizadas</p>
          <p className="mt-2 text-xl font-semibold">{formatCurrency(totalAdendas)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {adendas.filter((a) => a.estatus === "autorizado").length} de {adendas.length}
          </p>
        </Card>
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total vigente</p>
          <p className="mt-2 text-xl font-semibold">{formatCurrency(totalVigente)}</p>
        </Card>
      </div>

      <Tabs defaultValue="base">
        <TabsList>
          <TabsTrigger value="base">Base</TabsTrigger>
          <TabsTrigger value="adendas">Adendas ({adendas.length})</TabsTrigger>
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
              onView={() => setViewing(base.id)}
              onEdit={() => setEditing(base.id)}
              onDelete={() => setToDelete(base)}
            />
          )}
        </TabsContent>

        <TabsContent value="adendas" className="mt-4 space-y-3">
          {adendas.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
              Sin adendas registradas.
            </Card>
          ) : (
            adendas.map((a) => (
              <PresupuestoCard
                key={a.id}
                p={a}
                director={director}
                onView={() => setViewing(a.id)}
                onEdit={() => setEditing(a.id)}
                onDelete={() => setToDelete(a)}
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
            setCreating(null);
            refresh();
            setEditing(id);
          }}
        />
      )}

      {editing && (
        <CapturaPresupuestoSheet
          presupuestoId={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
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
    </div>
  );
}

function PresupuestoCard({
  p,
  director,
  onView,
  onEdit,
  onDelete,
}: {
  p: Presupuesto;
  director: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const label = p.tipo === "base" ? "Presupuesto base" : `Adenda ${p.numero}`;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{label}</p>
            <Badge variant={p.estatus === "autorizado" ? "default" : "secondary"}>
              {p.estatus === "autorizado" ? "Autorizado" : "Borrador"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{p.nombre}</p>
          {p.descripcion && (
            <p className="text-xs text-muted-foreground mt-1">{p.descripcion}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{formatCurrency(p.monto_total)}</p>
          {p.autorizado_at && (
            <p className="text-xs text-muted-foreground mt-1">
              Autorizado: {new Date(p.autorizado_at).toLocaleDateString("es-MX")}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button size="sm" variant="outline" onClick={onView}>
          <FileText className="size-4 mr-1" /> Ver
        </Button>
        {director && p.estatus === "borrador" && (
          <>
            <Button size="sm" onClick={onEdit}>
              Editar / Autorizar
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          </>
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
    tipo === "base" ? "Presupuesto base" : `Adenda ${numeroSugerido}`,
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
          <DialogTitle>{tipo === "base" ? "Crear presupuesto base" : "Agregar adenda"}</DialogTitle>
          <DialogDescription>
            Se creará en estado borrador. Después podrás capturar o importar los renglones.
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
              placeholder={tipo === "adenda" ? "Motivo de la adenda…" : ""}
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
