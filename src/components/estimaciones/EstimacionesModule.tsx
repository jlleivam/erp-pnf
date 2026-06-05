import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEstimaciones,
  eliminarEstimacion,
} from "@/lib/api/estimaciones.functions";
import { calcularSemana, formatRangoSemana } from "@/lib/estimacion-utils";
import { useEffectiveIsDirector } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
import { Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";
import { CapturaEstimacionSheet } from "./CapturaEstimacionSheet";
import { VerEstimacionSheet } from "./VerEstimacionSheet";

type Estimacion = {
  id: string;
  numero: number;
  semana_inicio: string;
  semana_fin: string;
  estatus: "borrador" | "cerrada";
  monto_total: number;
  cerrada_at: string | null;
};

export function EstimacionesModule({ obraId }: { obraId: string }) {
  const director = useEffectiveIsDirector();
  const qc = useQueryClient();
  const fetchList = useServerFn(listEstimaciones);
  const listQ = useQuery({
    queryKey: ["estimaciones", obraId],
    queryFn: () => fetchList({ data: { obraId } }),
  });

  const [editing, setEditing] = useState<string | null>(null); // semanaInicio
  const [viewing, setViewing] = useState<string | null>(null); // estimacionId
  const [openNueva, setOpenNueva] = useState(false);
  const [toDelete, setToDelete] = useState<Estimacion | null>(null);

  const remove = useServerFn(eliminarEstimacion);
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Estimación eliminada");
      qc.invalidateQueries({ queryKey: ["estimaciones", obraId] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const estimaciones = (listQ.data ?? []) as Estimacion[];
  const totalProduccion = estimaciones
    .filter((e) => e.estatus === "cerrada")
    .reduce((s, e) => s + Number(e.monto_total), 0);
  const borrador = estimaciones.find((e) => e.estatus === "borrador");

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estimaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Producción semanal (Lun–Dom) ejecutada en obra contra el presupuesto vigente.
          </p>
        </div>
        <div className="flex gap-2">
          {borrador ? (
            <Button onClick={() => setEditing(borrador.semana_inicio)}>
              Continuar borrador
            </Button>
          ) : (
            <Button onClick={() => setOpenNueva(true)}>
              <Plus className="size-4 mr-1" /> Nueva estimación
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Producción acumulada</p>
          <p className="mt-2 text-xl font-semibold">{formatMXN(totalProduccion)}</p>
          <p className="text-xs text-muted-foreground mt-1">Semanas cerradas</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Semanas cerradas</p>
          <p className="mt-2 text-xl font-semibold">
            {estimaciones.filter((e) => e.estatus === "cerrada").length}
          </p>
        </Card>
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Borrador actual</p>
          <p className="mt-2 text-xl font-semibold">
            {borrador ? formatMXN(Number(borrador.monto_total)) : "—"}
          </p>
          {borrador && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatRangoSemana(borrador.semana_inicio, borrador.semana_fin)}
            </p>
          )}
        </Card>
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : estimaciones.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no se ha capturado ninguna estimación.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 w-16">#</th>
                <th className="text-left p-3">Semana</th>
                <th className="text-left p-3 w-28">Estatus</th>
                <th className="text-right p-3 w-40">Monto</th>
                <th className="text-right p-3 w-48">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {estimaciones.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3 tabular-nums">{e.numero}</td>
                  <td className="p-3">{formatRangoSemana(e.semana_inicio, e.semana_fin)}</td>
                  <td className="p-3">
                    <Badge variant={e.estatus === "cerrada" ? "default" : "secondary"}>
                      {e.estatus === "cerrada" ? "Cerrada" : "Borrador"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right tabular-nums font-medium">
                    {formatMXN(Number(e.monto_total))}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setViewing(e.id)}>
                        <FileText className="size-4 mr-1" /> Ver
                      </Button>
                      {e.estatus === "borrador" && (
                        <>
                          <Button size="sm" onClick={() => setEditing(e.semana_inicio)}>
                            Editar
                          </Button>
                          {director && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setToDelete(e)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {openNueva && (
        <NuevaEstimacionDialog
          onClose={() => setOpenNueva(false)}
          onConfirm={(semanaInicio) => {
            setOpenNueva(false);
            setEditing(semanaInicio);
          }}
          semanasUsadas={new Set(estimaciones.map((e) => e.semana_inicio))}
        />
      )}

      {editing && (
        <CapturaEstimacionSheet
          obraId={obraId}
          semanaInicio={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["estimaciones", obraId] })}
        />
      )}

      {viewing && (
        <VerEstimacionSheet estimacionId={viewing} onClose={() => setViewing(null)} />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar estimación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el borrador de la semana{" "}
              {toDelete && formatRangoSemana(toDelete.semana_inicio, toDelete.semana_fin)} y todas
              sus cantidades. No se puede deshacer.
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

function NuevaEstimacionDialog({
  onClose,
  onConfirm,
  semanasUsadas,
}: {
  onClose: () => void;
  onConfirm: (semanaInicio: string) => void;
  semanasUsadas: Set<string>;
}) {
  const semana = calcularSemana(new Date());
  const yaExiste = semanasUsadas.has(semana.inicio);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva estimación semanal</DialogTitle>
          <DialogDescription>
            La estimación se crea sobre la semana en curso (Lunes–Domingo).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Card className="p-3 bg-muted/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Semana activa
            </p>
            <p className="mt-1 font-medium">{formatRangoSemana(semana.inicio, semana.fin)}</p>
            {yaExiste && (
              <p className="text-xs text-destructive mt-2">
                Ya existe una estimación para esta semana. Se abrirá el borrador existente.
              </p>
            )}
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(semana.inicio)}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

