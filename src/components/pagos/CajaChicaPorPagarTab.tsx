import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listCxPCajaChicaFondoPendientes } from "@/lib/api/pagos.functions";
import { formatMXN, formatDate } from "@/lib/format";
import { RegistrarPagoCxPDialog } from "./RegistrarPagoCxPDialog";

type Row = {
  id: string;
  folio: string;
  fecha_emision: string;
  obra_id: string | null;
  obra_nombre: string | null;
  beneficiario_id: string | null;
  beneficiario_nombre: string;
  concepto: string;
  monto_total: number;
  monto_pagado: number;
  saldo: number;
  estatus: string;
};

export function CajaChicaPorPagarTab() {
  const fetchCxP = useServerFn(listCxPCajaChicaFondoPendientes);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pagar, setPagar] = useState<Row | null>(null);

  const cxpQ = useQuery({
    queryKey: ["caja-chica-por-pagar"],
    queryFn: () => fetchCxP(),
  });

  const all = (cxpQ.data ?? []) as Row[];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((r) =>
      r.folio.toLowerCase().includes(term) ||
      (r.obra_nombre ?? "").toLowerCase().includes(term) ||
      r.beneficiario_nombre.toLowerCase().includes(term),
    );
  }, [all, q]);

  const totalSaldo = useMemo(() => all.reduce((s, r) => s + r.saldo, 0), [all]);

  const onSaved = () => {
    setPagar(null);
    qc.invalidateQueries({ queryKey: ["caja-chica-por-pagar"] });
    qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
    qc.invalidateQueries({ queryKey: ["caja-chica"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Fondos de caja chica por pagar</h3>
          <p className="text-xs text-muted-foreground">
            Solicitudes ya autorizadas por el supervisor. Paga en efectivo desde la caja fuerte.
          </p>
        </div>
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Saldo total</p>
          <p className="text-lg font-semibold">{formatMXN(totalSaldo)}</p>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar folio, obra o residente…"
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
              <TableHead>Residente</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cxpQ.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!cxpQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  <Wallet className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin fondos de caja chica pendientes.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.folio}</TableCell>
                <TableCell className="text-xs">{formatDate(r.fecha_emision)}</TableCell>
                <TableCell className="text-xs">{r.obra_nombre ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.beneficiario_nombre}</TableCell>
                <TableCell className="text-right">{formatMXN(r.monto_total)}</TableCell>
                <TableCell className="text-right">{formatMXN(r.monto_pagado)}</TableCell>
                <TableCell className="text-right font-semibold">{formatMXN(r.saldo)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => setPagar(r)}>Registrar pago</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {pagar && (
        <RegistrarPagoCxPDialog
          open={!!pagar}
          onOpenChange={(o) => { if (!o) setPagar(null); }}
          cxpId={pagar.id}
          folio={pagar.folio}
          beneficiarioNombre={pagar.beneficiario_nombre}
          saldoPendiente={pagar.saldo}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
