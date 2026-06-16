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
import { formatMXN } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  montoBase?: number;
  disponible?: number;
  onSaved: () => void;
};

export function SolicitarFondoDialog({
  open, onOpenChange, obraId, montoBase, disponible, onSaved,
}: Props) {
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

  const sinTope = montoBase !== undefined && montoBase <= 0;
  const sinDisponible = disponible !== undefined && disponible <= 0;

  function submit() {
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Monto inválido");
    if (disponible !== undefined && n > disponible + 0.01) {
      return toast.error(`El monto excede el disponible (${formatMXN(disponible)})`);
    }
    m.mutate({ data: { obraId, monto: n, notas: notas.trim() || undefined } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar fondo de caja chica</DialogTitle>
          <DialogDescription>
            Tu supervisor autorizará la solicitud antes de que el administrativo realice el pago.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {(montoBase !== undefined || disponible !== undefined) && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              {montoBase !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tope asignado a la obra</span>
                  <span className="font-medium">{formatMXN(montoBase)}</span>
                </div>
              )}
              {disponible !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disponible para solicitar</span>
                  <span className={`font-semibold ${disponible <= 0 ? "text-destructive" : ""}`}>
                    {formatMXN(disponible)}
                  </span>
                </div>
              )}
              {sinTope && (
                <p className="text-xs text-destructive pt-1">
                  El director aún no ha asignado un monto base de caja chica para esta obra.
                </p>
              )}
              {!sinTope && sinDisponible && (
                <p className="text-xs text-destructive pt-1">
                  Ya tienes fondos vivos por el total del tope. Reembolsa antes de solicitar más.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label>Monto solicitado (MXN)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              max={disponible !== undefined ? disponible : undefined}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              disabled={sinTope || sinDisponible}
            />
          </div>
          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending || sinTope || sinDisponible}>
            {m.isPending ? "Enviando…" : "Solicitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
