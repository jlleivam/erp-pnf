import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPresupuesto } from "@/lib/api/presupuestos.functions";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  es_grupo: boolean;
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
              {presupuesto && formatMXN(presupuesto.monto_total)}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : renglones.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin renglones.</p>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 w-24">Clave</th>
                    <th className="text-left p-2">Concepto</th>
                    <th className="text-left p-2 w-20">Unidad</th>
                    <th className="text-right p-2 w-24">Cantidad</th>
                    <th className="text-right p-2 w-28">PU</th>
                    <th className="text-right p-2 w-32">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-t border-border ${r.es_grupo ? "bg-muted/30 font-medium" : ""}`}
                    >
                      <td className="p-2 tabular-nums" style={{ paddingLeft: `${0.5 + (r.nivel - 1) * 1}rem` }}>
                        {r.clave}
                      </td>
                      <td className="p-2">{r.concepto}</td>
                      <td className="p-2 text-muted-foreground">{r.unidad ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">
                        {r.cantidad != null ? Number(r.cantidad).toLocaleString("es-MX") : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {r.precio_unitario != null ? formatMXN(Number(r.precio_unitario)) : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums">{formatMXN(Number(r.importe))}</td>
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
