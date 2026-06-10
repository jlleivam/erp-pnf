import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEstimacionesDestajo,
  eliminarEstimacionDestajo,
  autorizarEstimacionDestajo,
  rechazarEstimacionDestajo,
  reabrirEstimacionRechazada,
} from "@/lib/api/destajos.functions";
import { useObraRole } from "@/hooks/useObraRole";
import { calcularSemana, formatRangoSemana, toISODate } from "@/lib/estimacion-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, FileText, Trash2, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";
import { CapturaEstimacionDestajoSheet } from "./CapturaEstimacionDestajoSheet";

type EstatusEst =
  | "borrador"
  | "cerrada"
  | "autorizada"
  | "rechazada"
  | "pagada";

type Estimacion = {
  id: string;
  numero: number;
  semana_inicio: string;
  semana_fin: string;
  estatus: EstatusEst;
  monto_total: number;
  monto_neto: number;
  rechazo_motivo: string | null;
  cxp_id: string | null;
};

const ESTATUS_LABEL: Record<EstatusEst, string> = {
  borrador: "Borrador",
  cerrada: "Por autorizar",
  autorizada: "Autorizada",
  rechazada: "Rechazada",
  pagada: "Pagada",
};

const ESTATUS_VARIANT: Record<EstatusEst, "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "secondary",
  cerrada: "outline",
  autorizada: "default",
  rechazada: "destructive",
  pagada: "default",
};

export function EstimacionesDestajoTab({
  destajoId,
  obraId,
}: {
  destajoId: string;
  obraId: string | null;
}) {
  const qc = useQueryClient();
  const fetchList = useServerFn(listEstimacionesDestajo);
  const listQ = useQuery({
    queryKey: ["destajo-estimaciones", destajoId],
    queryFn: () => fetchList({ data: { destajoId } }),
  });

  const { isSupervisor, isDirector } = useObraRole(obraId);
  const puedeAutorizar = isSupervisor || isDirector;

  const [editing, setEditing] = useState<string | null>(null);
  const [openNueva, setOpenNueva] = useState(false);
  const [toDelete, setToDelete] = useState<Estimacion | null>(null);
  const [rejecting, setRejecting] = useState<Estimacion | null>(null);
  const [motivo, setMotivo] = useState("");
  const [authorizing, setAuthorizing] = useState<Estimacion | null>(null);

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

  const autorizar = useServerFn(autorizarEstimacionDestajo);
  const autorizarM = useMutation({
    mutationFn: autorizar,
    onSuccess: (r: any) => {
      toast.success(`Estimación autorizada · CxP ${r?.folio ?? ""}`);
      qc.invalidateQueries({ queryKey: ["destajo-estimaciones", destajoId] });
      setAuthorizing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rechazar = useServerFn(rechazarEstimacionDestajo);
  const rechazarM = useMutation({
    mutationFn: rechazar,
    onSuccess: () => {
      toast.success("Estimación rechazada");
      qc.invalidateQueries({ queryKey: ["destajo-estimaciones", destajoId] });
      setRejecting(null);
      setMotivo("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reabrir = useServerFn(reabrirEstimacionRechazada);
  const reabrirM = useMutation({
    mutationFn: reabrir,
    onSuccess: () => {
      toast.success("Reabierta como borrador");
      qc.invalidateQueries({ queryKey: ["destajo-estimaciones", destajoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ests = (listQ.data ?? []) as Estimacion[];
  const totalAutorizado = ests
    .filter((e) => e.estatus === "autorizada" || e.estatus === "pagada")
    .reduce((s, e) => s + Number(e.monto_neto ?? 0), 0);
  const editable = ests.find((e) => e.estatus === "borrador" || e.estatus === "rechazada");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            Neto autorizado acumulado:{" "}
            <span className="font-semibold">{formatMXN(totalAutorizado)}</span>
          </p>
        </div>
        {editable ? (
          <Button onClick={() => setEditing(editable.semana_inicio)}>
            {editable.estatus === "rechazada" ? "Corregir rechazada" : "Continuar borrador"}
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
                <th className="text-left p-3 w-32">Estatus</th>
                <th className="text-right p-3 w-32">Bruto</th>
                <th className="text-right p-3 w-32">Neto</th>
                <th className="text-right p-3 w-56">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ests.map((e) => {
                const esEditable = e.estatus === "borrador" || e.estatus === "rechazada";
                return (
                  <tr key={e.id} className="border-t border-border align-top">
                    <td className="p-3 tabular-nums">{e.numero}</td>
                    <td className="p-3">
                      {formatRangoSemana(e.semana_inicio, e.semana_fin)}
                      {e.estatus === "rechazada" && e.rechazo_motivo && (
                        <p className="text-xs text-destructive mt-1 flex items-start gap-1">
                          <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                          <span>{e.rechazo_motivo}</span>
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant={ESTATUS_VARIANT[e.estatus]}>
                        {ESTATUS_LABEL[e.estatus]}
                      </Badge>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatMXN(Number(e.monto_total))}
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium">
                      {e.estatus === "borrador" || e.estatus === "rechazada"
                        ? "—"
                        : formatMXN(Number(e.monto_neto ?? 0))}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => setEditing(e.semana_inicio)}>
                          <FileText className="size-4 mr-1" /> {esEditable ? "Editar" : "Ver"}
                        </Button>
                        {e.estatus === "cerrada" && puedeAutorizar && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setAuthorizing(e)}
                              disabled={autorizarM.isPending}
                            >
                              <CheckCircle2 className="size-4 mr-1" /> Autorizar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setRejecting(e); setMotivo(""); }}
                            >
                              <XCircle className="size-4 mr-1" /> Rechazar
                            </Button>
                          </>
                        )}
                        {e.estatus === "rechazada" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reabrirM.mutate({ data: { id: e.id } })}
                            disabled={reabrirM.isPending}
                          >
                            <RefreshCw className="size-4 mr-1" /> Reabrir
                          </Button>
                        )}
                        {esEditable && (
                          <Button size="sm" variant="ghost" onClick={() => setToDelete(e)}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
              Se eliminará{" "}
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

      <AlertDialog open={!!authorizing} onOpenChange={(o) => !o && setAuthorizing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Autorizar esta estimación?</AlertDialogTitle>
            <AlertDialogDescription>
              Al autorizar se genera una <strong>Cuenta por Pagar</strong> al contratista por{" "}
              <strong>
                {authorizing
                  ? formatMXN(Number(authorizing.monto_neto ?? 0))
                  : ""}
              </strong>{" "}
              y se registra el asiento contable. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                authorizing && autorizarM.mutate({ data: { id: authorizing.id } })
              }
              disabled={autorizarM.isPending}
            >
              Autorizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar estimación</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo del rechazo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Indica qué debe corregir el residente…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length < 3 || rechazarM.isPending}
              onClick={() =>
                rejecting &&
                rechazarM.mutate({ data: { id: rejecting.id, motivo: motivo.trim() } })
              }
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
