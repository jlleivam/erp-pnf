import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getVigente } from "@/lib/api/presupuestos.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/lib/format";

export function VerVigenteSheet({
  obraId,
  onClose,
}: {
  obraId: string;
  onClose: () => void;
}) {
  const fetch = useServerFn(getVigente);
  const { data, isLoading } = useQuery({
    queryKey: ["presupuesto-vigente", obraId],
    queryFn: () => fetch({ data: { obraId } }),
  });

  const vigente = data?.vigente ?? [];
  const total = data?.montoTotal ?? 0;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Presupuesto vigente
            <span className="ml-auto text-base font-semibold">{formatMXN(total)}</span>
          </SheetTitle>
          <SheetDescription>
            Consolidado del presupuesto base más las órdenes de cambio autorizadas.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : !data?.hasBase ? (
            <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay presupuesto base autorizado todavía.
            </Card>
          ) : vigente.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin renglones.</p>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 w-24">Clave</th>
                    <th className="text-left p-2">Concepto</th>
                    <th className="text-left p-2 w-20">Unidad</th>
                    <th className="text-right p-2 w-24">Cant.</th>
                    <th className="text-right p-2 w-28">PU</th>
                    <th className="text-right p-2 w-32">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {vigente.map((r: any) => (
                    <tr
                      key={r.clave}
                      className={`border-t border-border ${r.es_grupo ? "bg-muted/30 font-medium" : ""}`}
                    >
                      <td
                        className="p-2 tabular-nums"
                        style={{ paddingLeft: `${0.5 + (r.nivel - 1) * 1}rem` }}
                      >
                        <div className="flex items-center gap-1.5">
                          {r.clave}
                          {r.origen === "modificada" && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              Mod
                            </Badge>
                          )}
                          {r.origen === "agregada" && (
                            <Badge className="text-[10px] h-4 px-1">Nuevo</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2">{r.concepto}</td>
                      <td className="p-2 text-muted-foreground">{r.unidad ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">
                        {r.cantidad != null ? Number(r.cantidad).toLocaleString("es-MX") : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {r.precio_unitario != null ? formatMXN(Number(r.precio_unitario)) : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {formatMXN(Number(r.importe))}
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
