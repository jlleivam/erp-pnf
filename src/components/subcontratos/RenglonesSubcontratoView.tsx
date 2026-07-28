import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSubcontratoPresupuesto } from "@/lib/api/subcontratos.functions";
import { procesarRenglones, type RenglonInput } from "@/lib/presupuesto-utils";
import { Card } from "@/components/ui/card";
import { formatMXN } from "@/lib/format";

export function RenglonesSubcontratoView({
  presupuestoSubcontratoId,
}: {
  presupuestoSubcontratoId: string;
}) {
  const fetchOne = useServerFn(getSubcontratoPresupuesto);
  const { data, isLoading } = useQuery({
    queryKey: ["subcontrato-presupuesto", presupuestoSubcontratoId],
    queryFn: () => fetchOne({ data: { id: presupuestoSubcontratoId } }),
  });

  const calc = useMemo(() => {
    const input: RenglonInput[] = (data?.renglones ?? []).map((r: any) => ({
      clave: r.clave,
      concepto: r.concepto,
      unidad: r.unidad ?? null,
      cantidad: r.cantidad,
      precio_unitario: r.precio_unitario,
    }));
    return procesarRenglones(input);
  }, [data]);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Cargando renglones…</p>;
  }

  if (calc.renglones.length === 0) {
    return (
      <Card className="border-dashed p-4 text-center text-xs text-muted-foreground">
        Aún no hay renglones capturados.
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left p-2 w-20">Clave</th>
            <th className="text-left p-2">Concepto</th>
            <th className="text-left p-2 w-16">Unidad</th>
            <th className="text-right p-2 w-20">Cantidad</th>
            <th className="text-right p-2 w-24">PU</th>
            <th className="text-right p-2 w-28">Importe</th>
          </tr>
        </thead>
        <tbody>
          {calc.renglones.map((r) => (
            <tr
              key={r.clave}
              className={`border-t border-border ${
                r.es_grupo ? "bg-accent/40 font-medium" : ""
              }`}
            >
              <td className="p-2 tabular-nums">{r.clave}</td>
              <td className="p-2">{r.concepto}</td>
              {r.es_grupo ? (
                <>
                  <td className="p-2 text-center text-muted-foreground">—</td>
                  <td className="p-2 text-center text-muted-foreground">—</td>
                  <td className="p-2 text-center text-muted-foreground">—</td>
                </>
              ) : (
                <>
                  <td className="p-2">{r.unidad ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">{r.cantidad ?? "—"}</td>
                  <td className="p-2 text-right tabular-nums">
                    {r.precio_unitario != null ? formatMXN(r.precio_unitario) : "—"}
                  </td>
                </>
              )}
              <td className="p-2 text-right tabular-nums">{formatMXN(r.importe)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/30">
            <td colSpan={5} className="p-2 text-right text-xs uppercase tracking-wider text-muted-foreground">
              Total
            </td>
            <td className="p-2 text-right font-semibold tabular-nums">
              {formatMXN(calc.montoTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
