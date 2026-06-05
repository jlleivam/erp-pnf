import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPresupuesto } from "@/lib/api/presupuestos.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMXN } from "@/lib/format";

type Renglon = {
  id: string;
  clave: string;
  nivel: number;
  parent_clave: string | null;
  concepto: string;
  unidad: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  importe: number;
  importe_delta?: number | null;
  tipo_movimiento?: "renglon" | "modificacion" | "adicion" | "eliminacion" | null;
  es_grupo: boolean;
};

const MOV_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  modificacion: { label: "Modif.", variant: "secondary" },
  adicion: { label: "Adición", variant: "default" },
  eliminacion: { label: "Elim.", variant: "destructive" },
};

export function VerPresupuestoSheet({
  presupuestoId,
  onClose,
}: {
  presupuestoId: string;
  onClose: () => void;
}) {
  const fetchOne = useServerFn(getPresupuesto);
  const { data, isLoading } = useQuery({
    queryKey: ["presupuesto", presupuestoId],
    queryFn: () => fetchOne({ data: { id: presupuestoId } }),
  });

  const presupuesto = data?.presupuesto;
  const renglones = (data?.renglones ?? []) as Renglon[];
  const esOC = presupuesto?.tipo === "adenda";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {presupuesto?.nombre ?? "Presupuesto"}
            {presupuesto && (
              <Badge variant={presupuesto.estatus === "autorizado" ? "default" : "secondary"}>
                {presupuesto.estatus === "autorizado" ? "Autorizado" : "Borrador"}
              </Badge>
            )}
            <span className="ml-auto text-base font-semibold">
              {presupuesto &&
                (esOC ? `Δ ${formatMXN(presupuesto.monto_total)}` : formatMXN(presupuesto.monto_total))}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : renglones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin renglones.</p>
          ) : (
            <TooltipProvider delayDuration={200}>
              <Card className="overflow-x-auto">
                <table className="w-full text-xs table-fixed">
                  <colgroup>
                    <col className="w-28" />
                    <col />
                    <col className="w-16" />
                    <col className="w-20" />
                    <col className="w-24" />
                    <col className="w-28" />
                  </colgroup>
                  <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1.5">Clave</th>
                      <th className="text-left px-2 py-1.5">Concepto</th>
                      <th className="text-left px-2 py-1.5">Unidad</th>
                      <th className="text-right px-2 py-1.5">Cantidad</th>
                      <th className="text-right px-2 py-1.5">PU</th>
                      <th className="text-right px-2 py-1.5">
                        {esOC ? "Δ Importe" : "Importe"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {renglones.map((r) => {
                      const mov = r.tipo_movimiento && MOV_LABEL[r.tipo_movimiento];
                      const valor = esOC ? Number(r.importe_delta ?? 0) : Number(r.importe);
                      return (
                        <tr
                          key={r.id}
                          className={`border-t border-border ${r.es_grupo ? "bg-muted/30 font-medium" : ""}`}
                        >
                          <td
                            className="px-2 py-1 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis"
                            style={{ paddingLeft: `${0.5 + (r.nivel - 1) * 1}rem` }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{r.clave}</span>
                              {mov && (
                                <Badge variant={mov.variant} className="text-[10px] h-4 px-1 shrink-0">
                                  {mov.label}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1 max-w-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate whitespace-nowrap overflow-hidden text-ellipsis cursor-default">
                                  {r.concepto}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start" className="max-w-md whitespace-normal">
                                {r.concepto}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-2 py-1 text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                            {r.unidad ?? "—"}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                            {r.cantidad != null ? Number(r.cantidad).toLocaleString("es-MX") : "—"}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                            {r.precio_unitario != null ? formatMXN(Number(r.precio_unitario)) : "—"}
                          </td>
                          <td
                            className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${
                              esOC && valor < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {formatMXN(valor)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </TooltipProvider>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
