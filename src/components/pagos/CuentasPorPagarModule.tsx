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
import { getSaldosProveedores, getDetalleSaldoProveedor, listCxPDestajoPendientes, listCxPSubcontratoPendientes } from "@/lib/api/pagos.functions";
import { listAnticiposDestajoPendientes } from "@/lib/api/destajos.functions";
import { listAnticiposSubcontratoPendientes } from "@/lib/api/subcontratos.functions";
import { listValesPorPagar } from "@/lib/api/vales-gasolina.functions";
import { listCxPCajaChicaFondoPendientes } from "@/lib/api/pagos.functions";
import { RegistrarPagoAnticipoDialog } from "./RegistrarPagoAnticipoDialog";
import { RegistrarPagoAnticipoSubcontratoDialog } from "./RegistrarPagoAnticipoSubcontratoDialog";
import { RegistrarPagoOCDialog } from "./RegistrarPagoOCDialog";
import { RegistrarPagoCxPDialog } from "./RegistrarPagoCxPDialog";
import { GasolinasPorPagarTab } from "./GasolinasPorPagarTab";
import { CajaChicaPorPagarTab } from "./CajaChicaPorPagarTab";
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

  const fetchEstimacionesCount = useServerFn(listCxPDestajoPendientes);
  const estimacionesCountQ = useQuery({
    queryKey: ["cxp-destajo-pendientes"],
    queryFn: () => fetchEstimacionesCount(),
  });

  const fetchAnticiposSubCount = useServerFn(listAnticiposSubcontratoPendientes);
  const anticiposSubCountQ = useQuery({
    queryKey: ["anticipos-subcontrato-pendientes"],
    queryFn: () => fetchAnticiposSubCount(),
  });
  const fetchEstSubCount = useServerFn(listCxPSubcontratoPendientes);
  const estSubCountQ = useQuery({
    queryKey: ["cxp-subcontrato-pendientes"],
    queryFn: () => fetchEstSubCount(),
  });

  const fetchValesCount = useServerFn(listValesPorPagar);
  const valesCountQ = useQuery({
    queryKey: ["vales-por-pagar"],
    queryFn: () => fetchValesCount(),
  });

  const fetchCajaChicaCount = useServerFn(listCxPCajaChicaFondoPendientes);
  const cajaChicaCountQ = useQuery({
    queryKey: ["caja-chica-por-pagar"],
    queryFn: () => fetchCajaChicaCount(),
  });

  const rows: Row[] = ((saldosQ.data ?? []) as Row[])
    .filter((r) => r.razon_social.toLowerCase().includes(q.toLowerCase()));

  const totalGeneral = rows.reduce((s, r) => s + r.saldo_pendiente, 0);

  const ocPendientesCount = ((saldosQ.data ?? []) as Row[])
    .filter((r) => r.saldo_pendiente > 0).length;
  const anticiposPendientesCount =
    ((anticiposCountQ.data ?? []) as unknown[]).length
    + ((estimacionesCountQ.data ?? []) as unknown[]).length;
  const subcontratosPendientesCount =
    ((anticiposSubCountQ.data ?? []) as unknown[]).length
    + ((estSubCountQ.data ?? []) as unknown[]).length;
  const gasolinasPendientesCount = ((valesCountQ.data ?? []) as unknown[]).length;
  const cajaChicaPendientesCount = ((cajaChicaCountQ.data ?? []) as unknown[]).length;


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
            Destajos
            {anticiposPendientesCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                {anticiposPendientesCount > 99 ? "99+" : anticiposPendientesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="subcontratos">
            Subcontratos
            {subcontratosPendientesCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                {subcontratosPendientesCount > 99 ? "99+" : subcontratosPendientesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="gasolinas">
            Gasolinas
            {gasolinasPendientesCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                {gasolinasPendientesCount > 99 ? "99+" : gasolinasPendientesCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="caja-chica">
            Caja chica
            {cajaChicaPendientesCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none">
                {cajaChicaPendientesCount > 99 ? "99+" : cajaChicaPendientesCount}
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

        <TabsContent value="subcontratos" className="mt-4">
          <AnticiposSubcontratoTab />
        </TabsContent>

        <TabsContent value="gasolinas" className="mt-4">
          <GasolinasPorPagarTab />
        </TabsContent>

        <TabsContent value="caja-chica" className="mt-4">
          <CajaChicaPorPagarTab />
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

type CxPRow = {
  id: string;
  folio: string;
  fecha_emision: string;
  obra_id: string | null;
  obra_nombre: string | null;
  beneficiario_nombre: string;
  concepto: string;
  monto_total: number;
  monto_pagado: number;
  saldo: number;
  estatus: "pendiente" | "parcial" | "pagada" | "cancelada";
  origen_tipo: string;
  origen_id: string | null;
};

type UnifiedRow =
  | {
      key: string;
      tipo: "anticipo";
      fecha: string;
      folio: string;
      obra: string;
      destajista: string;
      concepto: string;
      total: number;
      pagado: number;
      saldo: number;
      estatus: "pendiente";
      anticipo: AnticipoRow;
    }
  | {
      key: string;
      tipo: "estimacion";
      fecha: string;
      folio: string;
      obra: string;
      destajista: string;
      concepto: string;
      total: number;
      pagado: number;
      saldo: number;
      estatus: "pendiente" | "parcial" | "pagada" | "cancelada";
      cxp: CxPRow;
    };

function AnticiposDestajoTab() {
  const fetchAnticipos = useServerFn(listAnticiposDestajoPendientes);
  const fetchEstimaciones = useServerFn(listCxPDestajoPendientes);
  const qc = useQueryClient();
  const [pagar, setPagar] = useState<AnticipoRow | null>(null);
  const [pagarCxP, setPagarCxP] = useState<CxPRow | null>(null);

  const antQ = useQuery({
    queryKey: ["anticipos-destajo-pendientes"],
    queryFn: () => fetchAnticipos(),
  });
  const estQ = useQuery({
    queryKey: ["cxp-destajo-pendientes"],
    queryFn: () => fetchEstimaciones(),
  });

  const anticipos = (antQ.data ?? []) as AnticipoRow[];
  const estimaciones = (estQ.data ?? []) as CxPRow[];

  const unified: UnifiedRow[] = [
    ...estimaciones.map<UnifiedRow>((r) => ({
      key: `est-${r.id}`,
      tipo: "estimacion",
      fecha: r.fecha_emision,
      folio: r.folio,
      obra: r.obra_nombre ?? "—",
      destajista: r.beneficiario_nombre,
      concepto: r.concepto,
      total: r.monto_total,
      pagado: r.monto_pagado,
      saldo: r.saldo,
      estatus: r.estatus,
      cxp: r,
    })),
    ...anticipos.map<UnifiedRow>((r) => ({
      key: `ant-${r.anticipoId}`,
      tipo: "anticipo",
      fecha: r.solicitadoAt,
      folio: r.destajoNumero != null ? `#${r.destajoNumero} · ${r.destajoNombre}` : r.destajoNombre,
      obra: r.obraNombre,
      destajista: r.destajistaNombre,
      concepto: r.notas ? `Anticipo de destajo · ${r.notas}` : "Anticipo de destajo",
      total: r.monto,
      pagado: 0,
      saldo: r.monto,
      estatus: "pendiente",
      anticipo: r,
    })),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const totalSaldo = unified.reduce((s, r) => s + r.saldo, 0);
  const isLoading = antQ.isLoading || estQ.isLoading;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["anticipos-destajo-pendientes"] });
    qc.invalidateQueries({ queryKey: ["cxp-destajo-pendientes"] });
    qc.invalidateQueries({ queryKey: ["destajo-anticipo"] });
    qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Pagos a destajistas pendientes</h3>
          <p className="text-xs text-muted-foreground">
            Anticipos solicitados y estimaciones autorizadas pendientes de pago.
          </p>
        </div>
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Saldo total</p>
          <p className="text-lg font-semibold">{formatMXN(totalSaldo)}</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Folio / Ref</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Destajista</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && unified.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">
                  <HandCoins className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin pagos a destajistas pendientes.
                </TableCell>
              </TableRow>
            )}
            {unified.map((r) => (
              <TableRow key={r.key}>
                <TableCell>
                  <Badge
                    className={
                      r.tipo === "anticipo"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }
                  >
                    {r.tipo === "anticipo" ? "Anticipo" : "Estimación"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-sm">{r.folio}</TableCell>
                <TableCell className="text-xs">{r.obra}</TableCell>
                <TableCell className="text-sm">{r.destajista}</TableCell>
                <TableCell className="text-xs max-w-[260px] truncate" title={r.concepto}>{r.concepto}</TableCell>
                <TableCell className="text-xs">{formatDate(r.fecha)}</TableCell>
                <TableCell className="text-right">{formatMXN(r.total)}</TableCell>
                <TableCell className="text-right">{formatMXN(r.pagado)}</TableCell>
                <TableCell className="text-right font-semibold">{formatMXN(r.saldo)}</TableCell>
                <TableCell>
                  <Badge className={ESTADO_PAGO_BADGE[r.estatus === "pagada" ? "pagado" : r.estatus] ?? ""}>
                    {r.estatus === "parcial" ? "Parcial" : r.estatus === "pagada" ? "Pagado" : "Pendiente"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {r.saldo > 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (r.tipo === "anticipo") setPagar(r.anticipo);
                        else setPagarCxP(r.cxp);
                      }}
                    >
                      Registrar pago
                    </Button>
                  )}
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
          onSaved={invalidateAll}
        />
      )}

      {pagarCxP && (
        <RegistrarPagoCxPDialog
          cxpId={pagarCxP.id}
          folio={pagarCxP.folio}
          beneficiarioNombre={pagarCxP.beneficiario_nombre}
          saldoPendiente={pagarCxP.saldo}
          open={!!pagarCxP}
          onOpenChange={(o) => !o && setPagarCxP(null)}
          onSaved={invalidateAll}
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
  const qc = useQueryClient();
  const [pagarOC, setPagarOC] = useState<{ id: string; folio: string; pendiente: number } | null>(null);

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
                    <TableHead className="text-right">Acción</TableHead>
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
                        <TableCell className="text-right">
                          {pend > 0 && (
                            <Button
                              size="sm"
                              onClick={() => setPagarOC({ id: oc.id, folio: oc.folio, pendiente: pend })}
                            >
                              Registrar pago
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        {pagarOC && (
          <RegistrarPagoOCDialog
            ocId={pagarOC.id}
            ocFolio={pagarOC.folio}
            saldoPendiente={pagarOC.pendiente}
            open={!!pagarOC}
            onOpenChange={(o) => !o && setPagarOC(null)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["saldos-proveedores"] });
              qc.invalidateQueries({ queryKey: ["saldo-proveedor", proveedor.proveedor_id] });
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type AnticipoSubRow = {
  anticipoId: string;
  subcontratoId: string;
  monto: number;
  folio: string | null;
  solicitadoAt: string;
  notas: string | null;
  solicitadoPorNombre: string;
  subcontratoNombre: string;
  subcontratoNumero: number | null;
  subcontratoMontoTotal: number;
  subcontratoAnticipoPct: number;
  contratistaNombre: string;
  obraNombre: string;
};

type UnifiedSubRow =
  | {
      key: string;
      tipo: "anticipo";
      fecha: string;
      folio: string;
      obra: string;
      contratista: string;
      concepto: string;
      total: number;
      pagado: number;
      saldo: number;
      estatus: "pendiente";
      anticipo: AnticipoSubRow;
    }
  | {
      key: string;
      tipo: "estimacion";
      fecha: string;
      folio: string;
      obra: string;
      contratista: string;
      concepto: string;
      total: number;
      pagado: number;
      saldo: number;
      estatus: "pendiente" | "parcial" | "pagada" | "cancelada";
      cxp: CxPRow;
    };

function AnticiposSubcontratoTab() {
  const fetchAnticipos = useServerFn(listAnticiposSubcontratoPendientes);
  const fetchEstimaciones = useServerFn(listCxPSubcontratoPendientes);
  const qc = useQueryClient();
  const [pagar, setPagar] = useState<AnticipoSubRow | null>(null);
  const [pagarCxP, setPagarCxP] = useState<CxPRow | null>(null);

  const antQ = useQuery({
    queryKey: ["anticipos-subcontrato-pendientes"],
    queryFn: () => fetchAnticipos(),
  });
  const estQ = useQuery({
    queryKey: ["cxp-subcontrato-pendientes"],
    queryFn: () => fetchEstimaciones(),
  });

  const anticipos = (antQ.data ?? []) as AnticipoSubRow[];
  const estimaciones = (estQ.data ?? []) as CxPRow[];

  const unified: UnifiedSubRow[] = [
    ...estimaciones.map<UnifiedSubRow>((r) => ({
      key: `est-${r.id}`,
      tipo: "estimacion",
      fecha: r.fecha_emision,
      folio: r.folio,
      obra: r.obra_nombre ?? "—",
      contratista: r.beneficiario_nombre,
      concepto: r.concepto,
      total: r.monto_total,
      pagado: r.monto_pagado,
      saldo: r.saldo,
      estatus: r.estatus,
      cxp: r,
    })),
    ...anticipos.map<UnifiedSubRow>((r) => ({
      key: `ant-${r.anticipoId}`,
      tipo: "anticipo",
      fecha: r.solicitadoAt,
      folio: r.subcontratoNumero != null ? `#${r.subcontratoNumero} · ${r.subcontratoNombre}` : r.subcontratoNombre,
      obra: r.obraNombre,
      contratista: r.contratistaNombre,
      concepto: r.notas ? `Anticipo de subcontrato · ${r.notas}` : "Anticipo de subcontrato",
      total: r.monto,
      pagado: 0,
      saldo: r.monto,
      estatus: "pendiente",
      anticipo: r,
    })),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  const totalSaldo = unified.reduce((s, r) => s + r.saldo, 0);
  const isLoading = antQ.isLoading || estQ.isLoading;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["anticipos-subcontrato-pendientes"] });
    qc.invalidateQueries({ queryKey: ["cxp-subcontrato-pendientes"] });
    qc.invalidateQueries({ queryKey: ["subcontrato-anticipo"] });
    qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Pagos a contratistas pendientes</h3>
          <p className="text-xs text-muted-foreground">
            Anticipos solicitados y estimaciones autorizadas pendientes de pago.
          </p>
        </div>
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Saldo total</p>
          <p className="text-lg font-semibold">{formatMXN(totalSaldo)}</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Folio / Ref</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Contratista</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && unified.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">
                  <HandCoins className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin pagos a contratistas pendientes.
                </TableCell>
              </TableRow>
            )}
            {unified.map((r) => (
              <TableRow key={r.key}>
                <TableCell>
                  <Badge
                    className={
                      r.tipo === "anticipo"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }
                  >
                    {r.tipo === "anticipo" ? "Anticipo" : "Estimación"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-sm">{r.folio}</TableCell>
                <TableCell className="text-xs">{r.obra}</TableCell>
                <TableCell className="text-sm">{r.contratista}</TableCell>
                <TableCell className="text-xs max-w-[260px] truncate" title={r.concepto}>{r.concepto}</TableCell>
                <TableCell className="text-xs">{formatDate(r.fecha)}</TableCell>
                <TableCell className="text-right">{formatMXN(r.total)}</TableCell>
                <TableCell className="text-right">{formatMXN(r.pagado)}</TableCell>
                <TableCell className="text-right font-semibold">{formatMXN(r.saldo)}</TableCell>
                <TableCell>
                  <Badge className={ESTADO_PAGO_BADGE[r.estatus === "pagada" ? "pagado" : r.estatus] ?? ""}>
                    {r.estatus === "parcial" ? "Parcial" : r.estatus === "pagada" ? "Pagado" : "Pendiente"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {r.saldo > 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (r.tipo === "anticipo") setPagar(r.anticipo);
                        else setPagarCxP(r.cxp);
                      }}
                    >
                      Registrar pago
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {pagar && (
        <RegistrarPagoAnticipoSubcontratoDialog
          subcontratoId={pagar.subcontratoId}
          subcontratoNombre={pagar.subcontratoNombre}
          contratistaNombre={pagar.contratistaNombre}
          folio={pagar.folio}
          montoTotalContrato={pagar.subcontratoMontoTotal}
          anticipoPct={pagar.subcontratoAnticipoPct}
          monto={pagar.monto}
          open={!!pagar}
          onOpenChange={(o) => !o && setPagar(null)}
          onSaved={invalidateAll}
        />
      )}

      {pagarCxP && (
        <RegistrarPagoCxPDialog
          cxpId={pagarCxP.id}
          folio={pagarCxP.folio}
          beneficiarioNombre={pagarCxP.beneficiario_nombre}
          saldoPendiente={pagarCxP.saldo}
          open={!!pagarCxP}
          onOpenChange={(o) => !o && setPagarCxP(null)}
          onSaved={invalidateAll}
        />
      )}
    </div>
  );
}
