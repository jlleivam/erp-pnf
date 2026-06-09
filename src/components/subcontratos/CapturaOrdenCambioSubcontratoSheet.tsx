import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getSubcontratoPresupuesto,
  getVigenteSubcontrato,
  guardarRenglonesOCSubcontrato,
} from "@/lib/api/subcontratos.functions";
import { procesarOrdenCambio, type OCInput } from "@/lib/presupuesto-utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, AlertCircle, CheckCircle2, Eye } from "lucide-react";
import { VigenteViewerDialog } from "@/components/presupuesto/VigenteViewerDialog";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";

type RowDraft = OCInput & { _id: string };

let _id = 0;
const nextId = () => `oc${++_id}`;
const emptyRow = (): RowDraft => ({
  _id: nextId(),
  clave: "",
  tipo_movimiento: "modificacion",
  concepto: "",
  unidad: "",
  cantidad: null,
  precio_unitario: null,
});

export function CapturaOrdenCambioSubcontratoSheet({
  subcontratoId,
  presupuestoSubcontratoId,
  onClose,
  onSaved,
}: {
  subcontratoId: string;
  presupuestoSubcontratoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fetchOne = useServerFn(getSubcontratoPresupuesto);
  const { data, isLoading } = useQuery({
    queryKey: ["subcontrato-presupuesto", presupuestoSubcontratoId],
    queryFn: () => fetchOne({ data: { id: presupuestoSubcontratoId } }),
  });
  const fetchVig = useServerFn(getVigenteSubcontrato);
  const vigQ = useQuery({
    queryKey: ["subcontrato-vigente", subcontratoId],
    queryFn: () => fetchVig({ data: { subcontratoId } }),
  });

  const [rows, setRows] = useState<RowDraft[]>([emptyRow()]);
  const [showVigente, setShowVigente] = useState(false);

  useEffect(() => {
    if (data?.renglones && data.renglones.length > 0) {
      setRows(
        data.renglones.map((r: any) => ({
          _id: nextId(),
          clave: r.clave,
          tipo_movimiento: r.tipo_movimiento as OCInput["tipo_movimiento"],
          concepto: r.concepto ?? "",
          unidad: r.unidad ?? "",
          cantidad: r.cantidad,
          precio_unitario: r.precio_unitario,
        })),
      );
    }
  }, [data]);

  const vigente = (vigQ.data?.vigente ?? []) as any[];
  const updateRow = (id: string, patch: Partial<RowDraft>) =>
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r._id !== id));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);

  const calc = useMemo(() => {
    const input: OCInput[] = rows
      .filter((r) => r.clave.trim())
      .map((r) => ({
        clave: r.clave.trim(),
        tipo_movimiento: r.tipo_movimiento,
        concepto: r.concepto?.toString().trim() || undefined,
        unidad: r.unidad?.toString().trim() || null,
        cantidad: r.cantidad,
        precio_unitario: r.precio_unitario,
      }));
    return procesarOrdenCambio(vigente as any, input);
  }, [rows, vigente]);

  const erroresPorClave = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const e of calc.errores) {
      const ex = map.get(e.clave) ?? [];
      map.set(e.clave, [...ex, ...e.errores]);
    }
    return map;
  }, [calc.errores]);

  const guardar = useServerFn(guardarRenglonesOCSubcontrato);
  const guardarM = useMutation({
    mutationFn: guardar,
    onSuccess: () => {
      toast.success("OC guardada");
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
        tipo_movimiento: r.tipo_movimiento,
        concepto: r.concepto?.toString().trim() || undefined,
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
            {presupuesto?.nombre ?? "Orden de cambio"}
            {presupuesto && (
              <Badge className="ml-2" variant="outline">
                {presupuesto.estatus}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Modifica, agrega o elimina conceptos contra el vigente del subcontrato.
          </SheetDescription>
        </SheetHeader>

        {isLoading || vigQ.isLoading ? (
          <p className="text-sm text-muted-foreground mt-6">Cargando…</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowVigente(true)}
              >
                <Eye className="size-4 mr-1" /> Ver vigente
              </Button>
              {editable && (
                <Button size="sm" variant="ghost" onClick={addRow}>
                  <Plus className="size-4 mr-1" /> Agregar movimiento
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
                    Δ {formatMXN(calc.montoDelta)}
                  </Badge>
                )}
              </div>
            </div>

            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 w-24">Clave</th>
                    <th className="text-left p-2 w-32">Movimiento</th>
                    <th className="text-left p-2">Concepto</th>
                    <th className="text-left p-2 w-20">Unidad</th>
                    <th className="text-right p-2 w-24">Cantidad</th>
                    <th className="text-right p-2 w-24">PU</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const errs = erroresPorClave.get(r.clave.trim()) ?? [];
                    return (
                      <tr
                        key={r._id}
                        className={`border-t border-border ${errs.length ? "bg-destructive/5" : ""}`}
                      >
                        <td className="p-1">
                          <Input
                            value={r.clave}
                            disabled={!editable}
                            onChange={(e) => updateRow(r._id, { clave: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <Select
                            value={r.tipo_movimiento}
                            disabled={!editable}
                            onValueChange={(v) =>
                              updateRow(r._id, {
                                tipo_movimiento: v as OCInput["tipo_movimiento"],
                              })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="modificacion">Modificar</SelectItem>
                              <SelectItem value="adicion">Adición</SelectItem>
                              <SelectItem value="eliminacion">Eliminar</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1">
                          <Input
                            value={r.concepto ?? ""}
                            disabled={!editable || r.tipo_movimiento !== "adicion"}
                            onChange={(e) => updateRow(r._id, { concepto: e.target.value })}
                            placeholder="(solo para adición)"
                            className="h-8"
                          />
                          {errs.length > 0 && (
                            <p className="text-xs text-destructive mt-1">{errs.join(" · ")}</p>
                          )}
                        </td>
                        <td className="p-1">
                          <Input
                            value={r.unidad ?? ""}
                            disabled={!editable || r.tipo_movimiento === "eliminacion"}
                            onChange={(e) => updateRow(r._id, { unidad: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number"
                            value={r.cantidad ?? ""}
                            disabled={!editable || r.tipo_movimiento === "eliminacion"}
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
                            disabled={!editable || r.tipo_movimiento === "eliminacion"}
                            onChange={(e) =>
                              updateRow(r._id, {
                                precio_unitario:
                                  e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="h-8 text-right"
                          />
                        </td>
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
