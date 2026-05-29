import { useEffect, useState } from "react";
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
          <DialogTitle>Capturar cotización · {solicitud.folio}</DialogTitle>
          <DialogDescription>
            Captura el precio que respondió {solicitud.proveedor?.razon_social ?? "el proveedor"} para cada insumo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="w-28">Cantidad</TableHead>
                <TableHead className="w-32">P. Unitario</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
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
                      value={it.cantidad || ""}
                      onChange={(e) => update(idx, { cantidad: Number(e.target.value) || 0 })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.precio_unitario || ""}
                      onChange={(e) => update(idx, { precio_unitario: Number(e.target.value) || 0 })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={it.nota}
                      placeholder="—"
                      onChange={(e) => update(idx, { nota: e.target.value })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
