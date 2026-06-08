import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Building2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { getSaldosProveedores, getDetalleSaldoProveedor } from "@/lib/api/pagos.functions";
import { formatMXN, formatDate } from "@/lib/format";

type Row = {
  proveedor_id: string;
  razon_social: string;
  total_ordenado: number;
  total_pagado: number;
  saldo_pendiente: number;
  oc_pendientes_count: number;
};

const ESTADO_PAGO_BADGE: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-700",
  parcial: "bg-amber-100 text-amber-800",
  pagado: "bg-emerald-100 text-emerald-800",
};

export function CuentasPorPagarModule() {
  const fetchSaldos = useServerFn(getSaldosProveedores);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);

  const saldosQ = useQuery({
    queryKey: ["saldos-proveedores"],
    queryFn: () => fetchSaldos(),
  });

  const rows: Row[] = ((saldosQ.data ?? []) as Row[])
    .filter((r) => r.razon_social.toLowerCase().includes(q.toLowerCase()));

  const totalGeneral = rows.reduce((s, r) => s + r.saldo_pendiente, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas por pagar</h1>
          <p className="text-sm text-muted-foreground">
            Saldos pendientes por proveedor según órdenes de compra autorizadas o enviadas.
          </p>
        </div>
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Pendiente total</p>
          <p className="text-xl font-semibold">{formatMXN(totalGeneral)}</p>
        </Card>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar proveedor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Total ordenado</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo pendiente</TableHead>
              <TableHead className="text-right">OCs pend.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {saldosQ.isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            )}
            {!saldosQ.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin saldos pendientes con proveedores.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow
                key={r.proveedor_id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelected(r)}
              >
                <TableCell className="font-medium">{r.razon_social}</TableCell>
                <TableCell className="text-right">{formatMXN(r.total_ordenado)}</TableCell>
                <TableCell className="text-right">{formatMXN(r.total_pagado)}</TableCell>
                <TableCell className="text-right font-semibold">
                  <span className={r.saldo_pendiente > 0 ? "text-rose-700" : ""}>
                    {formatMXN(r.saldo_pendiente)}
                  </span>
                </TableCell>
                <TableCell className="text-right">{r.oc_pendientes_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {selected && (
        <ProveedorDetalleSheet
          proveedor={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        />
      )}
    </div>
  );
}

function ProveedorDetalleSheet({
  proveedor, open, onOpenChange,
}: {
  proveedor: Row;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const fetchDetalle = useServerFn(getDetalleSaldoProveedor);
  const detalleQ = useQuery({
    queryKey: ["saldo-proveedor", proveedor.proveedor_id],
    queryFn: () => fetchDetalle({ data: { proveedorId: proveedor.proveedor_id } }),
    enabled: open,
  });

  const ocs: any[] = detalleQ.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{proveedor.razon_social}</SheetTitle>
          <SheetDescription>Detalle de órdenes de compra y saldo</SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Ordenado</p>
            <p className="font-semibold">{formatMXN(proveedor.total_ordenado)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="font-semibold">{formatMXN(proveedor.total_pagado)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Pendiente</p>
            <p className="font-semibold text-rose-700">{formatMXN(proveedor.saldo_pendiente)}</p>
          </Card>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2">Órdenes de compra</h3>
          {detalleQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!detalleQ.isLoading && ocs.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin OCs activas.</p>
          )}
          {ocs.length > 0 && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ocs.map((oc) => {
                    const total = Number(oc.total);
                    const pagado = Number(oc.monto_pagado);
                    const pend = +(total - pagado).toFixed(2);
                    return (
                      <TableRow key={oc.id}>
                        <TableCell className="font-medium">{oc.folio}</TableCell>
                        <TableCell className="text-xs">{oc.obra?.nombre ?? "—"}</TableCell>
                        <TableCell className="text-xs">{formatDate(oc.created_at)}</TableCell>
                        <TableCell className="text-right">{formatMXN(total)}</TableCell>
                        <TableCell className="text-right">{formatMXN(pagado)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatMXN(pend)}</TableCell>
                        <TableCell>
                          <Badge className={ESTADO_PAGO_BADGE[oc.estado_pago]}>
                            {oc.estado_pago === "pagado" ? "Pagado" : oc.estado_pago === "parcial" ? "Parcial" : "Pendiente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
