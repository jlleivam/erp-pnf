import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { registrarPago } from "@/lib/api/rentas.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function RegistrarPagoDialog({
  rentaId, onClose, onSaved,
}: { rentaId: string; onClose: () => void; onSaved: () => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [monto, setMonto] = useState("");
  const [referencia, setReferencia] = useState("");
  const [pagadoAt, setPagadoAt] = useState(hoy);
  const [notas, setNotas] = useState("");

  const fn = useServerFn(registrarPago);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => { toast.success("Pago registrado"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periodo desde</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <Label>Periodo hasta</Label>
              <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto</Label>
              <Input type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div>
              <Label>Pagado el</Label>
              <Input type="date" value={pagadoAt} onChange={(e) => setPagadoAt(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Referencia / folio (opcional)</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
          <div>
            <Label>Notas (opcional)</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending || !inicio || !fin || fin < inicio || !monto || Number(monto) < 0}
            onClick={() =>
              m.mutate({
                data: {
                  rentaId,
                  periodoInicio: inicio,
                  periodoFin: fin,
                  monto: Number(monto),
                  referencia: referencia.trim() || undefined,
                  pagadoAt,
                  notas: notas.trim() || undefined,
                },
              })
            }
          >
            {m.isPending ? "Guardando…" : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
