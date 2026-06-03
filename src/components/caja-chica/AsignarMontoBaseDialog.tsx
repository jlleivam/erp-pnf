import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { setMontoBaseCajaChica } from "@/lib/api/caja-chica.functions";
import { getObraDashboard } from "@/lib/api/obras.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

export function AsignarMontoBaseDialog({ open, onOpenChange, obraId, onSaved }: Props) {
  const fetchObra = useServerFn(getObraDashboard);
  const obraQ = useQuery({
    queryKey: ["obra-dashboard", obraId],
    queryFn: () => fetchObra({ data: { obraId } }),
    enabled: open,
  });

  const [residenteId, setResidenteId] = useState<string>("");
  const [monto, setMonto] = useState("");

  useEffect(() => { if (open) { setResidenteId(""); setMonto(""); } }, [open]);

  const residentes = ((obraQ.data as any)?.team ?? [])
    .filter((m: any) => m.role === "residente" && m.user)
    .map((m: any) => m.user);

  const fn = useServerFn(setMontoBaseCajaChica);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Asignación guardada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  function submit() {
    if (!residenteId) return toast.error("Selecciona un residente");
    const n = Number(monto);
    if (!Number.isFinite(n) || n < 0) return toast.error("Monto inválido");
    m.mutate({ data: { obraId, residenteId, monto: n } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar monto base de caja chica</DialogTitle>
          <DialogDescription>
            Define el techo de caja chica que un residente puede manejar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Residente</Label>
            <Select value={residenteId} onValueChange={setResidenteId}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {residentes.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre_completo || r.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Monto base (MXN)</Label>
            <Input type="number" min="0" step="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
