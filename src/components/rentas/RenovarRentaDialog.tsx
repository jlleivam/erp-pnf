import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { solicitarRenovacion } from "@/lib/api/rentas.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function RenovarRentaDialog({
  rentaId, fechaFinActual, tarifaActual, onClose, onSaved,
}: {
  rentaId: string;
  fechaFinActual: string;
  tarifaActual: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fechaFinNueva, setFechaFinNueva] = useState("");
  const [tarifa, setTarifa] = useState("");
  const [motivo, setMotivo] = useState("");

  const fn = useServerFn(solicitarRenovacion);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => { toast.success("Renovación solicitada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar renovación</DialogTitle>
          <DialogDescription>
            Extiende la fecha fin de la renta. Requiere autorización del supervisor.
            Fecha fin actual: <strong>{fechaFinActual}</strong>. Tarifa actual: <strong>${tarifaActual}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nueva fecha fin</Label>
            <Input
              type="date"
              min={fechaFinActual}
              value={fechaFinNueva}
              onChange={(e) => setFechaFinNueva(e.target.value)}
            />
          </div>
          <div>
            <Label>Tarifa nueva (opcional, si cambia)</Label>
            <Input
              type="number" min="0" step="0.01"
              value={tarifa}
              onChange={(e) => setTarifa(e.target.value)}
              placeholder={`Dejar vacío para mantener ${tarifaActual}`}
            />
          </div>
          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending || !fechaFinNueva || fechaFinNueva <= fechaFinActual}
            onClick={() =>
              m.mutate({
                data: {
                  rentaId,
                  fechaFinNueva,
                  tarifaNueva: tarifa ? Number(tarifa) : undefined,
                  motivo: motivo.trim() || undefined,
                },
              })
            }
          >
            {m.isPending ? "Enviando…" : "Solicitar renovación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
