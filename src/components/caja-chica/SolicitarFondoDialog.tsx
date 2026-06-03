import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { solicitarFondoCajaChica } from "@/lib/api/caja-chica.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  onSaved: () => void;
};

export function SolicitarFondoDialog({ open, onOpenChange, obraId, onSaved }: Props) {
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => { if (open) { setMonto(""); setNotas(""); } }, [open]);

  const fn = useServerFn(solicitarFondoCajaChica);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Solicitud enviada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  function submit() {
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Monto inválido");
    m.mutate({ data: { obraId, monto: n, notas: notas.trim() || undefined } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar fondo de caja chica</DialogTitle>
          <DialogDescription>
            El administrativo confirmará la entrega del efectivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Monto solicitado (MXN)</Label>
            <Input type="number" min="0" step="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Enviando…" : "Solicitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
