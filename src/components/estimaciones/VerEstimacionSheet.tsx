import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getEstimacion } from "@/lib/api/estimaciones.functions";
import { formatRangoSemana } from "@/lib/estimacion-utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMXN } from "@/lib/format";

export function VerEstimacionSheet({
  estimacionId,
  onClose,
}: {
  estimacionId: string;
  onClose: () => void;
}) {
  const fetch = useServerFn(getEstimacion);
  const { data, isLoading } = useQuery({
    queryKey: ["estimacion", estimacionId],
    queryFn: () => fetch({ data: { id: estimacionId } }),
  });

  const est = data?.estimacion;
  const renglones = data?.renglones ?? [];

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Estimación #{est?.numero ?? "…"}
            {est && (
              <Badge variant={est.estatus === "cerrada" ? "default" : "secondary"}>
                {est.estatus === "cerrada" ? "Cerrada" : "Borrador"}
              </Badge>
            )}
            {est && (
              <span className="ml-auto text-base font-semibold">
                {formatMXN(Number(est.monto_total))}
              </span>
            )}
          </SheetTitle>
          {est && (
            <SheetDescription>
              {formatRangoSemana(est.semana_inicio, est.semana_fin)}
              {est.cerrada_at && (
                <> · Cerrada el {new Date(est.cerrada_at).toLocaleDateString("es-MX")}</>
              )}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : renglones.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
              Sin cantidades capturadas.
            </Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 w-24">Clave</th>
                    <th className="text-left p-2">Concepto</th>
                    <th className="text-left p-2 w-16">Un.</th>
                    <th className="text-right p-2 w-24">Cant. ejec.</th>
                    <th className="text-right p-2 w-28">PU</th>
                    <th className="text-right p-2 w-32">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((r: any) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2 tabular-nums">{r.renglon_clave}</td>
                      <td className="p-2">{r.concepto}</td>
                      <td className="p-2 text-muted-foreground">{r.unidad ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">
                        {Number(r.cantidad_ejecutada).toLocaleString("es-MX", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {formatMXN(Number(r.pu_vigente))}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {formatMXN(Number(r.importe_ejecutado))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
