import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getPresupuesto,
  guardarRenglones,
  autorizarPresupuesto,
  parsearExcelPresupuesto,
  descargarPlantillaPresupuesto,
} from "@/lib/api/presupuestos.functions";
import {
  procesarRenglones,
  calcularClavesPadre,
  type RenglonInput,
} from "@/lib/presupuesto-utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
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

export function CapturaPresupuestoSheet({
  presupuestoId,
  onClose,
  onSaved,
}: {
  presupuestoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fetchOne = useServerFn(getPresupuesto);
  const { data, isLoading } = useQuery({
    queryKey: ["presupuesto", presupuestoId],
    queryFn: () => fetchOne({ data: { id: presupuestoId } }),
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

  const updateRow = (id: string, patch: Partial<RowDraft>) => {
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  };
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r._id !== id));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);

  // Cálculo en vivo
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

  // Map errores por clave para mostrar inline
  const erroresPorClave = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of calc.errores) {
      const existing = map.get(e.clave) ?? [];
      map.set(e.clave, [...existing, ...e.errores]);
    }
    return map;
  }, [calc.errores]);

  // Importes por clave (cuando no hay errores)
  const importePorClave = useMemo(() => {
    const m = new Map<string, number>();
    if (calc.errores.length === 0) {
      for (const r of calc.renglones) m.set(r.clave, r.importe);
    }
    return m;
  }, [calc]);

  // Claves padre (partidas que tienen al menos un hijo)
  const clavesPadre = useMemo(
    () => calcularClavesPadre(rows.map((r) => r.clave)),
    [rows],
  );

  const guardar = useServerFn(guardarRenglones);
  const guardarM = useMutation({
    mutationFn: guardar,
    onSuccess: () => {
      toast.success("Renglones guardados");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autorizar = useServerFn(autorizarPresupuesto);
  const autorizarM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => {
      toast.success("Presupuesto autorizado");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleGuardar = (autorizarDespues: boolean) => {
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
    guardarM.mutate(
      { data: { presupuestoId, renglones: payload } },
      {
        onSuccess: () => {
          if (autorizarDespues) {
            autorizarM.mutate({ data: { id: presupuestoId } });
          }
        },
      },
    );
  };

  // Importar Excel
  const descargarPlantilla = useServerFn(descargarPlantillaPresupuesto);
  const parsear = useServerFn(parsearExcelPresupuesto);
  const [parsing, setParsing] = useState(false);

  const handleDescargarPlantilla = async () => {
    try {
      const res = await descargarPlantilla();
      const blob = b64ToBlob(res.fileBase64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla-presupuesto.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleImportarExcel = async (file: File) => {
    setParsing(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await parsear({ data: { fileBase64: b64 } });
      if (!res.renglones.length) {
        toast.error("No se encontraron renglones en el archivo");
        return;
      }
      setRows(
        res.renglones.map((r) => ({
          _id: nextId(),
          clave: r.clave,
          concepto: r.concepto,
          unidad: r.unidad ?? "",
          cantidad: r.cantidad ?? null,
          precio_unitario: r.precio_unitario ?? null,
        })),
      );
      toast.success(`${res.renglones.length} renglones importados. Revísalos antes de guardar.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const presupuesto = data?.presupuesto;
  const yaAutorizado = presupuesto?.estatus === "autorizado";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {presupuesto?.nombre ?? "Editar presupuesto"}
            {yaAutorizado && <Badge className="ml-2">Autorizado</Badge>}
          </SheetTitle>
          <SheetDescription>
            Captura clave WBS (ej. 1, 1.1, 1.2.3). Los grupos suman automáticamente. Máximo 5 niveles.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground mt-6">Cargando…</p>
        ) : (
          <div className="mt-6 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleDescargarPlantilla}>
                <Download className="size-4 mr-1" /> Plantilla
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportarExcel(f);
                    e.target.value = "";
                  }}
                />
                <Button size="sm" variant="outline" asChild disabled={parsing}>
                  <span>
                    <Upload className="size-4 mr-1" />
                    {parsing ? "Importando…" : "Importar Excel"}
                  </span>
                </Button>
              </label>
              <Button size="sm" variant="ghost" onClick={addRow}>
                <Plus className="size-4 mr-1" /> Agregar renglón
              </Button>

              <div className="ml-auto flex items-center gap-3">
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

            {/* Tabla editable */}
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
                    const errs = erroresPorClave.get(r.clave.trim()) ?? [];
                    const importe = importePorClave.get(r.clave.trim()) ?? 0;
                    return (
                      <tr
                        key={r._id}
                        className={`border-t border-border ${errs.length ? "bg-destructive/5" : ""}`}
                      >
                        <td className="p-1">
                          <Input
                            value={r.clave}
                            onChange={(e) => updateRow(r._id, { clave: e.target.value })}
                            placeholder="1.1"
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={r.concepto}
                            onChange={(e) => updateRow(r._id, { concepto: e.target.value })}
                            placeholder="Concepto"
                            className="h-8"
                          />
                          {errs.length > 0 && (
                            <p className="text-xs text-destructive mt-1">{errs.join(" · ")}</p>
                          )}
                        </td>
                        <td className="p-1">
                          <Input
                            value={r.unidad ?? ""}
                            onChange={(e) => updateRow(r._id, { unidad: e.target.value })}
                            placeholder="m2"
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
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
                            value={r.precio_unitario ?? ""}
                            onChange={(e) =>
                              updateRow(r._id, {
                                precio_unitario: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="h-8 text-right"
                          />
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {formatMXN(importe)}
                        </td>
                        <td className="p-1 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => removeRow(r._id)}
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

            <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-background py-3">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button
                disabled={guardarM.isPending || calc.errores.length > 0 || yaAutorizado}
                onClick={() => handleGuardar(false)}
              >
                {guardarM.isPending ? "Guardando…" : "Guardar borrador"}
              </Button>
              <Button
                disabled={
                  guardarM.isPending || autorizarM.isPending ||
                  calc.errores.length > 0 || yaAutorizado ||
                  calc.renglones.length === 0
                }
                onClick={() => handleGuardar(true)}
              >
                Guardar y autorizar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const idx = res.indexOf(",");
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
