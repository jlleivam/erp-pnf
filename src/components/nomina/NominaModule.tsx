import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listNominas, eliminarNomina } from "@/lib/api/nominas.functions";
import { calcularSemana, formatRangoSemana, toISODate } from "@/lib/estimacion-utils";
import { useEffectiveIsDirector } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";
import { CapturaNominaSheet } from "./CapturaNominaSheet";

type Nomina = {
  id: string;
  numero: number;
  semana_inicio: string;
  semana_fin: string;
  estatus: "borrador" | "cerrada";
  monto_total: number;
  cerrada_at: string | null;
};

export function NominaModule({ obraId }: { obraId: string }) {
  const director = useEffectiveIsDirector();
  const qc = useQueryClient();
  const fetchList = useServerFn(listNominas);
  const listQ = useQuery({
    queryKey: ["nominas", obraId],
    queryFn: () => fetchList({ data: { obraId } }),
  });

  const [editing, setEditing] = useState<{ semanaInicio: string; readOnly?: boolean } | null>(null);
  const [openNueva, setOpenNueva] = useState(false);
  const [toDelete, setToDelete] = useState<Nomina | null>(null);

  const remove = useServerFn(eliminarNomina);
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Nómina eliminada");
      qc.invalidateQueries({ queryKey: ["nominas", obraId] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nominas = (listQ.data ?? []) as Nomina[];
  const totalPagado = nominas
    .filter((n) => n.estatus === "cerrada")
    .reduce((s, n) => s + Number(n.monto_total), 0);
  const borrador = nominas.find((n) => n.estatus === "borrador");

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nómina</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Asignación de trabajadores y asistencia semanal (Lun–Dom).
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setOpenNueva(true)}>
            <Plus className="size-4 mr-1" /> Nueva semana
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pagado acumulado</p>
          <p className="mt-2 text-xl font-semibold">{formatMXN(totalPagado)}</p>
          <p className="text-xs text-muted-foreground mt-1">Semanas cerradas</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Semanas cerradas</p>
          <p className="mt-2 text-xl font-semibold">
            {nominas.filter((n) => n.estatus === "cerrada").length}
          </p>
        </Card>
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Nómina activa</p>
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
      ) : nominas.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no se ha capturado ninguna nómina semanal.
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
                <th className="text-right p-3 w-56">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {nominas.map((n) => (
                <tr key={n.id} className="border-t border-border">
                  <td className="p-3 tabular-nums">{n.numero}</td>
                  <td className="p-3">{formatRangoSemana(n.semana_inicio, n.semana_fin)}</td>
                  <td className="p-3">
                    <Badge variant={n.estatus === "cerrada" ? "default" : "secondary"}>
                      {n.estatus === "cerrada" ? "Cerrada" : "Activa"}
                    </Badge>
                  </td>
                  <td className="p-3 text-right tabular-nums font-medium">
                    {formatMXN(Number(n.monto_total))}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing({ semanaInicio: n.semana_inicio, readOnly: n.estatus === "cerrada" })}
                      >
                        <FileText className="size-4 mr-1" />
                        {n.estatus === "cerrada" ? "Ver" : "Editar"}
                      </Button>
                      {n.estatus === "borrador" && director && (
                        <Button size="sm" variant="ghost" onClick={() => setToDelete(n)}>
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
        <NuevaNominaDialog
          onClose={() => setOpenNueva(false)}
          onConfirm={(semanaInicio) => {
            setOpenNueva(false);
            setEditing({ semanaInicio });
          }}
          semanasUsadas={new Set(nominas.map((n) => n.semana_inicio))}
        />
      )}

      {editing && (
        <CapturaNominaSheet
          obraId={obraId}
          semanaInicio={editing.semanaInicio}
          readOnly={editing.readOnly}
          onClose={() => setEditing(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["nominas", obraId] })}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar nómina?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el borrador de la semana{" "}
              {toDelete && formatRangoSemana(toDelete.semana_inicio, toDelete.semana_fin)} con toda
              su asistencia capturada. No se puede deshacer.
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

function NuevaNominaDialog({
  onClose, onConfirm, semanasUsadas,
}: {
  onClose: () => void;
  onConfirm: (semanaInicio: string) => void;
  semanasUsadas: Set<string>;
}) {
  const hoy = toISODate(new Date());
  const semana = calcularSemana(hoy);
  const yaExiste = semanasUsadas.has(semana.inicio);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva nómina semanal</DialogTitle>
          <DialogDescription>
            Se abrirá la nómina correspondiente a la semana en curso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Card className="p-3 bg-muted/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Semana asignada</p>
            <p className="mt-1 font-medium">{formatRangoSemana(semana.inicio, semana.fin)}</p>
            {yaExiste && (
              <p className="text-xs text-destructive mt-2">
                Ya existe una nómina para esta semana. Se abrirá la existente.
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
