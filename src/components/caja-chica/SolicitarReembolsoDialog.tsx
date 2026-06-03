import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { solicitarReembolsoCajaChica } from "@/lib/api/caja-chica.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatMXN, formatDate } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  gastos: any[];
  onSaved: () => void;
};

export function SolicitarReembolsoDialog({ open, onOpenChange, obraId, gastos, onSaved }: Props) {
  const total = useMemo(
    () => gastos.reduce((a, g) => a + Number(g.monto), 0),
    [gastos]
  );
  const fechas = gastos.map((g) => g.fecha).filter(Boolean).sort();
  const [ini, setIni] = useState("");
  const [fin, setFin] = useState("");

  useEffect(() => {
    if (open) {
      setIni(fechas[0] ?? new Date().toISOString().slice(0, 10));
      setFin(fechas[fechas.length - 1] ?? new Date().toISOString().slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fn = useServerFn(solicitarReembolsoCajaChica);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: (r: any) => {
      toast.success(`Reembolso ${r.folio} solicitado`);
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  function submit() {
    if (gastos.length === 0) return toast.error("Selecciona al menos un gasto");
    if (!ini || !fin) return toast.error("Define el rango");
    m.mutate({
      data: {
        obraId, semanaInicio: ini, semanaFin: fin,
        gastoIds: gastos.map((g) => g.id),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar reembolso</DialogTitle>
          <DialogDescription>
            Se enviará al supervisor para revisión gasto por gasto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Semana inicio</Label>
              <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Semana fin</Label>
              <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
          </div>
          <div className="border rounded-md max-h-60 overflow-y-auto divide-y">
            {gastos.map((g) => (
              <div key={g.id} className="p-2 text-sm flex justify-between gap-2">
                <span className="truncate">
                  {formatDate(g.fecha)} · {g.concepto}
                </span>
                <span className="font-medium">{formatMXN(Number(g.monto))}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-semibold pt-2 border-t">
            <span>Total</span>
            <span>{formatMXN(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Enviando…" : "Solicitar reembolso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
