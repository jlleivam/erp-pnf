import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listSemanasNominaPorPagar } from "@/lib/api/nominas.functions";
import { formatMXN, formatDate } from "@/lib/format";
import { PagarNominaSemanaSheet } from "./PagarNominaSemanaSheet";

export type SemanaNominaRow = {
  semana_inicio: string;
  semana_fin: string;
  total: number;
  obras: Array<{ nomina_id: string; obra_id: string; obra_nombre: string; monto: number }>;
  nomina_ids: string[];
};

export function NominaPorPagarTab() {
  const fetchSemanas = useServerFn(listSemanasNominaPorPagar);
  const [pagar, setPagar] = useState<SemanaNominaRow | null>(null);

  const q = useQuery({
    queryKey: ["nomina-por-pagar"],
    queryFn: () => fetchSemanas() as Promise<SemanaNominaRow[]>,
  });

  const rows = (q.data ?? []) as SemanaNominaRow[];
  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Nóminas cerradas pendientes de pago</h3>
          <p className="text-xs text-muted-foreground">
            Un pago por semana. Registra los cheques emitidos; el remanente se distribuye como vale de efectivo, uno por obra.
          </p>
        </div>
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Total por pagar</p>
          <p className="text-lg font-semibold">{formatMXN(total)}</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Obras</TableHead>
              <TableHead className="text-right">Total nómina</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            )}
            {!q.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  <Users className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin nóminas pendientes de pago.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.semana_inicio}>
                <TableCell className="whitespace-nowrap font-medium">
                  {formatDate(r.semana_inicio)} → {formatDate(r.semana_fin)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.obras.length} obra{r.obras.length === 1 ? "" : "s"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap font-semibold">
                  {formatMXN(r.total)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => setPagar(r)}>Pagar semana</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {pagar && (
        <PagarNominaSemanaSheet
          semana={pagar}
          open={!!pagar}
          onOpenChange={(o: boolean) => !o && setPagar(null)}
        />
      )}
    </div>
  );
}
