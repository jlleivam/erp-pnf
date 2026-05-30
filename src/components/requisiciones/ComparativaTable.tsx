import { Fragment, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Plus, X, Send, CheckCircle2, XCircle, RotateCcw, Lock, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  guardarPaquete, generarOC, enviarOCASupervisor,
  autorizarOC, rechazarOC, reabrirOC, eliminarPaquete,
} from "@/lib/api/cotizaciones.functions";
import type { AppRole } from "@/stores/auth";

interface Props {
  reqItems: any[];
  solicitudes: any[];
  paquetes: any[];
  ocs: any[];
  requisicionId: string;
  roles: AppRole[];
}

const mxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

type Asignacion = { proveedorId: string; cantidad: number };

const OC_BADGE: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  pendiente_autorizacion: { label: "Pendiente autorización", className: "bg-amber-100 text-amber-800" },
  autorizada: { label: "Autorizada", className: "bg-emerald-100 text-emerald-800" },
  rechazada: { label: "Rechazada", className: "bg-rose-100 text-rose-800" },
  pagada: { label: "Pagada", className: "bg-blue-100 text-blue-800" },
};

export function ComparativaTable({
  reqItems, solicitudes, paquetes, ocs, requisicionId, roles,
}: Props) {
  const qc = useQueryClient();
  const guardarFn = useServerFn(guardarPaquete);
  const generarFn = useServerFn(generarOC);
  const enviarFn = useServerFn(enviarOCASupervisor);
  const autorizarFn = useServerFn(autorizarOC);
  const rechazarFn = useServerFn(rechazarOC);
  const reabrirFn = useServerFn(reabrirOC);
  const eliminarFn = useServerFn(eliminarPaquete);

  const isAdmin = roles.includes("director") || roles.includes("administrativo");
  const isSupervisor = roles.includes("director") || roles.includes("supervisor");

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

  // solicitudId -> proveedorId
  const provBySolicitud = useMemo(() => {
    const m = new Map<string, string>();
    for (const sc of recibidas) if (sc.proveedor?.id) m.set(sc.id, sc.proveedor.id);
    return m;
  }, [recibidas]);

  // proveedorId -> solicitudId (first match)
  const solicitudByProveedor = useMemo(() => {
    const m = new Map<string, string>();
    for (const sc of recibidas) {
      if (sc.proveedor?.id && !m.has(sc.proveedor.id)) m.set(sc.proveedor.id, sc.id);
    }
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

  // OC por proveedor
  const ocByProveedor = useMemo(() => {
    const m = new Map<string, any>();
    for (const oc of ocs) {
      const paq = paquetes.find((p) => p.id === oc.paquete_id);
      const provId = paq?.proveedor_id ?? oc.proveedor?.id;
      if (provId) m.set(provId, oc);
    }
    return m;
  }, [ocs, paquetes]);

  // Paquete por proveedor
  const paqueteByProveedor = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of paquetes) if (p.proveedor_id) m.set(p.proveedor_id, p);
    return m;
  }, [paquetes]);

  // ¿La OC de este proveedor bloquea ediciones? (no es borrador ni rechazada, o está en envío optimista)
  const provBloqueado = (proveedorId: string) => {
    const oc = ocByProveedor.get(proveedorId);
    if (oc && oc.estatus !== "borrador" && oc.estatus !== "rechazada") return true;
    return optimisticPendiente.has(proveedorId);
  };

  // Estado de asignaciones: insumoId -> Asignacion[] (proveedorId = solicitudId del proveedor)
  const [asignaciones, setAsignaciones] = useState<Record<string, Asignacion[]>>({});
  const [hydrated, setHydrated] = useState(false);
  const [enviandoProv, setEnviandoProv] = useState<string | null>(null);
  const [optimisticPendiente, setOptimisticPendiente] = useState<Set<string>>(new Set());

  // Hidratar desde paquetes existentes
  useEffect(() => {
    if (hydrated || paquetes.length === 0) return;
    const next: Record<string, Asignacion[]> = {};
    for (const p of paquetes) {
      const provId = p.proveedor_id;
      if (!provId) continue;
      const scId = solicitudByProveedor.get(provId);
      if (!scId) continue; // proveedor sin cotización recibida → no representable en matriz
      for (const it of p.items ?? []) {
        if (!next[it.insumo_id]) next[it.insumo_id] = [];
        next[it.insumo_id].push({ proveedorId: scId, cantidad: Number(it.cantidad) });
      }
    }
    setAsignaciones(next);
    setHydrated(true);
  }, [paquetes, solicitudByProveedor, hydrated]);

  // Re-hidratar cuando cambian los paquetes (después de mutaciones)
  useEffect(() => {
    setHydrated(false);
  }, [paquetes.length, ocs.length]);

  // Limpiar marca optimista cuando el backend ya refleja un estatus posterior a borrador
  useEffect(() => {
    setOptimisticPendiente((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const oc of ocs) {
        const paq = paquetes.find((p) => p.id === oc.paquete_id);
        const provId = paq?.proveedor_id ?? oc.proveedor?.id;
        if (provId && oc.estatus && oc.estatus !== "borrador") next.delete(provId);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [ocs, paquetes]);

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
    reqItems.forEach((ri) => {
      const provIds = (asignaciones[ri.insumo.id] ?? [])
        .map((a) => provBySolicitud.get(a.proveedorId))
        .filter(Boolean) as string[];
      // No tocar insumos que ya están en OC bloqueada
      if (provIds.some((pid) => provBloqueado(pid))) return;
      tomarMejorPrecio(ri);
    });
  };

  // Agrupar asignaciones por proveedor real
  const resumenPorProveedor = useMemo(() => {
    type Linea = { insumoId: string; nombre: string; unidad: string; cantidad: number; precio: number };
    const m = new Map<string, { proveedor: any; lineas: Linea[]; total: number }>();
    for (const [insumoId, lista] of Object.entries(asignaciones)) {
      const ri = reqItems.find((r) => r.insumo.id === insumoId);
      if (!ri) continue;
      for (const a of lista) {
        const provId = provBySolicitud.get(a.proveedorId);
        const oferta = matrix.get(insumoId)?.get(a.proveedorId);
        if (!provId || !oferta || a.cantidad <= 0) continue;
        const sc = recibidas.find((s) => s.id === a.proveedorId);
        if (!m.has(provId)) {
          m.set(provId, { proveedor: sc?.proveedor ?? { id: provId, razon_social: "—" }, lineas: [], total: 0 });
        }
        const entry = m.get(provId)!;
        const existente = entry.lineas.find((l) => l.insumoId === insumoId);
        if (existente) {
          existente.cantidad += a.cantidad;
        } else {
          entry.lineas.push({
            insumoId,
            nombre: ri.insumo.nombre,
            unidad: ri.insumo.unidad ?? "",
            cantidad: a.cantidad,
            precio: oferta.precio,
          });
        }
        entry.total += a.cantidad * oferta.precio;
      }
    }
    // Incluir paquetes ya guardados cuyo proveedor no tiene cotización recibida (read-only)
    for (const p of paquetes) {
      const provId = p.proveedor_id;
      if (!provId || m.has(provId)) continue;
      const lineas = (p.items ?? []).map((it: any) => {
        const ri = reqItems.find((r) => r.insumo.id === it.insumo_id);
        return {
          insumoId: it.insumo_id,
          nombre: ri?.insumo.nombre ?? "—",
          unidad: ri?.insumo.unidad ?? "",
          cantidad: Number(it.cantidad),
          precio: Number(it.precio_unitario ?? 0),
        };
      });
      const total = lineas.reduce((s: number, l: any) => s + l.cantidad * l.precio, 0);
      m.set(provId, {
        proveedor: p.proveedor ?? { id: provId, razon_social: "—" },
        lineas,
        total,
      });
    }
    return m;
  }, [asignaciones, matrix, provBySolicitud, recibidas, reqItems, paquetes]);

  const insumosAsignados = Object.keys(asignaciones).length;
  const insumosCubiertos = reqItems.filter((ri) => {
    const lista = asignaciones[ri.insumo.id];
    if (!lista) return false;
    const suma = lista.reduce((s, a) => s + (a.cantidad || 0), 0);
    return Math.abs(suma - Number(ri.cantidad)) < 0.0001;
  }).length;

  // ===== Mutaciones =====
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["cotizacion", requisicionId] });
    qc.invalidateQueries({ queryKey: ["requisiciones"] });
  };


  const enviarMut = useMutation({
    mutationFn: async (proveedorId: string) => {
      const entry = resumenPorProveedor.get(proveedorId);
      if (!entry || entry.lineas.length === 0) throw new Error("Sin líneas para este proveedor");
      const paqueteExistente = paqueteByProveedor.get(proveedorId);
      const insumos = entry.lineas.map((l) => ({
        insumo_id: l.insumoId,
        cantidad: l.cantidad,
        precio_unitario: l.precio,
      }));
      const r = await guardarFn({
        data: {
          requisicionId,
          paqueteId: paqueteExistente?.id ?? undefined,
          proveedorId,
          insumos,
        },
      });
      const paqueteId = (r as any).id;
      const ocRes = await generarFn({ data: { paqueteId } });
      await enviarFn({ data: { ocId: (ocRes as any).id } });
      return proveedorId;
    },
    onMutate: (proveedorId) => {
      setOptimisticPendiente((s) => {
        const n = new Set(s);
        n.add(proveedorId);
        return n;
      });
    },
    onSuccess: () => {
      toast.success("OC enviada al supervisor");
      setEnviandoProv(null);
      invalidate();
    },
    onError: (e: any, proveedorId) => {
      toast.error(e?.message ?? "Error");
      setEnviandoProv(null);
      setOptimisticPendiente((s) => {
        if (!s.has(proveedorId)) return s;
        const n = new Set(s);
        n.delete(proveedorId);
        return n;
      });
    },
  });


  const autorizarMut = useMutation({
    mutationFn: (ocId: string) => autorizarFn({ data: { ocId } }),
    onSuccess: () => { toast.success("OC autorizada"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const reabrirMut = useMutation({
    mutationFn: (ocId: string) => reabrirFn({ data: { ocId } }),
    onSuccess: () => { toast.success("OC reabierta"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const eliminarMut = useMutation({
    mutationFn: (paqueteId: string) => eliminarFn({ data: { paqueteId } }),
    onSuccess: () => { toast.success("Asignación eliminada"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const [rechazoDialog, setRechazoDialog] = useState<{ ocId: string; folio: string } | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const rechazarMut = useMutation({
    mutationFn: ({ ocId, motivo }: { ocId: string; motivo: string }) => rechazarFn({ data: { ocId, motivo } }),
    onSuccess: () => {
      toast.success("OC rechazada");
      setRechazoDialog(null);
      setMotivoRechazo("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
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
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={tomarMejorPrecioTodos}>
            <Sparkles className="size-4 mr-1" />
            Asignar mejor precio en todos
          </Button>
        )}
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
                <TableHead rowSpan={2} className="text-center align-bottom border-l w-[240px] min-w-[220px]">
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
                // ¿Esta fila tiene alguna asignación bloqueada por OC?
                const filaBloqueada = lista.some((a) => {
                  const pid = provBySolicitud.get(a.proveedorId);
                  return pid ? provBloqueado(pid) : false;
                });
                const puedeAgregar =
                  !filaBloqueada && isAdmin &&
                  opcionesDisponibles.some((sc) => !asignadosSc.has(sc.id)) && restante > 0.0001;

                let estadoColor = "text-muted-foreground";
                if (lista.length > 0) {
                  if (Math.abs(sumaAsignada - cantReq) < 0.0001) estadoColor = "text-emerald-700";
                  else if (sumaAsignada > cantReq) estadoColor = "text-red-700";
                  else estadoColor = "text-amber-700";
                }

                const handleAdd = () => {
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
                    <TableCell className="border-l align-top w-[240px] min-w-[220px]">
                      {opcionesDisponibles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin ofertas</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {lista.map((a, idx) => {
                            const ofertaA = ofertas?.get(a.proveedorId);
                            const excede = ofertaA ? a.cantidad > ofertaA.cantidad : false;
                            const provActual = opcionesDisponibles.find((sc) => sc.id === a.proveedorId);
                            const provReal = provBySolicitud.get(a.proveedorId);
                            const bloqueado = provReal ? provBloqueado(provReal) : false;
                            const opcionesSelect = opcionesDisponibles.filter(
                              (sc) => sc.id === a.proveedorId || !asignadosSc.has(sc.id),
                            );
                            return (
                              <div key={idx} className={`flex flex-col gap-1 border rounded p-1 ${bloqueado ? "opacity-60 bg-muted/40" : ""}`}>
                                <div className="flex items-center gap-1">
                                  <Select
                                    value={a.proveedorId}
                                    disabled={bloqueado || !isAdmin}
                                    onValueChange={(v) => {
                                      const o = ofertas?.get(v);
                                      if (!o) return;
                                      const nuevaCant = Math.min(a.cantidad || 0, o.cantidad) || Math.min(restante + a.cantidad, o.cantidad);
                                      updateAsignacion(ri.insumo.id, idx, { proveedorId: v, cantidad: nuevaCant });
                                    }}
                                  >
                                    <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                                      <span className="truncate flex items-center gap-1">
                                        {bloqueado && <Lock className="size-3" />}
                                        {provActual?.proveedor?.razon_social ?? "—"}
                                      </span>
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
                                  {!bloqueado && isAdmin && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 shrink-0"
                                      onClick={() => removeAsignacion(ri.insumo.id, idx)}
                                    >
                                      <X className="size-3" />
                                    </Button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={bloqueado || !isAdmin}
                                    className={`h-7 text-xs w-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${excede ? "border-amber-400" : ""}`}
                                    value={a.cantidad || ""}
                                    onChange={(e) =>
                                      updateAsignacion(ri.insumo.id, idx, {
                                        cantidad: Number(e.target.value) || 0,
                                      })
                                    }
                                  />
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap truncate">
                                    {unidad}
                                    {ofertaA ? ` / ${ofertaA.cantidad}` : ""}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {puedeAgregar && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              onClick={handleAdd}
                            >
                              <Plus className="size-3 mr-1" />
                              Proveedor
                            </Button>
                          )}

                          {lista.length === 0 && minPrecio !== null && isAdmin && (
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

      {/* Tarjetas por proveedor */}
      {resumenPorProveedor.size > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pedido por proveedor
          </p>
          {Array.from(resumenPorProveedor.entries()).map(([provId, info]) => {
            const oc = ocByProveedor.get(provId);
            const paquete = paqueteByProveedor.get(provId);
            const isOptimisticPendiente = optimisticPendiente.has(provId);
            const estatus = (isOptimisticPendiente ? "pendiente_autorizacion" : oc?.estatus) as string | undefined;
            const badge = estatus ? OC_BADGE[estatus] : null;
            const bloqueado = provBloqueado(provId) || isOptimisticPendiente;
            const enviandoEsta = enviandoProv === provId;
            const puedeEnviar = isAdmin && !bloqueado && !enviandoEsta && info.lineas.length > 0 && info.lineas.every((l) => l.precio > 0);
            // Detectar si el pedido en pantalla difiere del paquete guardado
            const dirty = (() => {
              if (!paquete) return true;
              const items = paquete.items ?? [];
              if (items.length !== info.lineas.length) return true;
              for (const l of info.lineas) {
                const m = items.find((it: any) => it.insumo_id === l.insumoId);
                if (!m) return true;
                if (Math.abs(Number(m.cantidad) - l.cantidad) > 0.0001) return true;
                if (Math.abs(Number(m.precio_unitario) - l.precio) > 0.0001) return true;
              }
              return false;
            })();

            return (
              <Card key={provId} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{info.proveedor.razon_social}</h3>
                      {badge && <Badge className={badge.className}>{badge.label}</Badge>}
                      {oc?.folio && <span className="text-xs text-muted-foreground">{oc.folio}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {info.lineas.length} línea{info.lineas.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{mxn(info.total)}</p>
                </div>

                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Insumo</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">P. Unitario</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {info.lineas.map((l) => (
                        <TableRow key={l.insumoId}>
                          <TableCell>{l.nombre}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {l.cantidad} {l.unidad}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{mxn(l.precio)}</TableCell>
                          <TableCell className="text-right tabular-nums">{mxn(l.cantidad * l.precio)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Acciones por estatus */}
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  {/* Sin OC o borrador o rechazada → admin envía */}
                  {(!estatus || estatus === "borrador" || estatus === "rechazada") && isAdmin && (
                    <>
                      {paquete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("¿Eliminar esta asignación? Se borrará el paquete y la OC en borrador.")) {
                              eliminarMut.mutate(paquete.id);
                            }
                          }}
                          disabled={eliminarMut.isPending}
                        >
                          Quitar asignación
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => { setEnviandoProv(provId); enviarMut.mutate(provId); }}
                        disabled={!puedeEnviar}
                      >
                        <Send className="size-4 mr-1" />
                        {enviandoEsta ? "Enviando…" : estatus === "rechazada" ? "Reenviar a supervisor" : "Enviar a supervisor"}
                      </Button>
                    </>
                  )}

                  {/* Pendiente → supervisor autoriza/rechaza */}
                  {estatus === "pendiente_autorizacion" && (
                    <>
                      {!isSupervisor && (
                        <Button size="sm" variant="outline" disabled>
                          <Clock className="size-4 mr-1" />
                          Pendiente de autorización
                        </Button>
                      )}
                      {isSupervisor && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRechazoDialog({ ocId: oc.id, folio: oc.folio })}
                            disabled={rechazarMut.isPending}
                          >
                            <XCircle className="size-4 mr-1" />
                            Rechazar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => autorizarMut.mutate(oc.id)}
                            disabled={autorizarMut.isPending}
                          >
                            <CheckCircle2 className="size-4 mr-1" />
                            Autorizar
                          </Button>
                        </>
                      )}
                    </>
                  )}

                  {/* Autorizada */}
                  {estatus === "autorizada" && (
                    <p className="text-sm flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="size-4" /> Autorizada
                    </p>
                  )}

                  {/* Pagada */}
                  {estatus === "pagada" && (
                    <p className="text-sm text-blue-700">Pagada</p>
                  )}
                </div>

                {/* Detalle de rechazo */}
                {estatus === "rechazada" && oc?.notas_supervisor && (
                  <div className="text-sm text-rose-700 bg-rose-50 p-2 rounded-md flex items-start gap-2">
                    <div className="flex-1">
                      <strong>Motivo del rechazo:</strong> {oc.notas_supervisor}
                    </div>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => reabrirMut.mutate(oc.id)}
                        disabled={reabrirMut.isPending}
                      >
                        <RotateCcw className="size-3 mr-1" />
                        Reabrir
                      </Button>
                    )}
                  </div>
                )}

                {dirty && estatus && estatus !== "borrador" && estatus !== "rechazada" && (
                  <p className="text-xs text-amber-700">
                    La asignación local difiere de la OC enviada. Las ediciones se ignorarán mientras la OC esté {badge?.label.toLowerCase()}.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Diálogo de rechazo */}
      <Dialog open={!!rechazoDialog} onOpenChange={(o) => { if (!o) { setRechazoDialog(null); setMotivoRechazo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar OC {rechazoDialog?.folio}</DialogTitle>
            <DialogDescription>
              Escribe el motivo del rechazo. El equipo administrativo verá esta nota para corregir y reenviar.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo del rechazo…"
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRechazoDialog(null); setMotivoRechazo(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!motivoRechazo.trim() || rechazarMut.isPending}
              onClick={() => {
                if (!rechazoDialog) return;
                rechazarMut.mutate({ ocId: rechazoDialog.ocId, motivo: motivoRechazo.trim() });
              }}
            >
              Rechazar OC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
