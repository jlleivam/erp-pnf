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
  const roles = useEffectiveRoles();
  const isSupervisor = roles.includes("supervisor");
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
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subcontratos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Trabajos contratados con un tercero (contratista) con presupuesto, órdenes
            de cambio y estimaciones semanales de avance. El contratista se encarga de
            sus propias altas ante el IMSS.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4 mr-1" /> Nuevo subcontrato
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Contratado vigente</p>
          <p className="mt-2 text-xl font-semibold">{formatMXN(contratado)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pagado acumulado</p>
          <p className="mt-2 text-xl font-semibold">{formatMXN(pagado)}</p>
        </Card>
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Subcontratos activos</p>
          <p className="mt-2 text-xl font-semibold">{activos}</p>
        </Card>
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : subcontratos.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay subcontratos. Crea uno para comenzar.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 w-12">#</th>
                <th className="text-left p-3">Subcontrato</th>
                <th className="text-left p-3">Contratista</th>
                <th className="text-left p-3 w-44">Estatus</th>
                <th className="text-right p-3 w-36">Contratado</th>
                <th className="text-right p-3 w-36">Pagado</th>
                <th className="text-right p-3 w-44">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {subcontratos.map((d) => {
                const pct = d.monto_total > 0
                  ? (d.pagado_acumulado / d.monto_total) * 100
                  : 0;
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="p-3 tabular-nums">{d.numero}</td>
                    <td className="p-3">
                      <p className="font-medium">{d.nombre}</p>
                      {d.descripcion && (
                        <p className="text-xs text-muted-foreground">{d.descripcion}</p>
                      )}
                    </td>
                    <td className="p-3">{d.contratista_nombre}</td>
                    <td className="p-3">
                      <Badge variant={ESTATUS_VARIANT[d.estatus_base]}>
                        {ESTATUS_LABEL[d.estatus_base]}
                      </Badge>
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatMXN(d.monto_total)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {formatMXN(d.pagado_acumulado)}
                      {d.monto_total > 0 && (
                        <div className="text-xs text-muted-foreground">{pct.toFixed(0)}%</div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setViewingId(d.id)}>
                          <Eye className="size-4 mr-1" /> Abrir
                        </Button>
                        {director && d.estatus_base === "borrador" && d.pagado_acumulado === 0 && (
                          <Button size="sm" variant="ghost" onClick={() => setToDelete(d)}>
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
