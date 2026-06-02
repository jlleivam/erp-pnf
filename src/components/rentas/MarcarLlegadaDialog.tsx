import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { marcarLlegada } from "@/lib/api/rentas.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function MarcarLlegadaDialog({
  rentaId, onClose, onSaved,
}: { rentaId: string; onClose: () => void; onSaved: () => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [llegada, setLlegada] = useState(hoy);
  const [fin, setFin] = useState("");

  const fn = useServerFn(marcarLlegada);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => { toast.success("Llegada registrada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar llegada del equipo</DialogTitle>
          <DialogDescription>
            Desde la fecha de llegada empieza a contar la renta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Fecha de llegada</Label>
            <Input type="date" value={llegada} onChange={(e) => setLlegada(e.target.value)} />
          </div>
          <div>
            <Label>Fecha fin programada</Label>
            <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending || !llegada || !fin || fin <= llegada}
            onClick={() => m.mutate({ data: { id: rentaId, fechaLlegada: llegada, fechaFinProgramada: fin } })}
          >
            {m.isPending ? "Guardando…" : "Marcar llegada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
