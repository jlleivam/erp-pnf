import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { capturarRespuesta } from "@/lib/api/solicitudes-cotizacion.functions";
import { formatMXN } from "@/lib/pdf/solicitud-cotizacion-pdf";

interface Props {
  solicitud: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  requisicionId: string;
}

type DraftItem = {
  insumo_id: string;
  cantidad: number;
  nombre: string;
  unidad?: string;
  precio_unitario: number;
  disponible: boolean;
  nota: string;
};

type ExtraCharge = { id: string; concepto: string; monto: number };

const IVA_RATE = 0.16;
const EXTRAS_MARKER = "[Cargos prorrateados]";
const noSpinner =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

function newExtraId() {
  return Math.random().toString(36).slice(2, 10);
}

export function CapturarRespuestaDialog({ solicitud, open, onOpenChange, requisicionId }: Props) {
  const qc = useQueryClient();
  const fn = useServerFn(capturarRespuesta);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [extras, setExtras] = useState<ExtraCharge[]>([]);

  useEffect(() => {
    if (!open) return;
    setItems(
      (solicitud.items ?? []).map((it: any) => ({
        insumo_id: it.insumo_id,
        cantidad: Number(it.cantidad),
        nombre: it.insumo?.nombre ?? "—",
        unidad: it.insumo?.unidad,
        precio_unitario: Number(it.precio_unitario ?? 0),
        disponible: it.disponible ?? true,
        nota: it.nota ?? "",
      }))
    );
    setExtras([]);
  }, [open, solicitud]);

  const subtotalBase = useMemo(
    () => items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0),
    [items]
  );
  const extrasTotal = useMemo(
    () => extras.reduce((s, e) => s + (Number(e.monto) || 0), 0),
    [extras]
  );
  const subtotal = subtotalBase + extrasTotal;
  const iva = subtotal * IVA_RATE;
  const total = subtotal + iva;

  const update = (idx: number, patch: Partial<DraftItem>) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addExtra = () =>
    setExtras((arr) => [...arr, { id: newExtraId(), concepto: "", monto: 0 }]);
  const updateExtra = (id: string, patch: Partial<ExtraCharge>) =>
    setExtras((arr) => arr.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeExtra = (id: string) =>
    setExtras((arr) => arr.filter((e) => e.id !== id));

  const validExtras = extras.filter(
    (e) => e.concepto.trim() !== "" && Number(e.monto) > 0
  );
  const validExtrasTotal = validExtras.reduce((s, e) => s + Number(e.monto), 0);
  const canSave =
    items.length > 0 &&
    (validExtras.length === 0 || subtotalBase > 0);

  const mut = useMutation({
    mutationFn: async () => {
      if (validExtras.length > 0 && subtotalBase <= 0) {
        throw new Error("Captura primero los precios para poder prorratear los cargos");
      }

      const itemsOut = items.map((it) => {
        const importeBase = it.cantidad * it.precio_unitario;
        let precioFinal = it.precio_unitario;
        if (validExtrasTotal > 0 && subtotalBase > 0 && it.cantidad > 0) {
          const peso = importeBase / subtotalBase;
          const delta = (validExtrasTotal * peso) / it.cantidad;
          precioFinal = it.precio_unitario + delta;
        }
        return {
          insumo_id: it.insumo_id,
          cantidad: it.cantidad,
          precio_unitario: precioFinal,
          disponible: precioFinal > 0,
          nota: it.nota || null,
        };
      });

      // Construir notas preservando lo previo (antes del marcador)
      const prev: string = solicitud.notas ?? "";
      const beforeMarker = prev.split(EXTRAS_MARKER)[0]?.trimEnd() ?? "";
      let notasOut: string | null = beforeMarker || null;
      if (validExtras.length > 0) {
        const lines = validExtras
          .map((e) => `${e.concepto.trim()}: ${formatMXN(Number(e.monto))}`)
          .join("\n");
        const block = `${EXTRAS_MARKER}\n${lines}`;
        notasOut = beforeMarker ? `${beforeMarker}\n\n${block}` : block;
      }

      return fn({
        data: {
          solicitudId: solicitud.id,
          items: itemsOut,
          notas: notasOut,
        },
      });
    },
    onSuccess: () => {
      toast.success("Cotización registrada");
      qc.invalidateQueries({ queryKey: ["solicitudes", requisicionId] });
      qc.invalidateQueries({ queryKey: ["requisiciones"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>Cotización</DialogTitle>
              <DialogDescription>
                {solicitud.proveedor?.razon_social ?? "Proveedor"}
              </DialogDescription>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap mr-6">
              Folio · {solicitud.folio}
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[45vh] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="w-24">Cantidad</TableHead>
                <TableHead className="w-32">P. Unitario</TableHead>
                <TableHead className="w-28 text-right">Importe</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => {
                const importe = it.cantidad * it.precio_unitario;
                return (
                  <TableRow key={it.insumo_id}>
                    <TableCell className="text-sm">
                      {it.nombre}
                      {it.unidad && <span className="text-muted-foreground ml-1">({it.unidad})</span>}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={noSpinner}
                        value={it.cantidad || ""}
                        onChange={(e) => update(idx, { cantidad: Number(e.target.value) || 0 })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                          $
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className={`pl-6 ${noSpinner}`}
                          value={it.precio_unitario || ""}
                          onChange={(e) => update(idx, { precio_unitario: Number(e.target.value) || 0 })}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatMXN(importe)}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={it.nota}
                        placeholder="—"
                        onChange={(e) => update(idx, { nota: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Cargos adicionales */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Cargos adicionales</p>
              <p className="text-xs text-muted-foreground">
                Se prorratean entre los insumos al guardar (flete, seguro, maniobras…).
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addExtra}>
              <Plus className="size-4 mr-1" /> Agregar cargo
            </Button>
          </div>

          {extras.length > 0 && (
            <div className="space-y-2">
              {extras.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <Input
                    placeholder="Concepto (ej. Flete)"
                    value={e.concepto}
                    onChange={(ev) => updateExtra(e.id, { concepto: ev.target.value })}
                    className="flex-1"
                  />
                  <div className="relative w-40">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`pl-6 ${noSpinner}`}
                      value={e.monto || ""}
                      onChange={(ev) => updateExtra(e.id, { monto: Number(ev.target.value) || 0 })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExtra(e.id)}
                    aria-label="Eliminar cargo"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {validExtras.length > 0 && subtotalBase <= 0 && (
            <p className="text-xs text-destructive">
              Captura primero los precios de los insumos para poder prorratear los cargos.
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal insumos</span>
              <span className="tabular-nums">{formatMXN(subtotalBase)}</span>
            </div>
            {extrasTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cargos adicionales</span>
                <span className="tabular-nums">{formatMXN(extrasTotal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatMXN(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA (16%)</span>
              <span className="tabular-nums">{formatMXN(iva)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold text-base">
              <span>Total</span>
              <span className="tabular-nums">{formatMXN(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !canSave}>
            Guardar respuesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
