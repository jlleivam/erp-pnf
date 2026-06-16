import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { marcarLlegada } from "@/lib/api/rentas.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DIAS_POR_PERIODO: Record<string, number> = {
  diaria: 1, semanal: 7, quincenal: 15, mensual: 30,
};

function calcFin(llegada: string, periodicidad: string | null, periodos: number | null): string {
  if (!llegada || !periodicidad || !periodos) return "";
  const dpp = DIAS_POR_PERIODO[periodicidad];
  if (!dpp) return "";
  const d = new Date(llegada + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + Math.round(periodos * dpp) - 1);
  return d.toISOString().slice(0, 10);
}

export function MarcarLlegadaDialog({
  rentaId, periodicidad, periodosEstimados, onClose, onSaved,
}: {
  rentaId: string;
  periodicidad: string | null;
  periodosEstimados: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [llegada, setLlegada] = useState(hoy);
  const [fin, setFin] = useState(() => calcFin(hoy, periodicidad, periodosEstimados));
  const [finTouched, setFinTouched] = useState(false);

  useEffect(() => {
    if (finTouched) return;
    setFin(calcFin(llegada, periodicidad, periodosEstimados));
  }, [llegada, periodicidad, periodosEstimados, finTouched]);

  const autocalculado = !finTouched && !!fin && !!periodicidad && !!periodosEstimados;

  const fn = useServerFn(marcarLlegada);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => { toast.success("Llegada registrada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar llegada del equipo</DialogTitle>
          <DialogDescription>
            Desde la fecha de llegada empieza a contar la renta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Fecha de llegada</Label>
            <Input type="date" value={llegada} onChange={(e) => setLlegada(e.target.value)} />
          </div>
          <div>
            <Label>Fecha fin programada</Label>
            <Input
              type="date"
              value={fin}
              onChange={(e) => { setFin(e.target.value); setFinTouched(true); }}
            />
            {autocalculado && (
              <p className="text-xs text-muted-foreground mt-1">
                Calculado a partir de la solicitud · podés ajustarlo.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending || !llegada || !fin || fin <= llegada}
            onClick={() => m.mutate({ data: { id: rentaId, fechaLlegada: llegada, fechaFinProgramada: fin } })}
          >
            {m.isPending ? "Guardando…" : "Marcar llegada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
