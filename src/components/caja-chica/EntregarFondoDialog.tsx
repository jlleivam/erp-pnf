import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { entregarFondoCajaChica } from "@/lib/api/caja-chica.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fondo: any | null;
  onSaved: () => void;
};

export function EntregarFondoDialog({ open, onOpenChange, fondo, onSaved }: Props) {
  const [monto, setMonto] = useState("");

  useEffect(() => {
    if (fondo) setMonto(String(fondo.monto_solicitado ?? ""));
  }, [fondo]);

  const fn = useServerFn(entregarFondoCajaChica);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Entrega confirmada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  function submit() {
    if (!fondo) return;
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Monto inválido");
    m.mutate({ data: { id: fondo.id, montoEntregado: n } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirmar entrega de fondo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Monto entregado (MXN)</Label>
            <Input type="number" min="0" step="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Guardando…" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
