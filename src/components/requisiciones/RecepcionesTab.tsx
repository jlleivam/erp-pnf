import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileText, PackageCheck, PackageOpen, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { getRequisicionRecepciones } from "@/lib/api/requisiciones.functions";

const mxn = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const OC_ESTATUS_BADGE: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  pendiente_autorizacion: { label: "Pendiente aut.", className: "bg-amber-100 text-amber-800" },
  autorizada: { label: "Autorizada", className: "bg-emerald-100 text-emerald-800" },
  enviada: { label: "Enviada", className: "bg-blue-100 text-blue-800" },
  recibida_parcial: { label: "Recepción parcial", className: "bg-amber-100 text-amber-800" },
  recibida: { label: "Recibida", className: "bg-emerald-100 text-emerald-800" },
  pagada: { label: "Pagada", className: "bg-violet-100 text-violet-800" },
};

const PAGO_BADGE: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Sin pago", className: "bg-slate-100 text-slate-700" },
  parcial: { label: "Pago parcial", className: "bg-amber-100 text-amber-800" },
  pagada: { label: "Pagada", className: "bg-emerald-100 text-emerald-800" },
  pagado: { label: "Pagada", className: "bg-emerald-100 text-emerald-800" },
};

interface Props {
  requisicionId: string;
}

export function RecepcionesTab({ requisicionId }: Props) {
  const fetchFn = useServerFn(getRequisicionRecepciones);
  const q = useQuery({
    queryKey: ["requisicion-recepciones", requisicionId],
    queryFn: () => fetchFn({ data: { requisicionId } }),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const data = (q.data ?? []) as any[];

  if (data.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <PackageOpen className="size-8 mx-auto text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Aún no hay órdenes de compra activas</p>
      </Card>
    );
  }

  // Resumen global
  let totalPedido = 0;
  let totalRecibido = 0;
  let totalMonto = 0;
  let totalPagado = 0;
  let insumosPendientes = 0;
  for (const g of data) {
    for (const it of g.insumos) {
      totalPedido += it.pedido;
      totalRecibido += Math.min(it.recibido, it.pedido);
      if (it.pendiente > 1e-6) insumosPendientes += 1;
    }
    totalMonto += g.oc.total;
    totalPagado += g.oc.monto_pagado;
  }
  const pctRecibido = totalPedido > 0 ? Math.round((totalRecibido / totalPedido) * 100) : 0;
  const pctPagado = totalMonto > 0 ? Math.round((totalPagado / totalMonto) * 100) : 0;
  const saldoPendiente = +(totalMonto - totalPagado).toFixed(2);

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-muted/40 border-dashed">
        <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
          <div className="flex items-center gap-2">
            <PackageCheck className="size-4 text-emerald-700" />
            <span>Material recibido: <strong>{pctRecibido}%</strong></span>
            <span className="text-muted-foreground">·</span>
            <span>Pagado: <strong>{pctPagado}%</strong></span>
          </div>
          <p className="text-muted-foreground">
            {insumosPendientes > 0
              ? `Faltan ${insumosPendientes} insumo${insumosPendientes === 1 ? "" : "s"} por llegar`
              : "Todo el material fue recibido"}
            {saldoPendiente > 0.01 ? ` · ${mxn(saldoPendiente)} por pagar` : " · sin saldo pendiente"}
          </p>
        </div>
      </Card>

      {data.map((g) => {
        const meta = OC_ESTATUS_BADGE[g.oc.estatus];
        const pagoKey = g.oc.estado_pago as string;
        const pagoMeta = PAGO_BADGE[pagoKey] ?? PAGO_BADGE.pendiente;
        const saldo = +(g.oc.total - g.oc.monto_pagado).toFixed(2);
        return (
          <Card key={g.oc.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{g.oc.folio}</p>
                  {meta && <Badge className={meta.className}>{meta.label}</Badge>}
                  <Badge className={pagoMeta.className}>{pagoMeta.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{g.oc.proveedor}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{mxn(g.oc.total)}</p>
                <p className="text-xs text-muted-foreground">
                  Pagado {mxn(g.oc.monto_pagado)} · pend. {mxn(Math.max(0, saldo))}
                </p>
              </div>
            </div>

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead className="text-right">Pedido</TableHead>
                    <TableHead className="text-right">Recibido</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.insumos.map((it: any) => {
                    const cls =
                      it.pendiente <= 1e-6
                        ? "text-emerald-700"
                        : it.recibido > 0
                          ? "text-amber-700"
                          : "text-muted-foreground";
                    return (
                      <TableRow key={it.insumo_id}>
                        <TableCell>{it.nombre}</TableCell>
                        <TableCell className="text-right">{it.pedido} {it.unidad}</TableCell>
                        <TableCell className={`text-right ${cls}`}>{it.recibido} {it.unidad}</TableCell>
                        <TableCell className={`text-right font-medium ${cls}`}>
                          {it.pendiente > 1e-6 ? `${it.pendiente} ${it.unidad}` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Recepciones ({g.recepciones.length})</p>
              {g.recepciones.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin recepciones registradas.</p>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Remisión</TableHead>
                        <TableHead>Recibió</TableHead>
                        <TableHead className="text-right">Evidencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.recepciones.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>{formatDate(r.fecha)}</TableCell>
                          <TableCell>
                            {r.sin_remision ? (
                              <span className="text-amber-700">
                                Sin remisión{r.motivo_sin_remision ? ` · ${r.motivo_sin_remision}` : ""}
                              </span>
                            ) : (
                              r.folio_remision || "—"
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.recibido_por_nombre}</TableCell>
                          <TableCell className="text-right">
                            {r.evidencia_url ? (
                              <a
                                href={r.evidencia_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                              >
                                <ImageIcon className="size-3.5" /> Ver
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button asChild size="sm" variant="outline">
                <Link to="/app/obras/$obraId/almacen-obra" params={{ obraId: g.oc.obra_id }}>
                  <ExternalLink className="size-4 mr-1" /> Ir al almacén
                </Link>
              </Button>
            </div>
          </Card>
        );
      })}

      {data.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <FileText className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Sin datos</p>
        </Card>
      )}
    </div>
  );
}
