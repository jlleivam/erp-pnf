import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listRentas, eliminarRenta } from "@/lib/api/rentas.functions";
import { useObraRole } from "@/hooks/useObraRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Eye, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatMXN, formatDate } from "@/lib/format";
import { NuevaRentaDialog } from "./NuevaRentaDialog";
import { RentaDetalleSheet } from "./RentaDetalleSheet";

type Renta = {
  id: string;
  obra_id: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  numero: number;
  equipo: string;
  cantidad: number;
  descripcion: string | null;
  periodicidad: "diaria" | "semanal" | "quincenal" | "mensual" | null;
  tarifa_unitaria: number;
  estatus: "borrador" | "cotizada" | "autorizada" | "rechazada" | "activa" | "devuelta";
  fecha_llegada_real: string | null;
  fecha_fin_programada: string | null;
  dias_aviso_vencimiento: number;
  monto_acumulado: number;
  dias_acumulados: number;
  dias_restantes: number | null;
};

const ESTATUS_LABEL: Record<Renta["estatus"], string> = {
  borrador: "Borrador",
  cotizada: "Cotizada",
  autorizada: "Autorizada",
  rechazada: "Rechazada",
  activa: "Activa",
  devuelta: "Devuelta",
};
const ESTATUS_VARIANT: Record<Renta["estatus"], "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "secondary",
  cotizada: "outline",
  autorizada: "default",
  rechazada: "destructive",
  activa: "default",
  devuelta: "secondary",
};

export function RentasModule({ obraId }: { obraId: string }) {
  const { isResidente, isSupervisor, isDirector, isAdministrativo } = useObraRole(obraId);
  const puedeSolicitar = isDirector || isSupervisor || isResidente;
  const director = isDirector;

  const qc = useQueryClient();
  const fetchList = useServerFn(listRentas);
  const listQ = useQuery({
    queryKey: ["rentas", obraId],
    queryFn: () => fetchList({ data: { obraId } }),
  });

  const [creating, setCreating] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Renta | null>(null);

  const remove = useServerFn(eliminarRenta);
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Renta eliminada");
      qc.invalidateQueries({ queryKey: ["rentas", obraId] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rentas = (listQ.data ?? []) as Renta[];
  const activas = rentas.filter((r) => r.estatus === "activa");
  const acumuladoActivas = activas.reduce((s, r) => s + Number(r.monto_acumulado), 0);
  const porVencer = activas.filter(
    (r) => r.dias_restantes != null && r.dias_restantes <= r.dias_aviso_vencimiento,
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rentas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Equipos rentados con cobro periódico. El residente solicita, el administrativo
            cotiza, el supervisor autoriza. Marca la llegada y reporta averías o inactividad.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4 mr-1" /> Nueva solicitud
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Rentas activas</p>
          <p className="mt-2 text-xl font-semibold">{activas.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Acumulado vigente</p>
          <p className="mt-2 text-xl font-semibold">{formatMXN(acumuladoActivas)}</p>
        </Card>
        <Card className={`p-4 ${porVencer.length > 0 ? "border-yellow-500/40 bg-yellow-500/5" : ""}`}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            {porVencer.length > 0 && <AlertTriangle className="size-3" />}
            Próximas a vencer
          </p>
          <p className="mt-2 text-xl font-semibold">{porVencer.length}</p>
        </Card>
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rentas.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no hay rentas. Crea una solicitud para comenzar.
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3 w-12">#</th>
                <th className="text-left p-3">Equipo</th>
                <th className="text-left p-3">Proveedor</th>
                <th className="text-left p-3 w-32">Estatus</th>
                <th className="text-left p-3 w-32">Llegada</th>
                <th className="text-left p-3 w-32">Vence</th>
                <th className="text-right p-3 w-36">Acumulado</th>
                <th className="text-right p-3 w-44">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rentas.map((r) => {
                const alerta =
                  r.estatus === "activa" &&
                  r.dias_restantes != null &&
                  r.dias_restantes <= r.dias_aviso_vencimiento;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 tabular-nums">{r.numero}</td>
                    <td className="p-3">
                      <p className="font-medium">{r.equipo}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.cantidad > 1 ? `${r.cantidad} unidades · ` : ""}
                        {r.periodicidad ?? "sin periodicidad"}
                      </p>
                    </td>
                    <td className="p-3">{r.proveedor_nombre ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant={ESTATUS_VARIANT[r.estatus]}>
                        {ESTATUS_LABEL[r.estatus]}
                      </Badge>
                    </td>
                    <td className="p-3">{formatDate(r.fecha_llegada_real)}</td>
                    <td className="p-3">
                      <span className={alerta ? "text-yellow-600 font-medium" : ""}>
                        {formatDate(r.fecha_fin_programada)}
                      </span>
                      {alerta && r.dias_restantes != null && (
                        <p className="text-xs text-yellow-600">
                          {r.dias_restantes < 0
                            ? `Vencida hace ${Math.abs(r.dias_restantes)} días`
                            : `En ${r.dias_restantes} días`}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatMXN(r.monto_acumulado)}
                      {r.dias_acumulados > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {r.dias_acumulados} días
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setViewingId(r.id)}>
                          <Eye className="size-4 mr-1" /> Abrir
                        </Button>
                        {director && r.estatus === "borrador" && (
                          <Button size="sm" variant="ghost" onClick={() => setToDelete(r)}>
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
        <NuevaRentaDialog
          obraId={obraId}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["rentas", obraId] });
            setViewingId(id);
          }}
        />
      )}

      {viewingId && (
        <RentaDetalleSheet
          rentaId={viewingId}
          canAuthorize={director || isSupervisor}
          canCotizar={director || isAdministrativo}
          onClose={() => setViewingId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["rentas", obraId] })}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar renta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.equipo}" junto con sus eventos y pagos. No se puede deshacer.
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
