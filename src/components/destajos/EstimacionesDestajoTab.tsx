import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEstimacionesDestajo,
  eliminarEstimacionDestajo,
} from "@/lib/api/destajos.functions";
import { calcularSemana, formatRangoSemana, toISODate } from "@/lib/estimacion-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { CapturaEstimacionDestajoSheet } from "./CapturaEstimacionDestajoSheet";

type Estimacion = {
  id: string;
  numero: number;
  semana_inicio: string;
  semana_fin: string;
  estatus: "borrador" | "cerrada";
  monto_total: number;
};

export function EstimacionesDestajoTab({ destajoId }: { destajoId: string }) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listEstimacionesDestajo);
  const listQ = useQuery({
    queryKey: ["destajo-estimaciones", destajoId],
    queryFn: () => fetchList({ data: { destajoId } }),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [openNueva, setOpenNueva] = useState(false);
  const [toDelete, setToDelete] = useState<Estimacion | null>(null);

  const remove = useServerFn(eliminarEstimacionDestajo);
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Estimación eliminada");
      qc.invalidateQueries({ queryKey: ["destajo-estimaciones", destajoId] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ests = (listQ.data ?? []) as Estimacion[];
  const total = ests.filter((e) => e.estatus === "cerrada").reduce((s, e) => s + Number(e.monto_total), 0);
  const borrador = ests.find((e) => e.estatus === "borrador");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            Pagado acumulado: <span className="font-semibold">{formatMXN(total)}</span>
          </p>
        </div>
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

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : ests.length === 0 ? (
        <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin estimaciones aún.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 w-12">#</th>
                <th className="text-left p-3">Semana</th>
                <th className="text-left p-3 w-24">Estatus</th>
                <th className="text-right p-3 w-36">Monto</th>
                <th className="text-right p-3 w-40">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ests.map((e) => (
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
                      <Button size="sm" variant="outline" onClick={() => setEditing(e.semana_inicio)}>
                        <FileText className="size-4 mr-1" /> {e.estatus === "borrador" ? "Editar" : "Ver"}
                      </Button>
                      {e.estatus === "borrador" && (
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(e)}>
                          <Trash2 className="size-4" />
                        </Button>
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
        <NuevaDialog
          onClose={() => setOpenNueva(false)}
          onConfirm={(s) => {
            setOpenNueva(false);
            setEditing(s);
          }}
          semanasUsadas={new Set(ests.map((e) => e.semana_inicio))}
        />
      )}

      {editing && (
        <CapturaEstimacionDestajoSheet
          destajoId={destajoId}
          semanaInicio={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["destajo-estimaciones", destajoId] })}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar estimación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el borrador de{" "}
              {toDelete && formatRangoSemana(toDelete.semana_inicio, toDelete.semana_fin)}.
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

function NuevaDialog({
  onClose,
  onConfirm,
  semanasUsadas,
}: {
  onClose: () => void;
  onConfirm: (semanaInicio: string) => void;
  semanasUsadas: Set<string>;
}) {
  const hoy = toISODate(new Date());
  const [fecha, setFecha] = useState(hoy);
  const semana = calcularSemana(fecha);
  const yaExiste = semanasUsadas.has(semana.inicio);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva estimación semanal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <Card className="p-3 bg-muted/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Semana
            </p>
            <p className="mt-1 font-medium">
              {formatRangoSemana(semana.inicio, semana.fin)}
            </p>
            {yaExiste && (
              <p className="text-xs text-muted-foreground mt-2">
                Ya existe una estimación para esta semana. Se abrirá la existente.
              </p>
            )}
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(semana.inicio)}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
