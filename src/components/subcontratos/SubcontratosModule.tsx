import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSubcontratos,
  eliminarSubcontrato,
} from "@/lib/api/subcontratos.functions";
import { useEffectiveIsDirector } from "@/stores/auth";
import { useObraRole } from "@/hooks/useObraRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";
import { NuevoSubcontratoDialog } from "./NuevoSubcontratoDialog";
import { SubcontratoDetalleSheet } from "./SubcontratoDetalleSheet";

type Subcontrato = {
  id: string;
  obra_id: string;
  contratista_id: string;
  contratista_nombre: string;
  numero: number;
  nombre: string;
  descripcion: string | null;
  estatus: "borrador" | "enviado" | "autorizado" | "rechazado";
  estatus_base: "borrador" | "enviado" | "autorizado" | "rechazado";
  monto_total: number;
  pagado_acumulado: number;
  created_at: string;
};

const ESTATUS_LABEL: Record<Subcontrato["estatus"], string> = {
  borrador: "Borrador",
  enviado: "Pendiente autorización",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
};
const ESTATUS_VARIANT: Record<Subcontrato["estatus"], "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "secondary",
  enviado: "outline",
  autorizado: "default",
  rechazado: "destructive",
};

export function SubcontratosModule({ obraId }: { obraId: string }) {
  const director = useEffectiveIsDirector();
  const { isSupervisor, isResidente } = useObraRole(obraId);
  const canEditDraft = director || isResidente;
  const qc = useQueryClient();
  const fetchList = useServerFn(listSubcontratos);
  const listQ = useQuery({
    queryKey: ["subcontratos", obraId],
    queryFn: () => fetchList({ data: { obraId } }),
  });

  const [creating, setCreating] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Subcontrato | null>(null);

  const remove = useServerFn(eliminarSubcontrato);
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Subcontrato eliminado");
      qc.invalidateQueries({ queryKey: ["subcontratos", obraId] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subcontratos = (listQ.data ?? []) as Subcontrato[];
  const contratado = subcontratos
    .filter((d) => d.estatus_base === "autorizado")
    .reduce((s, d) => s + Number(d.monto_total), 0);
  const pagado = subcontratos.reduce((s, d) => s + Number(d.pagado_acumulado), 0);
  const activos = subcontratos.filter((d) => d.estatus_base === "autorizado").length;

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Subcontratos</h1>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            Trabajos contratados con un tercero con presupuesto, órdenes de cambio y estimaciones semanales.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)} className="shrink-0">
          <Plus className="size-4 mr-1" /> Nuevo
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Contratado vigente</p>
          <p className="mt-1 text-base font-semibold tabular-nums">{formatMXN(contratado)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagado acumulado</p>
          <p className="mt-1 text-base font-semibold tabular-nums">{formatMXN(pagado)}</p>
        </Card>
        <Card className="p-3 border-primary/30 bg-primary/5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Subcontratos activos</p>
          <p className="mt-1 text-base font-semibold tabular-nums">{activos}</p>
        </Card>
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : subcontratos.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay subcontratos. Crea uno para comenzar.
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-2 w-8 hidden md:table-cell">#</th>
                <th className="text-left p-2 w-[22%]">Subcontrato</th>
                <th className="text-left p-2 w-[26%]">Contratista</th>
                <th className="text-left p-2 w-[15%]">Estatus</th>
                <th className="text-right p-2 w-[15%]">Contratado</th>
                <th className="text-right p-2 w-[15%]">Pagado</th>
                <th className="text-right p-2 w-[7%]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {subcontratos.map((d) => {
                const pct = d.monto_total > 0
                  ? (d.pagado_acumulado / d.monto_total) * 100
                  : 0;
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="p-2 tabular-nums hidden md:table-cell">{d.numero}</td>
                    <td className="p-2">
                      <p className="font-medium truncate" title={d.descripcion ? `${d.nombre} — ${d.descripcion}` : d.nombre}>
                        {d.nombre}
                      </p>
                    </td>
                    <td className="p-2">
                      <p className="truncate" title={d.contratista_nombre}>{d.contratista_nombre}</p>
                    </td>
                    <td className="p-2">
                      <Badge variant={ESTATUS_VARIANT[d.estatus_base]} className="text-xs px-2 py-0 truncate max-w-full">
                        {ESTATUS_LABEL[d.estatus_base]}
                      </Badge>
                    </td>
                    <td className="p-2 text-right tabular-nums truncate">{formatMXN(d.monto_total)}</td>
                    <td className="p-2 text-right tabular-nums truncate">
                      {formatMXN(d.pagado_acumulado)}
                      {d.monto_total > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">· {pct.toFixed(0)}%</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setViewingId(d.id)}>
                          <Eye className="size-3.5 sm:mr-1" /> <span className="hidden sm:inline">Abrir</span>
                        </Button>
                        {director && d.estatus_base === "borrador" && d.pagado_acumulado === 0 && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setToDelete(d)}>
                            <Trash2 className="size-3.5" />
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


      {creating && (
        <NuevoSubcontratoDialog
          obraId={obraId}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["subcontratos", obraId] });
            setViewingId(id);
          }}
        />
      )}

      {viewingId && (
        <SubcontratoDetalleSheet
          subcontratoId={viewingId}
          canAuthorize={director || isSupervisor}
          onClose={() => setViewingId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["subcontratos", obraId] })}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar subcontrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.nombre}" junto con todos sus presupuestos. No se
              puede deshacer.
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
