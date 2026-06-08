import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

const IVA_RATE = 0.16;
const noSpinner =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export function CapturarRespuestaDialog({ solicitud, open, onOpenChange, requisicionId }: Props) {
  const qc = useQueryClient();
  const fn = useServerFn(capturarRespuesta);
  const [items, setItems] = useState<DraftItem[]>([]);

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
  }, [open, solicitud]);

  const { subtotal, iva, total } = useMemo(() => {
    const sub = items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);
    const i = sub * IVA_RATE;
    return { subtotal: sub, iva: i, total: sub + i };
  }, [items]);

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          solicitudId: solicitud.id,
          items: items.map((it) => ({
            insumo_id: it.insumo_id,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            disponible: it.precio_unitario > 0,
            nota: it.nota || null,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Cotización registrada");
      qc.invalidateQueries({ queryKey: ["solicitudes", requisicionId] });
      qc.invalidateQueries({ queryKey: ["requisiciones"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const update = (idx: number, patch: Partial<DraftItem>) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

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

        <div className="max-h-[55vh] overflow-y-auto border rounded-md">
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

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
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
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            Guardar respuesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
