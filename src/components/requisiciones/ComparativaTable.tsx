import { Fragment, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, PackageCheck, Plus, X } from "lucide-react";
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

  // Estado: insumoId → Asignacion[]
  const [asignaciones, setAsignaciones] = useState<Record<string, Asignacion[]>>({});

  if (recibidas.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-sm text-muted-foreground">
          Aún no hay cotizaciones recibidas. Captura las respuestas de tus proveedores para comparar precios aquí.
        </p>
      </Card>
    );
  }

  const setLista = (insumoId: string, lista: Asignacion[]) => {
    setAsignaciones((s) => {
      const c = { ...s };
      if (lista.length === 0) delete c[insumoId];
      else c[insumoId] = lista;
      return c;
    });
  };
  const addAsignacion = (insumoId: string, a: Asignacion) => {
    const prev = asignaciones[insumoId] ?? [];
    setLista(insumoId, [...prev, a]);
  };
  const updateAsignacion = (insumoId: string, idx: number, patch: Partial<Asignacion>) => {
    const prev = asignaciones[insumoId] ?? [];
    const next = prev.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    setLista(insumoId, next);
  };
  const removeAsignacion = (insumoId: string, idx: number) => {
    const prev = asignaciones[insumoId] ?? [];
    setLista(insumoId, prev.filter((_, i) => i !== idx));
  };

  // Mejor precio en cascada: cubre cantReq usando ofertas más baratas primero.
  const tomarMejorPrecio = (ri: any) => {
    const ofertas = matrix.get(ri.insumo.id);
    if (!ofertas) return;
    const cantReq = Number(ri.cantidad);
    const candidatos = Array.from(ofertas.entries())
      .filter(([, o]) => o.disponible && o.precio > 0 && o.cantidad > 0)
      .sort((a, b) => a[1].precio - b[1].precio);
    if (candidatos.length === 0) return;
    const lista: Asignacion[] = [];
    let faltante = cantReq;
    for (const [scId, o] of candidatos) {
      if (faltante <= 0) break;
      const toma = Math.min(faltante, o.cantidad);
      if (toma <= 0) continue;
      lista.push({ proveedorId: scId, cantidad: toma });
      faltante -= toma;
    }
    if (lista.length > 0) setLista(ri.insumo.id, lista);
  };

  const tomarMejorPrecioTodos = () => {
    reqItems.forEach((ri) => tomarMejorPrecio(ri));
  };

  // Resumen por proveedor (solicitudId)
  const resumenPorSc = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    for (const [insumoId, lista] of Object.entries(asignaciones)) {
      for (const a of lista) {
        const o = matrix.get(insumoId)?.get(a.proveedorId);
        if (!o || a.cantidad <= 0) continue;
        const prev = m.get(a.proveedorId) ?? { count: 0, total: 0 };
        m.set(a.proveedorId, {
          count: prev.count + 1,
          total: prev.total + a.cantidad * o.precio,
        });
      }
    }
    return m;
  }, [asignaciones, matrix]);

  const insumosAsignados = Object.keys(asignaciones).length;
  const insumosCubiertos = reqItems.filter((ri) => {
    const lista = asignaciones[ri.insumo.id];
    if (!lista) return false;
    const suma = lista.reduce((s, a) => s + (a.cantidad || 0), 0);
    return Math.abs(suma - Number(ri.cantidad)) < 0.0001;
  }).length;

  const generarMut = useMutation({
    mutationFn: async () => {
      // Agrupar por proveedorId real (no solicitudId)
      const porProveedor = new Map<string, Map<string, { cantidad: number; precio_unitario: number }>>();
      for (const [insumoId, lista] of Object.entries(asignaciones)) {
        for (const a of lista) {
          const provId = provBySolicitud.get(a.proveedorId);
          const oferta = matrix.get(insumoId)?.get(a.proveedorId);
          if (!provId || !oferta || a.cantidad <= 0) continue;
          if (!porProveedor.has(provId)) porProveedor.set(provId, new Map());
          const bucket = porProveedor.get(provId)!;
          // si el mismo insumo se asigna 2 veces al mismo proveedor real, sumar
          const prev = bucket.get(insumoId);
          if (prev) {
            bucket.set(insumoId, {
              cantidad: prev.cantidad + a.cantidad,
              precio_unitario: oferta.precio,
            });
          } else {
            bucket.set(insumoId, { cantidad: a.cantidad, precio_unitario: oferta.precio });
          }
        }
      }
      if (porProveedor.size === 0) throw new Error("No hay asignaciones válidas");
      let creados = 0;
      const errores: string[] = [];
      for (const [proveedorId, bucket] of porProveedor.entries()) {
        const insumos = Array.from(bucket.entries()).map(([insumo_id, v]) => ({
          insumo_id, cantidad: v.cantidad, precio_unitario: v.precio_unitario,
        }));
        try {
          await guardarFn({ data: { requisicionId, proveedorId, insumos } });
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
          <strong className="text-foreground">{insumosAsignados}</strong> de <strong className="text-foreground">{reqItems.length}</strong> insumos asignados
          {" · "}
          <strong className="text-foreground">{insumosCubiertos}</strong> totalmente cubiertos
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
                <TableHead rowSpan={2} className="text-center align-bottom border-l min-w-[280px]">
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
                const lista = asignaciones[ri.insumo.id] ?? [];
                const asignadosSc = new Set(lista.map((a) => a.proveedorId));
                const opcionesDisponibles = recibidas.filter((sc) => {
                  const o = ofertas?.get(sc.id);
                  return o && o.disponible && o.precio > 0;
                });
                const sumaAsignada = lista.reduce((s, a) => s + (a.cantidad || 0), 0);
                const restante = cantReq - sumaAsignada;
                const puedeAgregar =
                  opcionesDisponibles.some((sc) => !asignadosSc.has(sc.id)) && restante > 0.0001;

                let estadoColor = "text-muted-foreground";
                if (lista.length > 0) {
                  if (Math.abs(sumaAsignada - cantReq) < 0.0001) estadoColor = "text-emerald-700";
                  else if (sumaAsignada > cantReq) estadoColor = "text-red-700";
                  else estadoColor = "text-amber-700";
                }

                const handleAdd = () => {
                  // Elegir por defecto el más barato no usado, o el primero disponible
                  const candidatos = opcionesDisponibles
                    .filter((sc) => !asignadosSc.has(sc.id))
                    .sort((a, b) => (ofertas!.get(a.id)!.precio - ofertas!.get(b.id)!.precio));
                  if (candidatos.length === 0) return;
                  const sc = candidatos[0];
                  const o = ofertas!.get(sc.id)!;
                  const cant = Math.max(0, Math.min(restante, o.cantidad));
                  addAsignacion(ri.insumo.id, { proveedorId: sc.id, cantidad: cant });
                };

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
                      const isAsignado = asignadosSc.has(sc.id);
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
                      {opcionesDisponibles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin ofertas</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {lista.map((a, idx) => {
                            const ofertaA = ofertas?.get(a.proveedorId);
                            const excede = ofertaA ? a.cantidad > ofertaA.cantidad : false;
                            // opciones para este select: las disponibles que no estén en otras filas
                            const opcionesSelect = opcionesDisponibles.filter(
                              (sc) => sc.id === a.proveedorId || !asignadosSc.has(sc.id),
                            );
                            return (
                              <div key={idx} className="flex flex-col gap-1 border rounded p-1.5">
                                <div className="flex items-center gap-1">
                                  <Select
                                    value={a.proveedorId}
                                    onValueChange={(v) => {
                                      const o = ofertas?.get(v);
                                      if (!o) return;
                                      const nuevaCant = Math.min(a.cantidad || 0, o.cantidad) || Math.min(restante + a.cantidad, o.cantidad);
                                      updateAsignacion(ri.insumo.id, idx, { proveedorId: v, cantidad: nuevaCant });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs flex-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {opcionesSelect.map((sc) => {
                                        const o = ofertas!.get(sc.id)!;
                                        return (
                                          <SelectItem key={sc.id} value={sc.id}>
                                            {sc.proveedor?.razon_social ?? "—"} · {mxn(o.precio)} · {o.cantidad} {unidad}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => removeAsignacion(ri.insumo.id, idx)}
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={`h-8 text-xs ${excede ? "border-amber-400" : ""}`}
                                    value={a.cantidad || ""}
                                    onChange={(e) =>
                                      updateAsignacion(ri.insumo.id, idx, {
                                        cantidad: Number(e.target.value) || 0,
                                      })
                                    }
                                  />
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {unidad}
                                    {ofertaA ? ` / ${ofertaA.cantidad} disp.` : ""}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {puedeAgregar && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={handleAdd}
                            >
                              <Plus className="size-3 mr-1" />
                              Agregar proveedor
                            </Button>
                          )}

                          {lista.length === 0 && minPrecio !== null && (
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

                          {lista.length > 0 && (
                            <p className={`text-xs font-medium tabular-nums ${estadoColor}`}>
                              {sumaAsignada} / {cantReq} {unidad}
                              {sumaAsignada < cantReq && ` (faltan ${(cantReq - sumaAsignada).toFixed(2)})`}
                              {sumaAsignada > cantReq && ` (sobran ${(sumaAsignada - cantReq).toFixed(2)})`}
                            </p>
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
                      {info.count} línea{info.count === 1 ? "" : "s"}
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
          disabled={insumosAsignados === 0 || generarMut.isPending}
        >
          <PackageCheck className="size-4 mr-1" />
          Generar paquetes con esta asignación
        </Button>
      </div>
    </div>
  );
}
