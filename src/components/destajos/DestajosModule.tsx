import { useEffect, useState } from "react";

import { useSearch, useNavigate } from "@tanstack/react-router";
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
  enviado: "Por autorizar",
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
  const { isSupervisor } = useObraRole(obraId);
  const qc = useQueryClient();
  const fetchList = useServerFn(listDestajos);
  const listQ = useQuery({
    queryKey: ["destajos", obraId],
    queryFn: () => fetchList({ data: { obraId } }),
  });

  const [creating, setCreating] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Destajo | null>(null);

  // Abrir automáticamente el destajo indicado en ?destajo=<id> (notificación).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("destajo");
    if (id) {
      setViewingId(id);
      params.delete("destajo");
      const qs = params.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : "");
      window.history.replaceState({}, "", url);
    }
  }, []);


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
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight">Destajos</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4 mr-1" /> Nuevo destajo
        </Button>
      </header>

      <Card className="flex divide-x divide-border">
        <div className="flex-1 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Contratado vigente</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">{formatMXN(contratado)}</p>
        </div>
        <div className="flex-1 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pagado acumulado</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">{formatMXN(pagado)}</p>
        </div>
        <div className="flex-1 p-3 bg-primary/5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Destajos activos</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">{activos}</p>
        </div>
      </Card>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : destajos.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay destajos. Crea uno para comenzar.
        </Card>
      ) : (
        <Card>
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-1.5 px-2 w-10">#</th>
                <th className="text-left py-1.5 px-2">Destajo</th>
                <th className="text-left py-1.5 px-2 w-32">Destajista</th>
                <th className="text-left py-1.5 px-2 w-28">Estatus</th>
                <th className="text-right py-1.5 px-2 w-28">Contratado</th>
                <th className="text-right py-1.5 px-2 w-28">Pagado</th>
                <th className="text-right py-1.5 px-2 w-20">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {destajos.map((d) => {
                const pct = d.monto_total > 0
                  ? (d.pagado_acumulado / d.monto_total) * 100
                  : 0;
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="py-1.5 px-2 tabular-nums">{d.numero}</td>
                    <td className="py-1.5 px-2">
                      <p className="font-medium truncate" title={d.descripcion ?? undefined}>{d.nombre}</p>
                    </td>
                    <td className="py-1.5 px-2 truncate">{d.destajista_nombre}</td>
                    <td className="py-1.5 px-2">
                      <Badge variant={ESTATUS_VARIANT[d.estatus_base]} className="whitespace-nowrap text-[10px] py-0 px-1.5 h-5">
                        {ESTATUS_LABEL[d.estatus_base]}
                      </Badge>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{formatMXN(d.monto_total)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {formatMXN(d.pagado_acumulado)}
                      {d.monto_total > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-1">{pct.toFixed(0)}%</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setViewingId(d.id)}>
                          <Eye className="size-3.5" />
                        </Button>
                        {director && d.estatus_base === "borrador" && d.pagado_acumulado === 0 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setToDelete(d)}>
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
