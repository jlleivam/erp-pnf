import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { marcarDevolucion } from "@/lib/api/rentas.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function DevolverRentaDialog({
  rentaId, onClose, onSaved,
}: { rentaId: string; onClose: () => void; onSaved: () => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);

  const fn = useServerFn(marcarDevolucion);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => { toast.success("Devolución registrada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar devolución</DialogTitle>
          <DialogDescription>
            Captura la fecha real de devolución. El cobro acumulado queda congelado.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label>Fecha de devolución</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending || !fecha}
            onClick={() => m.mutate({ data: { id: rentaId, fechaDevolucion: fecha } })}
          >
            {m.isPending ? "Guardando…" : "Marcar devolución"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
