import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { rechazarGastoOficina, type GastoOficinaRow } from "@/lib/api/gastos-oficina.functions";

type Props = {
  gasto: GastoOficinaRow | null;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
};

export function RechazarGastoDialog({ gasto, onOpenChange, onDone }: Props) {
  const rechazar = useServerFn(rechazarGastoOficina);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (gasto) setMotivo(""); }, [gasto]);

  const submit = async () => {
    if (!gasto) return;
    if (!motivo.trim() || motivo.trim().length < 2) return toast.error("Indica el motivo");
    setSaving(true);
    try {
      await rechazar({ data: { id: gasto.id, motivo: motivo.trim() } });
      toast.success("Solicitud rechazada");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!gasto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rechazar gasto</DialogTitle>
          <DialogDescription>
            {gasto ? `${gasto.folio} · ${gasto.concepto}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving ? "Rechazando…" : "Rechazar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
