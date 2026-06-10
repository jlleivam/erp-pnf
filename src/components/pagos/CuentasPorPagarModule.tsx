import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, HandCoins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { getSaldosProveedores, getDetalleSaldoProveedor } from "@/lib/api/pagos.functions";
import { listAnticiposDestajoPendientes } from "@/lib/api/destajos.functions";
import { RegistrarPagoAnticipoDialog } from "./RegistrarPagoAnticipoDialog";
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

  const fetchAnticiposCount = useServerFn(listAnticiposDestajoPendientes);
  const anticiposCountQ = useQuery({
    queryKey: ["anticipos-destajo-pendientes"],
    queryFn: () => fetchAnticiposCount(),
  });

  const rows: Row[] = ((saldosQ.data ?? []) as Row[])
    .filter((r) => r.razon_social.toLowerCase().includes(q.toLowerCase()));

  const totalGeneral = rows.reduce((s, r) => s + r.saldo_pendiente, 0);

  const ocPendientesCount = ((saldosQ.data ?? []) as Row[])
    .filter((r) => r.saldo_pendiente > 0).length;
  const anticiposPendientesCount = ((anticiposCountQ.data ?? []) as unknown[]).length;


  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas por pagar</h1>
        <p className="text-sm text-muted-foreground">
          Saldos pendientes con proveedores y solicitudes de anticipo de destajo.
        </p>
      </header>

      <Tabs defaultValue="proveedores">
        <TabsList>
          <TabsTrigger value="proveedores">
            Proveedores (OC)
            {ocPendientesCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                {ocPendientesCount > 99 ? "99+" : ocPendientesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="anticipos">
            Anticipos de destajo
            {anticiposPendientesCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                {anticiposPendientesCount > 99 ? "99+" : anticiposPendientesCount}
              </span>
            )}
          </TabsTrigger>

        </TabsList>

        <TabsContent value="proveedores" className="space-y-4 mt-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar proveedor…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Card className="px-4 py-2">
              <p className="text-xs text-muted-foreground">Pendiente total</p>
              <p className="text-xl font-semibold">{formatMXN(totalGeneral)}</p>
            </Card>
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
        </TabsContent>

        <TabsContent value="anticipos" className="mt-4">
          <AnticiposDestajoTab />
        </TabsContent>
      </Tabs>

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

type AnticipoRow = {
  anticipoId: string;
  destajoId: string;
  monto: number;
  solicitadoAt: string;
  notas: string | null;
  solicitadoPorNombre: string;
  destajoNombre: string;
  destajoNumero: number | null;
  destajistaNombre: string;
  obraNombre: string;
};

function AnticiposDestajoTab() {
  const fetchAnticipos = useServerFn(listAnticiposDestajoPendientes);
  const qc = useQueryClient();
  const [pagar, setPagar] = useState<AnticipoRow | null>(null);

  const antQ = useQuery({
    queryKey: ["anticipos-destajo-pendientes"],
    queryFn: () => fetchAnticipos(),
  });

  const rows = (antQ.data ?? []) as AnticipoRow[];
  const total = rows.reduce((s, r) => s + r.monto, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Total solicitado</p>
          <p className="text-xl font-semibold">{formatMXN(total)}</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Obra</TableHead>
              <TableHead>Destajo</TableHead>
              <TableHead>Destajista</TableHead>
              <TableHead>Solicitado</TableHead>
              <TableHead>Por</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {antQ.isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            )}
            {!antQ.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  <HandCoins className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin solicitudes de anticipo pendientes.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.anticipoId}>
                <TableCell className="text-sm">{r.obraNombre}</TableCell>
                <TableCell className="font-medium">
                  {r.destajoNumero != null ? `#${r.destajoNumero} · ` : ""}{r.destajoNombre}
                </TableCell>
                <TableCell className="text-sm">{r.destajistaNombre}</TableCell>
                <TableCell className="text-xs">{formatDate(r.solicitadoAt)}</TableCell>
                <TableCell className="text-xs">{r.solicitadoPorNombre}</TableCell>
                <TableCell className="text-right font-semibold">{formatMXN(r.monto)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => setPagar(r)}>Registrar pago</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {pagar && (
        <RegistrarPagoAnticipoDialog
          destajoId={pagar.destajoId}
          destajoNombre={pagar.destajoNombre}
          destajistaNombre={pagar.destajistaNombre}
          folio={(pagar as any).folio ?? null}
          montoTotalContrato={Number((pagar as any).destajoMontoTotal ?? 0)}
          anticipoPct={Number((pagar as any).destajoAnticipoPct ?? 0)}
          monto={pagar.monto}
          open={!!pagar}
          onOpenChange={(o) => !o && setPagar(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["anticipos-destajo-pendientes"] });
            qc.invalidateQueries({ queryKey: ["destajo-anticipo"] });
            qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
          }}
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
