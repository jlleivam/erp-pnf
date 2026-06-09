import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getSubcontratoPresupuesto,
  guardarRenglonesSubcontrato,
} from "@/lib/api/subcontratos.functions";
import { procesarRenglones, calcularClavesPadre, type RenglonInput } from "@/lib/presupuesto-utils";
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
import { Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";

type RowDraft = RenglonInput & { _id: string };

let _id = 0;
const nextId = () => `r${++_id}`;
const emptyRow = (): RowDraft => ({
  _id: nextId(),
  clave: "",
  concepto: "",
  unidad: "",
  cantidad: null,
  precio_unitario: null,
});

export function CapturaSubcontratoSheet({
  presupuestoSubcontratoId,
  onClose,
  onSaved,
}: {
  presupuestoSubcontratoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fetchOne = useServerFn(getSubcontratoPresupuesto);
  const { data, isLoading } = useQuery({
    queryKey: ["subcontrato-presupuesto", presupuestoSubcontratoId],
    queryFn: () => fetchOne({ data: { id: presupuestoSubcontratoId } }),
  });

  const [rows, setRows] = useState<RowDraft[]>([emptyRow()]);

  useEffect(() => {
    if (data?.renglones && data.renglones.length > 0) {
      setRows(
        data.renglones.map((r: any) => ({
          _id: nextId(),
          clave: r.clave,
          concepto: r.concepto,
          unidad: r.unidad ?? "",
          cantidad: r.cantidad,
          precio_unitario: r.precio_unitario,
        })),
      );
    }
  }, [data]);

  const updateRow = (id: string, patch: Partial<RowDraft>) =>
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r._id !== id));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);

  const calc = useMemo(() => {
    const input: RenglonInput[] = rows
      .filter((r) => r.clave.trim() || r.concepto.trim())
      .map((r) => ({
        clave: r.clave.trim(),
        concepto: r.concepto.trim(),
        unidad: r.unidad?.toString().trim() || null,
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
      }));
    return procesarRenglones(input);
  }, [rows]);

  const erroresPorClave = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of calc.errores) {
      const ex = map.get(e.clave) ?? [];
      map.set(e.clave, [...ex, ...e.errores]);
    }
    return map;
  }, [calc.errores]);

  const importePorClave = useMemo(() => {
    const m = new Map<string, number>();
    if (calc.errores.length === 0) for (const r of calc.renglones) m.set(r.clave, r.importe);
    return m;
  }, [calc]);

  const clavesPadre = useMemo(
    () => calcularClavesPadre(rows.map((r) => r.clave)),
    [rows],
  );

  const guardar = useServerFn(guardarRenglonesSubcontrato);
  const guardarM = useMutation({
    mutationFn: guardar,
    onSuccess: () => {
      toast.success("Renglones guardados");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const presupuesto = data?.presupuesto as any;
  const editable = presupuesto?.estatus === "borrador";

  const handleGuardar = () => {
    if (calc.errores.length > 0) {
      toast.error("Corrige los errores antes de guardar");
      return;
    }
    const payload = rows
      .filter((r) => r.clave.trim())
      .map((r) => ({
        clave: r.clave.trim(),
        concepto: r.concepto.trim(),
        unidad: r.unidad?.toString().trim() || null,
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
      }));
    guardarM.mutate({ data: { presupuestoSubcontratoId, renglones: payload } });
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {presupuesto?.nombre ?? "Presupuesto de subcontrato"}
            {presupuesto && (
              <Badge className="ml-2" variant="outline">
                {presupuesto.estatus}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Captura clave WBS (ej. 1, 1.1, 1.2.3). Los grupos suman automáticamente.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground mt-6">Cargando…</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {editable && (
                <Button size="sm" variant="ghost" onClick={addRow}>
                  <Plus className="size-4 mr-1" /> Agregar renglón
                </Button>
              )}
              <div className="ml-auto">
                {calc.errores.length > 0 ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="size-3" />
                    {calc.errores.length} error(es)
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="size-3" />
                    Total {formatMXN(calc.montoTotal)}
                  </Badge>
                )}
              </div>
            </div>

            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 w-24">Clave</th>
                    <th className="text-left p-2">Concepto</th>
                    <th className="text-left p-2 w-20">Unidad</th>
                    <th className="text-right p-2 w-24">Cantidad</th>
                    <th className="text-right p-2 w-24">PU</th>
                    <th className="text-right p-2 w-28">Importe</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const claveTrim = r.clave.trim();
                    const errs = erroresPorClave.get(claveTrim) ?? [];
                    const importe = importePorClave.get(claveTrim) ?? 0;
                    const esPadre = claveTrim !== "" && clavesPadre.has(claveTrim);
                    return (
                      <tr
                        key={r._id}
                        className={`border-t border-border ${
                          errs.length ? "bg-destructive/5" : esPadre ? "bg-accent/40 font-medium" : ""
                        }`}
                      >
                        <td className="p-1">
                          <Input
                            value={r.clave}
                            disabled={!editable}
                            onChange={(e) => updateRow(r._id, { clave: e.target.value })}
                            placeholder="1.1"
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={r.concepto}
                            disabled={!editable}
                            onChange={(e) => updateRow(r._id, { concepto: e.target.value })}
                            placeholder="Concepto"
                            className="h-8"
                          />
                          {errs.length > 0 && (
                            <p className="text-xs text-destructive mt-1">{errs.join(" · ")}</p>
                          )}
                          {esPadre && errs.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Partida — suma de sus conceptos
                            </p>
                          )}
                        </td>
                        {esPadre ? (
                          <>
                            <td className="p-2 text-center text-muted-foreground">—</td>
                            <td className="p-2 text-center text-muted-foreground">—</td>
                            <td className="p-2 text-center text-muted-foreground">—</td>
                          </>
                        ) : (
                          <>
                            <td className="p-1">
                              <Input
                                value={r.unidad ?? ""}
                                disabled={!editable}
                                onChange={(e) => updateRow(r._id, { unidad: e.target.value })}
                                placeholder="m2"
                                className="h-8"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                disabled={!editable}
                                value={r.cantidad ?? ""}
                                onChange={(e) =>
                                  updateRow(r._id, {
                                    cantidad: e.target.value === "" ? null : Number(e.target.value),
                                  })
                                }
                                className="h-8 text-right"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                disabled={!editable}
                                value={r.precio_unitario ?? ""}
                                onChange={(e) =>
                                  updateRow(r._id, {
                                    precio_unitario:
                                      e.target.value === "" ? null : Number(e.target.value),
                                  })
                                }
                                className="h-8 text-right"
                              />
                            </td>
                          </>
                        )}
                        <td className="p-2 text-right tabular-nums">{formatMXN(importe)}</td>
                        <td className="p-1 text-right">
                          {editable && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => removeRow(r._id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-background py-3">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              {editable && (
                <Button
                  disabled={guardarM.isPending || calc.errores.length > 0}
                  onClick={handleGuardar}
                >
                  {guardarM.isPending ? "Guardando…" : "Guardar borrador"}
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
