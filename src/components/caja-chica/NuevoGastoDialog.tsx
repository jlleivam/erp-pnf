import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { crearGastoCajaChica } from "@/lib/api/caja-chica.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { GastoForm, emptyGasto, type GastoFormValue } from "./GastoForm";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  onSaved: () => void;
};

export function NuevoGastoDialog({ open, onOpenChange, obraId, onSaved }: Props) {
  const [v, setV] = useState<GastoFormValue>(emptyGasto());

  useEffect(() => { if (open) setV(emptyGasto()); }, [open]);

  const crear = useServerFn(crearGastoCajaChica);
  const m = useMutation({
    mutationFn: crear,
    onSuccess: () => {
      toast.success("Gasto guardado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  function submit() {
    const monto = Number(v.monto);
    if (!Number.isFinite(monto) || monto <= 0) return toast.error("Monto inválido");
    if (v.concepto.trim().length < 2) return toast.error("Concepto requerido");
    m.mutate({
      data: {
        obraId, fecha: v.fecha, concepto: v.concepto.trim(),
        descripcion: v.descripcion.trim() || undefined,
        monto, tipoComprobante: v.tipoComprobante,
        evidenciaUrl: v.evidenciaUrl,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo gasto de caja chica</DialogTitle></DialogHeader>
        <GastoForm value={v} onChange={setV} obraId={obraId} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Guardando…" : "Guardar borrador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
