import { Fragment, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, PackageCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { guardarPaquete } from "@/lib/api/cotizaciones.functions";

interface Props {
  reqItems: any[];
  solicitudes: any[];
  requisicionId: string;
  onAsignacionGenerada?: () => void;
}

const SIN_ASIGNAR = "__none__";

const mxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Asignacion = { proveedorId: string; cantidad: number };

export function ComparativaTable({
  reqItems, solicitudes, requisicionId, onAsignacionGenerada,
}: Props) {
  const qc = useQueryClient();
  const guardarFn = useServerFn(guardarPaquete);
  const recibidas = solicitudes.filter((s) => s.estatus === "recibida");

  // Map<insumoId, Map<solicitudId, {precio, disponible, cantidad}>>
  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, { precio: number; disponible: boolean; cantidad: number }>>();
    for (const sc of recibidas) {
      for (const it of sc.items ?? []) {
        if (!m.has(it.insumo_id)) m.set(it.insumo_id, new Map());
        m.get(it.insumo_id)!.set(sc.id, {
          precio: Number(it.precio_unitario ?? 0),
          disponible: it.disponible !== false,
          cantidad: Number(it.cantidad ?? 0),
        });
      }
    }
    return m;
  }, [recibidas]);

  // solicitudId → proveedorId
  const provBySolicitud = useMemo(() => {
    const m = new Map<string, string>();
    for (const sc of recibidas) if (sc.proveedor?.id) m.set(sc.id, sc.proveedor.id);
    return m;
  }, [recibidas]);

  const totales = useMemo(() => {
    const t = new Map<string, number>();
    for (const sc of recibidas) {
      let suma = 0;
      for (const it of sc.items ?? []) {
        if (it.disponible !== false) {
          suma += Number(it.cantidad) * Number(it.precio_unitario ?? 0);
        }
      }
      t.set(sc.id, suma);
    }
    return t;
  }, [recibidas]);

  // Estado: insumoId → { proveedorId(=solicitudId), cantidad }
  const [asignaciones, setAsignaciones] = useState<Record<string, Asignacion>>({});

  if (recibidas.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-sm text-muted-foreground">
          Aún no hay cotizaciones recibidas. Captura las respuestas de tus proveedores para comparar precios aquí.
        </p>
      </Card>
    );
  }

  const setAsignacion = (insumoId: string, solicitudId: string, cantidad: number) => {
    setAsignaciones((s) => ({ ...s, [insumoId]: { proveedorId: solicitudId, cantidad } }));
  };
  const clearAsignacion = (insumoId: string) => {
    setAsignaciones((s) => {
      const c = { ...s };
      delete c[insumoId];
      return c;
    });
  };

  const tomarMejorPrecio = (ri: any) => {
    const ofertas = matrix.get(ri.insumo.id);
    if (!ofertas) return;
    let bestSc: string | null = null;
    let bestPrecio = Infinity;
    for (const [scId, o] of ofertas.entries()) {
      if (!o.disponible || o.precio <= 0) continue;
      if (o.precio < bestPrecio) { bestPrecio = o.precio; bestSc = scId; }
    }
    if (!bestSc) return;
    const o = ofertas.get(bestSc)!;
    const cant = Math.min(Number(ri.cantidad), o.cantidad);
    setAsignacion(ri.insumo.id, bestSc, cant);
  };

  const tomarMejorPrecioTodos = () => {
    reqItems.forEach((ri) => tomarMejorPrecio(ri));
  };

  // Resumen por proveedor (solicitudId)
  const resumenPorSc = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    for (const [insumoId, a] of Object.entries(asignaciones)) {
      const o = matrix.get(insumoId)?.get(a.proveedorId);
      if (!o) continue;
      const prev = m.get(a.proveedorId) ?? { count: 0, total: 0 };
      m.set(a.proveedorId, {
        count: prev.count + 1,
        total: prev.total + a.cantidad * o.precio,
      });
    }
    return m;
  }, [asignaciones, matrix]);

  const asignadosCount = Object.keys(asignaciones).length;

  const generarMut = useMutation({
    mutationFn: async () => {
      // Agrupar por proveedorId real (no solicitudId)
      const porProveedor = new Map<string, { insumo_id: string; cantidad: number; precio_unitario: number }[]>();
      for (const [insumoId, a] of Object.entries(asignaciones)) {
        const provId = provBySolicitud.get(a.proveedorId);
        const oferta = matrix.get(insumoId)?.get(a.proveedorId);
        if (!provId || !oferta || a.cantidad <= 0) continue;
        const arr = porProveedor.get(provId) ?? [];
        arr.push({ insumo_id: insumoId, cantidad: a.cantidad, precio_unitario: oferta.precio });
        porProveedor.set(provId, arr);
      }
      if (porProveedor.size === 0) throw new Error("No hay asignaciones válidas");
      let creados = 0;
      const errores: string[] = [];
      for (const [proveedorId, insumos] of porProveedor.entries()) {
        try {
          await guardarFn({
            data: { requisicionId, proveedorId, insumos },
          });
          creados++;
        } catch (e: any) {
          errores.push(e?.message ?? "Error");
        }
      }
      return { creados, errores };
    },
    onSuccess: ({ creados, errores }) => {
      qc.invalidateQueries({ queryKey: ["cotizacion", requisicionId] });
      qc.invalidateQueries({ queryKey: ["requisiciones"] });
      if (creados > 0) toast.success(`${creados} paquete${creados === 1 ? "" : "s"} generado${creados === 1 ? "" : "s"}`);
      if (errores.length > 0) toast.error(errores[0]);
      if (creados > 0) onAsignacionGenerada?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al generar paquetes"),
  });

  const sinCotizar = reqItems.filter((ri) => !matrix.has(ri.insumo.id)).length;

  return (
    <div className="space-y-3">
      {sinCotizar > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          {sinCotizar} insumo{sinCotizar === 1 ? "" : "s"} de la requisición sin cotización todavía.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{asignadosCount}</strong> de <strong className="text-foreground">{reqItems.length}</strong> insumos asignados
        </p>
        <Button size="sm" variant="outline" onClick={tomarMejorPrecioTodos}>
          <Sparkles className="size-4 mr-1" />
          Asignar mejor precio en todos
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="min-w-[180px] align-bottom">Insumo</TableHead>
                <TableHead rowSpan={2} className="text-right align-bottom">Cant. requerida</TableHead>
                {recibidas.map((sc) => (
                  <TableHead
                    key={sc.id}
                    colSpan={3}
                    className="text-center border-l min-w-[280px]"
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-semibold">{sc.proveedor?.razon_social ?? "—"}</span>
                      <span className="text-xs text-muted-foreground font-normal">{sc.folio}</span>
                    </div>
                  </TableHead>
                ))}
                <TableHead rowSpan={2} className="text-center align-bottom border-l min-w-[240px]">
                  Asignar a
                </TableHead>
              </TableRow>
              <TableRow>
                {recibidas.map((sc) => (
                  <Fragment key={sc.id}>
                    <TableHead className="text-right text-xs border-l">Cant.</TableHead>
                    <TableHead className="text-right text-xs">P.U.</TableHead>
                    <TableHead className="text-right text-xs">Importe</TableHead>
                  </Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reqItems.map((ri) => {
                const ofertas = matrix.get(ri.insumo.id);
                const preciosValidos = ofertas
                  ? Array.from(ofertas.values()).filter((o) => o.disponible && o.precio > 0).map((o) => o.precio)
                  : [];
                const minPrecio = preciosValidos.length > 0 ? Math.min(...preciosValidos) : null;
                const cantReq = Number(ri.cantidad);
                const unidad = ri.insumo.unidad ?? "";
                const asignacion = asignaciones[ri.insumo.id];
                const opcionesAsignacion = recibidas.filter((sc) => {
                  const o = ofertas?.get(sc.id);
                  return o && o.disponible && o.precio > 0;
                });
                const ofertaAsignada = asignacion ? ofertas?.get(asignacion.proveedorId) : null;
                const warnCantidad =
                  asignacion && ofertaAsignada
                    ? asignacion.cantidad > cantReq || asignacion.cantidad > ofertaAsignada.cantidad
                    : false;

                return (
                  <TableRow key={ri.id}>
                    <TableCell className="font-medium text-sm">{ri.insumo.nombre}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {cantReq} {unidad}
                    </TableCell>
                    {recibidas.map((sc) => {
                      const oferta = ofertas?.get(sc.id);
                      if (!oferta || !oferta.disponible) {
                        return (
                          <Fragment key={sc.id}>
                            <TableCell className="text-right text-muted-foreground border-l">—</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                          </Fragment>
                        );
                      }
                      const isMin = minPrecio !== null && oferta.precio === minPrecio;
                      const isAsignado = asignacion?.proveedorId === sc.id;
                      const cantOf = oferta.cantidad;
                      let cantClass = "";
                      if (cantOf < cantReq) cantClass = "text-amber-700 font-medium";
                      else if (cantOf > cantReq) cantClass = "text-sky-700";
                      const importe = cantOf * oferta.precio;
                      const ring = isAsignado ? "ring-2 ring-inset ring-primary/40" : "";
                      return (
                        <Fragment key={sc.id}>
                          <TableCell className={`text-right text-sm tabular-nums border-l whitespace-nowrap ${cantClass} ${ring}`}>
                            {cantOf} {unidad}
                          </TableCell>
                          <TableCell
                            className={`text-right text-sm tabular-nums ${
                              isMin ? "bg-emerald-50 text-emerald-800 font-semibold" : ""
                            } ${ring}`}
                          >
                            {mxn(oferta.precio)}
                          </TableCell>
                          <TableCell className={`text-right text-sm tabular-nums ${ring}`}>
                            {mxn(importe)}
                          </TableCell>
                        </Fragment>
                      );
                    })}
                    <TableCell className="border-l align-top">
                      {opcionesAsignacion.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin ofertas</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <Select
                            value={asignacion?.proveedorId ?? SIN_ASIGNAR}
                            onValueChange={(v) => {
                              if (v === SIN_ASIGNAR) {
                                clearAsignacion(ri.insumo.id);
                                return;
                              }
                              const o = ofertas?.get(v);
                              if (!o) return;
                              const def = Math.min(cantReq, o.cantidad);
                              setAsignacion(ri.insumo.id, v, def);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="— Sin asignar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SIN_ASIGNAR}>— Sin asignar</SelectItem>
                              {opcionesAsignacion.map((sc) => {
                                const o = ofertas!.get(sc.id)!;
                                return (
                                  <SelectItem key={sc.id} value={sc.id}>
                                    {sc.proveedor?.razon_social ?? "—"} · {mxn(o.precio)}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {asignacion && (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className={`h-8 text-xs ${warnCantidad ? "border-amber-400" : ""}`}
                                value={asignacion.cantidad || ""}
                                onChange={(e) =>
                                  setAsignacion(
                                    ri.insumo.id,
                                    asignacion.proveedorId,
                                    Number(e.target.value) || 0,
                                  )
                                }
                              />
                              <span className="text-xs text-muted-foreground">{unidad}</span>
                            </div>
                          )}
                          {!asignacion && minPrecio !== null && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs justify-start px-2"
                              onClick={() => tomarMejorPrecio(ri)}
                            >
                              <Sparkles className="size-3 mr-1" />
                              Tomar mejor precio
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot className="border-t bg-muted/30">
              <TableRow>
                <TableCell className="font-semibold text-sm" colSpan={2}>
                  Total ofertado
                </TableCell>
                {recibidas.map((sc) => (
                  <TableCell
                    key={sc.id}
                    colSpan={3}
                    className="text-right font-semibold tabular-nums border-l"
                  >
                    {mxn(totales.get(sc.id) ?? 0)}
                  </TableCell>
                ))}
                <TableCell className="border-l" />
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </Card>

      {resumenPorSc.size > 0 && (
        <Card className="p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Asignación por proveedor
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from(resumenPorSc.entries()).map(([scId, info]) => {
              const sc = recibidas.find((s) => s.id === scId);
              return (
                <div key={scId} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                  <div>
                    <p className="font-medium">{sc?.proveedor?.razon_social ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {info.count} insumo{info.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{mxn(info.total)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => generarMut.mutate()}
          disabled={asignadosCount === 0 || generarMut.isPending}
        >
          <PackageCheck className="size-4 mr-1" />
          Generar paquetes con esta asignación
        </Button>
      </div>
    </div>
  );
}
