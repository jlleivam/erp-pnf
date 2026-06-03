import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { reponerReembolsoCajaChica } from "@/lib/api/caja-chica.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reembolso: any | null;
  onSaved: () => void;
};

export function ReponerReembolsoDialog({ open, onOpenChange, reembolso, onSaved }: Props) {
  const [monto, setMonto] = useState("");

  useEffect(() => {
    if (reembolso) setMonto(String(reembolso.monto_aprobado ?? ""));
  }, [reembolso]);

  const fn = useServerFn(reponerReembolsoCajaChica);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Reembolso repuesto");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  function submit() {
    if (!reembolso) return;
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Monto inválido");
    m.mutate({ data: { id: reembolso.id, montoReembolsado: n } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reponer efectivo</DialogTitle>
          <DialogDescription>
            Monto aprobado: <strong>{formatMXN(Number(reembolso?.monto_aprobado ?? 0))}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Monto reembolsado (MXN)</Label>
            <Input type="number" min="0" step="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Guardando…" : "Confirmar reposición"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
