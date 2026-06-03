import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { autorizarValeGasolina, rechazarValeGasolina } from "@/lib/api/vales-gasolina.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vale: { id: string; folio: string; monto_solicitado: number; descripcion: string } | null;
};

export function AutorizarValeDialog({ open, onOpenChange, vale }: Props) {
  const qc = useQueryClient();
  const autorizar = useServerFn(autorizarValeGasolina);
  const rechazar = useServerFn(rechazarValeGasolina);

  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mode, setMode] = useState<"autorizar" | "rechazar">("autorizar");

  const initMonto = vale?.monto_solicitado?.toString() ?? "";

  const autM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => {
      toast.success("Vale autorizado");
      qc.invalidateQueries({ queryKey: ["vales-gasolina"] });
      onOpenChange(false);
      setMonto("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const recM = useMutation({
    mutationFn: rechazar,
    onSuccess: () => {
      toast.success("Vale rechazado");
      qc.invalidateQueries({ queryKey: ["vales-gasolina"] });
      onOpenChange(false);
      setMotivo("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  if (!vale) return null;

  const handle = () => {
    if (mode === "autorizar") {
      const n = Number(monto || initMonto);
      if (!Number.isFinite(n) || n <= 0) return toast.error("Monto inválido");
      autM.mutate({ data: { id: vale.id, montoAutorizado: n } });
    } else {
      if (motivo.trim().length < 3) return toast.error("Motivo requerido");
      recM.mutate({ data: { id: vale.id, motivo } });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revisar vale {vale.folio}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Solicitado: </span>{formatMXN(vale.monto_solicitado)}</div>
            <div className="text-muted-foreground">{vale.descripcion}</div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={mode === "autorizar" ? "default" : "outline"}
              onClick={() => setMode("autorizar")}
              size="sm"
            >Autorizar</Button>
            <Button
              variant={mode === "rechazar" ? "destructive" : "outline"}
              onClick={() => setMode("rechazar")}
              size="sm"
            >Rechazar</Button>
          </div>
          {mode === "autorizar" ? (
            <div className="space-y-1">
              <Label>Monto autorizado (MXN)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={monto || initMonto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Puedes ajustar el monto si lo apruebas por una cantidad distinta a la solicitada.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Motivo de rechazo</Label>
              <Textarea
                value={motivo} onChange={(e) => setMotivo(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handle}
            variant={mode === "rechazar" ? "destructive" : "default"}
            disabled={autM.isPending || recM.isPending}
          >
            {mode === "autorizar" ? "Autorizar" : "Rechazar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
