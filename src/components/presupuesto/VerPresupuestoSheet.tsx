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
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 w-28">Clave</th>
                    <th className="text-left p-2">Concepto</th>
                    <th className="text-left p-2 w-20">Unidad</th>
                    <th className="text-right p-2 w-24">Cantidad</th>
                    <th className="text-right p-2 w-28">PU</th>
                    <th className="text-right p-2 w-32">
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
                          className="p-2 tabular-nums"
                          style={{ paddingLeft: `${0.5 + (r.nivel - 1) * 1}rem` }}
                        >
                          <div className="flex items-center gap-1.5">
                            {r.clave}
                            {mov && (
                              <Badge variant={mov.variant} className="text-[10px] h-4 px-1">
                                {mov.label}
                              </Badge>
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
                        <td
                          className={`p-2 text-right tabular-nums ${
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
