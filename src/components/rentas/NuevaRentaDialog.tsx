import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { crearSolicitudRenta } from "@/lib/api/rentas.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function NuevaRentaDialog({
  obraId,
  onClose,
  onCreated,
}: {
  obraId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [equipo, setEquipo] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [descripcion, setDescripcion] = useState("");
  const [fechaEstimada, setFechaEstimada] = useState("");
  const [periodicidad, setPeriodicidad] = useState<string>("");
  const [diasAviso, setDiasAviso] = useState("3");

  const crear = useServerFn(crearSolicitudRenta);
  const m = useMutation({
    mutationFn: crear,
    onSuccess: (res) => {
      toast.success("Solicitud creada");
      onCreated(res.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva solicitud de renta</DialogTitle>
          <DialogDescription>
            Captura el equipo que necesitas. El administrativo cotizará y el supervisor
            autorizará antes de comenzar la renta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Equipo</Label>
            <Input
              value={equipo}
              onChange={(e) => setEquipo(e.target.value)}
              placeholder="Ej. Andamio multidireccional, revolvedora 1 saco…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div>
              <Label>Periodicidad sugerida</Label>
              <Select value={periodicidad} onValueChange={setPeriodicidad}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diaria</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha estimada de inicio</Label>
              <Input
                type="date"
                value={fechaEstimada}
                onChange={(e) => setFechaEstimada(e.target.value)}
              />
            </div>
            <div>
              <Label>Días de aviso antes de vencer</Label>
              <Input
                type="number"
                min="0"
                max="60"
                value={diasAviso}
                onChange={(e) => setDiasAviso(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Notas (opcional)</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles, marca/modelo preferido, condiciones…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending || !equipo.trim() || Number(cantidad) <= 0}
            onClick={() =>
              m.mutate({
                data: {
                  obraId,
                  equipo: equipo.trim(),
                  cantidad: Number(cantidad),
                  descripcion: descripcion.trim() || undefined,
                  fechaEstimadaInicio: fechaEstimada || undefined,
                  periodicidadSugerida: (periodicidad || undefined) as any,
                  diasAvisoVencimiento: Number(diasAviso) || 3,
                },
              })
            }
          >
            {m.isPending ? "Creando…" : "Crear solicitud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
