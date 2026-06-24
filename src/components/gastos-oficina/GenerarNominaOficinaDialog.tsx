import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { generarNominaOficinaDelPeriodo } from "@/lib/api/gastos-oficina.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onGenerated: () => void;
};

export function GenerarNominaOficinaDialog({ open, onOpenChange, onGenerated }: Props) {
  const generar = useServerFn(generarNominaOficinaDelPeriodo);
  const [periodicidad, setPeriodicidad] = useState<"semanal" | "quincenal" | "mensual">("quincenal");
  const [inicio, setInicio] = useState<string>("");
  const [fin, setFin] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!inicio || !fin) return toast.error("Indica las fechas del periodo");
    if (fin < inicio) return toast.error("La fecha final debe ser posterior");
    setSaving(true);
    try {
      const res = await generar({
        data: { periodicidad, periodoInicio: inicio, periodoFin: fin },
      });
      toast.success(`Generados ${res.creados} de ${res.total} (omitidos: ${res.omitidos})`);
      onGenerated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generar nómina del periodo</DialogTitle>
          <DialogDescription>
            Crea una solicitud por cada trabajador de oficina con la periodicidad seleccionada.
            Los duplicados del mismo periodo se omiten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Periodicidad</Label>
            <Select value={periodicidad} onValueChange={(v) => setPeriodicidad(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="quincenal">Quincenal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inicio</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <Label>Fin</Label>
              <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Generando…" : "Generar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
