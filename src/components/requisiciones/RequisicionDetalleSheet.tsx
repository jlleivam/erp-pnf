import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, X } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getRequisicion, cancelarRequisicion } from "@/lib/api/requisiciones.functions";
import { ESTATUS_META, TIMELINE_STEPS, type RequisicionEstatus } from "./constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";

interface Props {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEP_ORDER: RequisicionEstatus[] = [
  "enviada", "en_cotizacion", "pendiente_autorizacion", "oc_generada", "completada",
];

export function RequisicionDetalleSheet({ id, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  const fetchOne = useServerFn(getRequisicion);
  const cancelFn = useServerFn(cancelarRequisicion);

  const detalleQ = useQuery({
    queryKey: ["requisicion", id],
    queryFn: () => fetchOne({ data: { id } }),
    enabled: open,
  });
  const r: any = detalleQ.data;

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Requisición cancelada");
      qc.invalidateQueries({ queryKey: ["requisiciones"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const meta = r ? ESTATUS_META[r.estatus as RequisicionEstatus] : null;
  const currentIdx = r ? STEP_ORDER.indexOf(r.estatus) : -1;
  const rechazada = r?.estatus === "rechazada";
  const puedeCancelar = r && userId === r.creado_por && r.estatus === "enviada";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {r?.folio ?? "Requisición"}
            {meta && <Badge className={`${meta.badge} border-0`}>{meta.label}</Badge>}
          </SheetTitle>
        </SheetHeader>

        {detalleQ.isLoading && <p className="mt-4 text-sm text-muted-foreground">Cargando…</p>}

        {r && (
          <div className="space-y-6 mt-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Insumos solicitados</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-right">Solicitado</TableHead>
                      <TableHead className="text-right">Pedido</TableHead>
                      <TableHead className="text-right">Recibido</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Fecha req.</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(r.items ?? []).map((it: any) => {
                      const solicitado = Number(it.cantidad) || 0;
                      const pedido = Number(it.pedido) || 0;
                      const recibido = Number(it.recibido) || 0;
                      const fmt = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
                      const recibidoCls =
                        pedido === 0 && recibido === 0
                          ? "text-muted-foreground"
                          : recibido >= solicitado
                            ? "text-emerald-600 font-medium"
                            : recibido > 0
                              ? "text-amber-600"
                              : "text-muted-foreground";
                      const pedidoCls = pedido === 0 ? "text-muted-foreground" : "";
                      return (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">{it.insumo?.nombre}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(solicitado)}</TableCell>
                          <TableCell className={`text-right tabular-nums ${pedidoCls}`}>{fmt(pedido)}</TableCell>
                          <TableCell className={`text-right tabular-nums ${recibidoCls}`}>{fmt(recibido)}</TableCell>
                          <TableCell>{it.insumo?.unidad}</TableCell>
                          <TableCell>{formatDate(it.fecha_requerida)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {it.nota ?? "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

              </div>
            </div>

            {r.notas && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Notas generales</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{r.notas}</p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-3">Seguimiento</h3>
              <ol className="relative border-l-2 border-border pl-5 space-y-4">
                {TIMELINE_STEPS.map((step, idx) => {
                  const at = r[step.atField];
                  const responsable = step.porField ? r[step.porField] : null;
                  const done = !!at && (idx <= currentIdx || r.estatus === "completada");
                  const active = idx === currentIdx && !done && !rechazada;
                  return (
                    <li key={step.key} className="relative">
                      <span
                        className={`absolute -left-[27px] top-0.5 size-4 rounded-full flex items-center justify-center ${
                          done
                            ? "bg-emerald-500 text-white"
                            : active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? <Check className="size-3" /> : <Circle className="size-2 fill-current" />}
                      </span>
                      <p className={`text-sm font-medium ${done || active ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                      {at && (
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(at)}
                          {responsable && ` · ${responsable}`}
                        </p>
                      )}
                    </li>
                  );
                })}
                {rechazada && (
                  <li className="relative">
                    <span className="absolute -left-[27px] top-0.5 size-4 rounded-full bg-rose-500 text-white flex items-center justify-center">
                      <X className="size-3" />
                    </span>
                    <p className="text-sm font-medium text-rose-700">Rechazada</p>
                    {r.rechazada_at && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.rechazada_at)}
                        {r.rechazada_responsable && ` · ${r.rechazada_responsable}`}
                      </p>
                    )}
                    {r.rechazo_motivo && (
                      <p className="text-xs text-muted-foreground mt-1">{r.rechazo_motivo}</p>
                    )}
                  </li>
                )}
              </ol>
            </div>

            {puedeCancelar && (
              <Button
                variant="destructive"
                className="w-full"
                disabled={cancelMut.isPending}
                onClick={() => cancelMut.mutate()}
              >
                Cancelar requisición
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
