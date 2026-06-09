import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listDestajos,
  eliminarDestajo,
} from "@/lib/api/destajos.functions";
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
import { Plus, Eye, Trash2, Users, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";
import { NuevoDestajoDialog } from "./NuevoDestajoDialog";
import { DestajoDetalleSheet } from "./DestajoDetalleSheet";

type Destajo = {
  id: string;
  obra_id: string;
  destajista_id: string;
  destajista_nombre: string;
  numero: number;
  nombre: string;
  descripcion: string | null;
  estatus: "borrador" | "enviado" | "autorizado" | "rechazado";
  estatus_base: "borrador" | "enviado" | "autorizado" | "rechazado";
  monto_total: number;
  pagado_acumulado: number;
  created_at: string;
};

const ESTATUS_LABEL: Record<Destajo["estatus"], string> = {
  borrador: "Borrador",
  enviado: "Pendiente autorización",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
};
const ESTATUS_VARIANT: Record<Destajo["estatus"], "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "secondary",
  enviado: "outline",
  autorizado: "default",
  rechazado: "destructive",
};

export function DestajosModule({ obraId }: { obraId: string }) {
  const director = useEffectiveIsDirector();
  const roles = useEffectiveRoles();
  const isSupervisor = roles.includes("supervisor");
  const qc = useQueryClient();
  const fetchList = useServerFn(listDestajos);
  const listQ = useQuery({
    queryKey: ["destajos", obraId],
    queryFn: () => fetchList({ data: { obraId } }),
  });

  const [creating, setCreating] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Destajo | null>(null);

  const remove = useServerFn(eliminarDestajo);
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Destajo eliminado");
      qc.invalidateQueries({ queryKey: ["destajos", obraId] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const destajos = (listQ.data ?? []) as Destajo[];
  const contratado = destajos
    .filter((d) => d.estatus_base === "autorizado")
    .reduce((s, d) => s + Number(d.monto_total), 0);
  const pagado = destajos.reduce((s, d) => s + Number(d.pagado_acumulado), 0);
  const activos = destajos.filter((d) => d.estatus_base === "autorizado").length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Destajos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Subcontratación a trabajadores propios con presupuesto, órdenes de cambio
            y estimaciones semanales de avance.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4 mr-1" /> Nuevo destajo
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
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Destajos activos</p>
          <p className="mt-2 text-xl font-semibold">{activos}</p>
        </Card>
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : destajos.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay destajos. Crea uno para comenzar.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 w-12">#</th>
                <th className="text-left p-3">Destajo</th>
                <th className="text-left p-3">Destajista</th>
                <th className="text-left p-3 w-44">Estatus</th>
                <th className="text-right p-3 w-36">Contratado</th>
                <th className="text-right p-3 w-36">Pagado</th>
                <th className="text-right p-3 w-44">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {destajos.map((d) => {
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
                    <td className="p-3">{d.destajista_nombre}</td>
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
        <NuevoDestajoDialog
          obraId={obraId}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["destajos", obraId] });
            setViewingId(id);
          }}
        />
      )}

      {viewingId && (
        <DestajoDetalleSheet
          destajoId={viewingId}
          canAuthorize={director || isSupervisor}
          onClose={() => setViewingId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["destajos", obraId] })}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar destajo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.nombre}" junto con todos sus presupuestos y
              asignaciones. No se puede deshacer.
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
