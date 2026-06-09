import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getPresupuesto,
  getVigente,
  guardarRenglonesOC,
  solicitarAutorizacionPresupuesto,
} from "@/lib/api/presupuestos.functions";
import {
  procesarOrdenCambio,
  calcularClavesPadre,
  type OCInput,
  type VigenteNode,
} from "@/lib/presupuesto-utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, AlertCircle, CheckCircle2, Search, Eye } from "lucide-react";
import { VigenteViewerDialog } from "./VigenteViewerDialog";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";

type ModRow = {
  _id: string;
  clave: string;
  cantidad: number | null;
  precio_unitario: number | null;
};
type AddRow = {
  _id: string;
  clave: string;
  concepto: string;
  unidad: string;
  cantidad: number | null;
  precio_unitario: number | null;
};
type DelRow = { _id: string; clave: string };

let _id = 0;
const nextId = () => `o${++_id}`;

export function CapturaOrdenCambioSheet({
  obraId,
  presupuestoId,
  onClose,
  onSaved,
}: {
  obraId: string;
  presupuestoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fetchOne = useServerFn(getPresupuesto);
  const fetchVigente = useServerFn(getVigente);

  const presQ = useQuery({
    queryKey: ["presupuesto", presupuestoId],
    queryFn: () => fetchOne({ data: { id: presupuestoId } }),
  });
  const vigQ = useQuery({
    queryKey: ["presupuesto-vigente", obraId],
    queryFn: () => fetchVigente({ data: { obraId } }),
  });

  const presupuesto = presQ.data?.presupuesto;
  const yaAutorizado = presupuesto?.estatus !== "borrador";
  const vigente = (vigQ.data?.vigente ?? []) as VigenteNode[];
  const vigenteMap = useMemo(() => {
    const m = new Map<string, VigenteNode>();
    for (const n of vigente) m.set(n.clave, n);
    return m;
  }, [vigente]);
  const hojasVigentes = useMemo(
    () => vigente.filter((n) => !n.es_grupo),
    [vigente],
  );

  const [mods, setMods] = useState<ModRow[]>([]);
  const [adds, setAdds] = useState<AddRow[]>([]);
  const [dels, setDels] = useState<DelRow[]>([]);

  // Cargar renglones existentes de la OC (si la estamos editando)
  useEffect(() => {
    const renglones = presQ.data?.renglones as any[] | undefined;
    if (!renglones || renglones.length === 0) return;
    const m: ModRow[] = [];
    const a: AddRow[] = [];
    const d: DelRow[] = [];
    for (const r of renglones) {
      if (r.tipo_movimiento === "modificacion") {
        m.push({
          _id: nextId(),
          clave: r.clave,
          cantidad: r.cantidad != null ? Number(r.cantidad) : null,
          precio_unitario: r.precio_unitario != null ? Number(r.precio_unitario) : null,
        });
      } else if (r.tipo_movimiento === "adicion") {
        a.push({
          _id: nextId(),
          clave: r.clave,
          concepto: r.concepto,
          unidad: r.unidad ?? "",
          cantidad: r.cantidad != null ? Number(r.cantidad) : null,
          precio_unitario: r.precio_unitario != null ? Number(r.precio_unitario) : null,
        });
      } else if (r.tipo_movimiento === "eliminacion") {
        d.push({ _id: nextId(), clave: r.clave });
      }
    }
    setMods(m);
    setAdds(a);
    setDels(d);
  }, [presQ.data]);

  // ====== Cálculo en vivo ======
  const input: OCInput[] = useMemo(() => {
    const out: OCInput[] = [];
    for (const r of mods) {
      out.push({
        clave: r.clave.trim(),
        tipo_movimiento: "modificacion",
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
      });
    }
    for (const r of adds) {
      out.push({
        clave: r.clave.trim(),
        tipo_movimiento: "adicion",
        concepto: r.concepto.trim(),
        unidad: r.unidad.trim() || null,
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
      });
    }
    for (const r of dels) {
      out.push({
        clave: r.clave.trim(),
        tipo_movimiento: "eliminacion",
      });
    }
    return out;
  }, [mods, adds, dels]);

  const calc = useMemo(() => procesarOrdenCambio(vigente, input), [vigente, input]);
  const erroresPorClave = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of calc.errores) {
      const existing = map.get(e.clave) ?? [];
      map.set(e.clave, [...existing, ...e.errores]);
    }
    return map;
  }, [calc.errores]);
  const deltaPorClave = useMemo(() => {
    const m = new Map<string, number>();
    if (calc.errores.length === 0) {
      for (const r of calc.renglones) m.set(r.clave, r.importe_delta);
    }
    return m;
  }, [calc]);

  // ====== Mutations ======
  const guardar = useServerFn(guardarRenglonesOC);
  const guardarM = useMutation({
    mutationFn: guardar,
    onSuccess: () => {
      toast.success("Orden de cambio guardada");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const solicitar = useServerFn(solicitarAutorizacionPresupuesto);
  const solicitarM = useMutation({
    mutationFn: solicitar,
    onSuccess: () => {
      toast.success("Solicitud enviada al supervisor");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleGuardar = (solicitarDespues: boolean) => {
    if (calc.errores.length > 0) {
      toast.error("Corrige los errores antes de guardar");
      return;
    }
    if (input.length === 0) {
      toast.error("Agrega al menos un movimiento");
      return;
    }
    guardarM.mutate(
      { data: { presupuestoId, renglones: input } },
      {
        onSuccess: () => {
          if (solicitarDespues) {
            solicitarM.mutate({ data: { id: presupuestoId } });
          }
        },
      },
    );
  };

  // ====== Pickers ======
  const [pickMod, setPickMod] = useState(false);
  const [pickDel, setPickDel] = useState(false);
  const [showVigente, setShowVigente] = useState(false);

  const addMod = (n: VigenteNode) => {
    if (mods.some((m) => m.clave === n.clave)) {
      toast.error(`${n.clave} ya está en modificaciones`);
      return;
    }
    setMods((rs) => [
      ...rs,
      {
        _id: nextId(),
        clave: n.clave,
        cantidad: n.cantidad,
        precio_unitario: n.precio_unitario,
      },
    ]);
    setPickMod(false);
  };
  const addDel = (n: VigenteNode) => {
    if (dels.some((d) => d.clave === n.clave)) return;
    setDels((rs) => [...rs, { _id: nextId(), clave: n.clave }]);
  };

  const loading = presQ.isLoading || vigQ.isLoading;
  const tieneBase = vigQ.data?.hasBase;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {presupuesto?.nombre ?? "Orden de cambio"}
            {presupuesto && presupuesto.estatus !== "borrador" && (
              <Badge className="ml-2">
                {presupuesto.estatus === "autorizado"
                  ? "Autorizada"
                  : presupuesto.estatus === "solicitada"
                  ? "Solicitada"
                  : "Rechazada"}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Captura las modificaciones, adiciones y eliminaciones sobre el presupuesto
            vigente. El base nunca se modifica.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground mt-6">Cargando…</p>
        ) : !tieneBase ? (
          <Card className="mt-6 border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay presupuesto base autorizado todavía.
          </Card>
        ) : (
          <div className="mt-6 space-y-4">
            {/* Resumen */}
            <div className="flex items-center justify-end gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowVigente(true)}
                className="mr-auto"
              >
                <Eye className="size-4 mr-1" /> Ver vigente
              </Button>
              {calc.errores.length > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="size-3" />
                  {calc.errores.length} error(es)
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className={`gap-1 ${
                    calc.montoDelta < 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  <CheckCircle2 className="size-3" />Δ {formatMXN(calc.montoDelta)}
                </Badge>
              )}
            </div>

            <Tabs defaultValue="mod">
              <TabsList>
                <TabsTrigger value="mod">Modificar ({mods.length})</TabsTrigger>
                <TabsTrigger value="add">Agregar ({adds.length})</TabsTrigger>
                <TabsTrigger value="del">Eliminar ({dels.length})</TabsTrigger>
              </TabsList>

              {/* ===== MODIFICAR ===== */}
              <TabsContent value="mod" className="mt-4 space-y-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPickMod(true)}
                  disabled={yaAutorizado}
                >
                  <Plus className="size-4 mr-1" /> Seleccionar concepto…
                </Button>
                {mods.length === 0 ? (
                  <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
                    Sin modificaciones.
                  </Card>
                ) : (
                  <Card className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left p-2 w-24">Clave</th>
                          <th className="text-left p-2">Concepto</th>
                          <th className="text-right p-2 w-24">Cant. actual</th>
                          <th className="text-right p-2 w-24">PU actual</th>
                          <th className="text-right p-2 w-24">Cant. nueva</th>
                          <th className="text-right p-2 w-24">PU nuevo</th>
                          <th className="text-right p-2 w-28">Δ Importe</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {mods.map((r) => {
                          const orig = vigenteMap.get(r.clave);
                          const errs = erroresPorClave.get(r.clave) ?? [];
                          const delta = deltaPorClave.get(r.clave) ?? 0;
                          return (
                            <tr
                              key={r._id}
                              className={`border-t border-border ${
                                errs.length ? "bg-destructive/5" : ""
                              }`}
                            >
                              <td className="p-2 tabular-nums">{r.clave}</td>
                              <td className="p-2">
                                {orig?.concepto ?? "—"}
                                {errs.length > 0 && (
                                  <p className="text-xs text-destructive mt-1">
                                    {errs.join(" · ")}
                                  </p>
                                )}
                              </td>
                              <td className="p-2 text-right tabular-nums text-muted-foreground">
                                {orig?.cantidad ?? "—"}
                              </td>
                              <td className="p-2 text-right tabular-nums text-muted-foreground">
                                {orig?.precio_unitario != null
                                  ? formatMXN(Number(orig.precio_unitario))
                                  : "—"}
                              </td>
                              <td className="p-1">
                                <Input
                                  type="number"
                                  value={r.cantidad ?? ""}
                                  onChange={(e) =>
                                    setMods((rs) =>
                                      rs.map((x) =>
                                        x._id === r._id
                                          ? {
                                              ...x,
                                              cantidad:
                                                e.target.value === ""
                                                  ? null
                                                  : Number(e.target.value),
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                  className="h-8 text-right"
                                />
                              </td>
                              <td className="p-1">
                                <Input
                                  type="number"
                                  value={r.precio_unitario ?? ""}
                                  onChange={(e) =>
                                    setMods((rs) =>
                                      rs.map((x) =>
                                        x._id === r._id
                                          ? {
                                              ...x,
                                              precio_unitario:
                                                e.target.value === ""
                                                  ? null
                                                  : Number(e.target.value),
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                  className="h-8 text-right"
                                />
                              </td>
                              <td
                                className={`p-2 text-right tabular-nums ${
                                  delta < 0 ? "text-destructive" : delta > 0 ? "text-foreground" : ""
                                }`}
                              >
                                {formatMXN(delta)}
                              </td>
                              <td className="p-1 text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    setMods((rs) => rs.filter((x) => x._id !== r._id))
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                )}
              </TabsContent>

              {/* ===== AGREGAR ===== */}
              <TabsContent value="add" className="mt-4 space-y-3">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={yaAutorizado}
                  onClick={() =>
                    setAdds((rs) => [
                      ...rs,
                      {
                        _id: nextId(),
                        clave: "",
                        concepto: "",
                        unidad: "",
                        cantidad: null,
                        precio_unitario: null,
                      },
                    ])
                  }
                >
                  <Plus className="size-4 mr-1" /> Agregar renglón
                </Button>
                {adds.length === 0 ? (
                  <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
                    Sin adiciones.
                  </Card>
                ) : (
                  <Card className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left p-2 w-24">Clave</th>
                          <th className="text-left p-2">Concepto</th>
                          <th className="text-left p-2 w-20">Unidad</th>
                          <th className="text-right p-2 w-24">Cantidad</th>
                          <th className="text-right p-2 w-24">PU</th>
                          <th className="text-right p-2 w-28">Δ Importe</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {adds.map((r) => {
                          const errs = erroresPorClave.get(r.clave.trim()) ?? [];
                          const delta = deltaPorClave.get(r.clave.trim()) ?? 0;
                          return (
                            <tr
                              key={r._id}
                              className={`border-t border-border ${
                                errs.length ? "bg-destructive/5" : ""
                              }`}
                            >
                              <td className="p-1">
                                <Input
                                  value={r.clave}
                                  placeholder="3.1"
                                  className="h-8"
                                  onChange={(e) =>
                                    setAdds((rs) =>
                                      rs.map((x) =>
                                        x._id === r._id ? { ...x, clave: e.target.value } : x,
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td className="p-1">
                                <Input
                                  value={r.concepto}
                                  placeholder="Concepto"
                                  className="h-8"
                                  onChange={(e) =>
                                    setAdds((rs) =>
                                      rs.map((x) =>
                                        x._id === r._id ? { ...x, concepto: e.target.value } : x,
                                      ),
                                    )
                                  }
                                />
                                {errs.length > 0 && (
                                  <p className="text-xs text-destructive mt-1">
                                    {errs.join(" · ")}
                                  </p>
                                )}
                              </td>
                              <td className="p-1">
                                <Input
                                  value={r.unidad}
                                  placeholder="m2"
                                  className="h-8"
                                  onChange={(e) =>
                                    setAdds((rs) =>
                                      rs.map((x) =>
                                        x._id === r._id ? { ...x, unidad: e.target.value } : x,
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td className="p-1">
                                <Input
                                  type="number"
                                  value={r.cantidad ?? ""}
                                  className="h-8 text-right"
                                  onChange={(e) =>
                                    setAdds((rs) =>
                                      rs.map((x) =>
                                        x._id === r._id
                                          ? {
                                              ...x,
                                              cantidad:
                                                e.target.value === ""
                                                  ? null
                                                  : Number(e.target.value),
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td className="p-1">
                                <Input
                                  type="number"
                                  value={r.precio_unitario ?? ""}
                                  className="h-8 text-right"
                                  onChange={(e) =>
                                    setAdds((rs) =>
                                      rs.map((x) =>
                                        x._id === r._id
                                          ? {
                                              ...x,
                                              precio_unitario:
                                                e.target.value === ""
                                                  ? null
                                                  : Number(e.target.value),
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                              </td>
                              <td className="p-2 text-right tabular-nums">
                                {formatMXN(delta)}
                              </td>
                              <td className="p-1 text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    setAdds((rs) => rs.filter((x) => x._id !== r._id))
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                )}
              </TabsContent>

              {/* ===== ELIMINAR ===== */}
              <TabsContent value="del" className="mt-4 space-y-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPickDel(true)}
                  disabled={yaAutorizado}
                >
                  <Plus className="size-4 mr-1" /> Seleccionar conceptos…
                </Button>
                {dels.length === 0 ? (
                  <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
                    Sin eliminaciones.
                  </Card>
                ) : (
                  <Card className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left p-2 w-24">Clave</th>
                          <th className="text-left p-2">Concepto</th>
                          <th className="text-right p-2 w-32">Importe a restar</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dels.map((r) => {
                          const orig = vigenteMap.get(r.clave);
                          const delta = deltaPorClave.get(r.clave) ?? 0;
                          const errs = erroresPorClave.get(r.clave) ?? [];
                          return (
                            <tr
                              key={r._id}
                              className={`border-t border-border ${
                                errs.length ? "bg-destructive/5" : ""
                              }`}
                            >
                              <td className="p-2 tabular-nums">{r.clave}</td>
                              <td className="p-2">
                                {orig?.concepto ?? "—"}
                                {errs.length > 0 && (
                                  <p className="text-xs text-destructive mt-1">
                                    {errs.join(" · ")}
                                  </p>
                                )}
                              </td>
                              <td className="p-2 text-right tabular-nums text-destructive">
                                {formatMXN(delta)}
                              </td>
                              <td className="p-1 text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    setDels((rs) => rs.filter((x) => x._id !== r._id))
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-background py-3 border-t">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                disabled={guardarM.isPending || calc.errores.length > 0 || yaAutorizado}
                onClick={() => handleGuardar(false)}
              >
                {guardarM.isPending ? "Guardando…" : "Guardar borrador"}
              </Button>
              <Button
                disabled={
                  guardarM.isPending ||
                  solicitarM.isPending ||
                  calc.errores.length > 0 ||
                  yaAutorizado ||
                  input.length === 0
                }
                onClick={() => handleGuardar(true)}
              >
                Guardar y solicitar autorización
              </Button>
            </div>
          </div>
        )}

        {/* Picker de modificación */}
        {pickMod && (
          <ConceptoPicker
            hojas={hojasVigentes}
            excluir={new Set(mods.map((m) => m.clave))}
            onClose={() => setPickMod(false)}
            onSelect={addMod}
            title="Selecciona un concepto a modificar"
          />
        )}
        {/* Picker de eliminación (multi) */}
        {pickDel && (
          <ConceptoPicker
            hojas={hojasVigentes}
            excluir={new Set(dels.map((d) => d.clave))}
            onClose={() => setPickDel(false)}
            onSelect={(n) => {
              addDel(n);
            }}
            title="Selecciona conceptos a eliminar"
            multi
          />
        )}
        <VigenteViewerDialog
          open={showVigente}
          onClose={() => setShowVigente(false)}
          vigente={vigente as any[]}
          total={vigQ.data?.montoTotal}
        />
      </SheetContent>
    </Sheet>
  );
}

function ConceptoPicker({
  hojas,
  excluir,
  onClose,
  onSelect,
  title,
  multi,
}: {
  hojas: VigenteNode[];
  excluir: Set<string>;
  onClose: () => void;
  onSelect: (n: VigenteNode) => void;
  title: string;
  multi?: boolean;
}) {
  const [q, setQ] = useState("");
  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return hojas.filter(
      (h) =>
        !excluir.has(h.clave) &&
        (!term ||
          h.clave.toLowerCase().includes(term) ||
          h.concepto.toLowerCase().includes(term)),
    );
  }, [hojas, excluir, q]);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por clave o concepto…"
              className="pl-8"
            />
          </div>
          {filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              Sin resultados.
            </p>
          ) : (
            <TooltipProvider delayDuration={200}>
              <ul className="divide-y border rounded-md">
                {filtradas.map((h) => (
                  <li key={h.clave}>
                    <button
                      className="w-full text-left p-2 hover:bg-muted/50 text-sm flex items-center gap-2"
                      onClick={() => onSelect(h)}
                    >
                      <span className="font-mono text-xs text-muted-foreground w-16">
                        {h.clave}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1 truncate cursor-default">
                            {h.concepto}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          className="max-w-md whitespace-normal"
                        >
                          {h.concepto}
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs text-muted-foreground">
                        {formatMXN(Number(h.importe))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </TooltipProvider>
          )}
          {multi && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Listo
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
