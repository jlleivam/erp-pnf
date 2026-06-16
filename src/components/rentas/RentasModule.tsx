import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRentas } from "@/lib/api/rentas.functions";
import { useObraRole } from "@/hooks/useObraRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle } from "lucide-react";
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
        {puedeSolicitar && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4 mr-1" /> Nueva solicitud
          </Button>
        )}
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
        <Card>
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-3 w-10">#</th>
                <th className="text-left py-2 px-3">Equipo</th>
                <th className="text-left py-2 px-3 w-32 hidden sm:table-cell">Proveedor</th>
                <th className="text-left py-2 px-3 w-24">Estatus</th>
                <th className="text-left py-2 px-3 w-24 hidden md:table-cell">Llegada</th>
                <th className="text-left py-2 px-3 w-24">Vence</th>
                <th className="text-right py-2 px-3 w-28">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {rentas.map((r) => {
                const alerta =
                  r.estatus === "activa" &&
                  r.dias_restantes != null &&
                  r.dias_restantes <= r.dias_aviso_vencimiento;
                const handleOpen = () => setViewingId(r.id);
                return (
                  <tr
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={handleOpen}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpen();
                      }
                    }}
                    className="border-t border-border cursor-pointer hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
                  >
                    <td className="py-2 px-3 tabular-nums align-middle">{r.numero}</td>
                    <td className="py-2 px-3 align-middle">
                      <div className="truncate">
                        <span className="font-medium">{r.equipo}</span>
                        <span className="text-xs text-muted-foreground">
                          {" · "}
                          {r.cantidad > 1 ? `${r.cantidad}u · ` : ""}
                          {r.periodicidad ?? "sin periodicidad"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 align-middle truncate hidden sm:table-cell">
                      {r.proveedor_nombre ?? "—"}
                    </td>
                    <td className="py-2 px-3 align-middle">
                      <Badge variant={ESTATUS_VARIANT[r.estatus]}>
                        {ESTATUS_LABEL[r.estatus]}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 align-middle hidden md:table-cell">
                      {formatDate(r.fecha_llegada_real)}
                    </td>
                    <td className="py-2 px-3 align-middle">
                      <span className={alerta ? "text-yellow-600 font-medium" : ""}>
                        {formatDate(r.fecha_fin_programada)}
                      </span>
                      {alerta && r.dias_restantes != null && (
                        <div className="text-[11px] text-yellow-600 leading-tight">
                          {r.dias_restantes < 0
                            ? `−${Math.abs(r.dias_restantes)}d`
                            : `${r.dias_restantes}d`}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums align-middle">
                      {formatMXN(r.monto_acumulado)}
                      {r.dias_acumulados > 0 && (
                        <span className="text-xs text-muted-foreground"> ({r.dias_acumulados}d)</span>
                      )}
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

    </div>
  );
}
