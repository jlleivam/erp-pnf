import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { actualizarGastoCajaChica } from "@/lib/api/caja-chica.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { GastoForm, type GastoFormValue } from "./GastoForm";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  gasto: any | null;
  onSaved: () => void;
};

export function EditarGastoDialog({ open, onOpenChange, obraId, gasto, onSaved }: Props) {
  const [v, setV] = useState<GastoFormValue>({
    fecha: "", concepto: "", descripcion: "", monto: "",
    tipoComprobante: "ninguno", evidenciaUrl: null,
  });

  useEffect(() => {
    if (gasto) {
      setV({
        fecha: gasto.fecha,
        concepto: gasto.concepto ?? "",
        descripcion: gasto.descripcion ?? "",
        monto: String(gasto.monto ?? ""),
        tipoComprobante: gasto.tipo_comprobante,
        evidenciaUrl: gasto.evidencia_url ?? null,
      });
    }
  }, [gasto]);

  const upd = useServerFn(actualizarGastoCajaChica);
  const m = useMutation({
    mutationFn: upd,
    onSuccess: () => {
      toast.success("Gasto actualizado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  function submit() {
    if (!gasto) return;
    const monto = Number(v.monto);
    if (!Number.isFinite(monto) || monto <= 0) return toast.error("Monto inválido");
    if (v.concepto.trim().length < 2) return toast.error("Concepto requerido");
    m.mutate({
      data: {
        id: gasto.id, fecha: v.fecha, concepto: v.concepto.trim(),
        descripcion: v.descripcion.trim() || undefined,
        monto, tipoComprobante: v.tipoComprobante,
        evidenciaUrl: v.evidenciaUrl,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar gasto</DialogTitle></DialogHeader>
        <GastoForm value={v} onChange={setV} obraId={obraId} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
