import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listCxPGastosObra } from "@/lib/api/gastos-obra.functions";
import { formatMXN, formatDate } from "@/lib/format";
import { RegistrarPagoCxPDialog } from "./RegistrarPagoCxPDialog";
import { TruncatedCell } from "./TruncatedCell";

type Row = {
  id: string;
  folio: string;
  fecha_emision: string;
  obra_id: string | null;
  obra_nombre: string | null;
  beneficiario_nombre: string;
  concepto: string;
  monto_total: number;
  monto_pagado: number;
  pendiente: number;
  estatus: string;
  requiere_banco: boolean;
};

export function GastosObraPorPagarTab() {
  const fetchCxP = useServerFn(listCxPGastosObra);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pagar, setPagar] = useState<Row | null>(null);

  const cxpQ = useQuery({
    queryKey: ["gastos-obra-por-pagar"],
    queryFn: () => fetchCxP(),
  });

  const all = ((cxpQ.data ?? []) as Row[]).filter((r) => r.pendiente > 0.009);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((r) =>
      r.folio.toLowerCase().includes(term) ||
      (r.obra_nombre ?? "").toLowerCase().includes(term) ||
      r.beneficiario_nombre.toLowerCase().includes(term) ||
      r.concepto.toLowerCase().includes(term),
    );
  }, [all, q]);

  const total = useMemo(() => all.reduce((s, r) => s + r.pendiente, 0), [all]);

  const onSaved = () => {
    setPagar(null);
    qc.invalidateQueries({ queryKey: ["gastos-obra-por-pagar"] });
    qc.invalidateQueries({ queryKey: ["gastos-obra"] });
    qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Gastos de obra por pagar</h3>
          <p className="text-xs text-muted-foreground">
            Pagos directos autorizados por el supervisor. Con factura se paga desde banco; con nota,
            desde caja fuerte.
          </p>
        </div>
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Total pendiente</p>
          <p className="text-lg font-semibold">{formatMXN(total)}</p>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar folio, obra, proveedor o concepto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cxpQ.isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!cxpQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  <Receipt className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin gastos de obra pendientes.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap font-medium">{r.folio}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(r.fecha_emision)}</TableCell>
                <TableCell className="max-w-[140px]">
                  <TruncatedCell text={r.obra_nombre ?? "—"} />
                </TableCell>
                <TableCell className="max-w-[160px]">
                  <TruncatedCell text={r.beneficiario_nombre} />
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <TruncatedCell text={r.concepto} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={r.requiere_banco ? "default" : "secondary"}>
                    {r.requiere_banco ? "Banco (factura)" : "Caja fuerte (nota)"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatMXN(r.monto_total)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap font-semibold">
                  {formatMXN(r.pendiente)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => setPagar(r)}>Pagar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {pagar && (
        <RegistrarPagoCxPDialog
          cxpId={pagar.id}
          folio={pagar.folio}
          beneficiarioNombre={pagar.beneficiario_nombre}
          saldoPendiente={pagar.pendiente}
          open={!!pagar}
          onOpenChange={(o) => !o && setPagar(null)}
          onSaved={onSaved}
          defaultCuentaTipo={pagar.requiere_banco ? "bancaria" : "caja_fuerte"}
          restringirCuentaTipo
        />
      )}
    </div>
  );
}
