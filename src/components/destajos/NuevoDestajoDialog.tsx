import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { crearDestajo } from "@/lib/api/destajos.functions";
import { listTrabajadores } from "@/lib/api/trabajadores.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function NuevoDestajoDialog({
  obraId,
  onClose,
  onCreated,
}: {
  obraId: string;
  onClose: () => void;
  onCreated: (destajoId: string) => void;
}) {
  const fetchTrabs = useServerFn(listTrabajadores);
  const trabsQ = useQuery({
    queryKey: ["trabajadores-lista"],
    queryFn: () => fetchTrabs({ data: {} }),
  });

  const trabajadores = useMemo(() => {
    const arr = (trabsQ.data ?? []) as Array<{
      id: string;
      nombre_completo: string;
      puesto: string | null;
      estatus_autorizacion: string;
    }>;
    return arr.filter((t) => t.estatus_autorizacion === "autorizado");
  }, [trabsQ.data]);

  const [destajistaId, setDestajistaId] = useState<string>("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [anticipoOn, setAnticipoOn] = useState(false);
  const [anticipoPct, setAnticipoPct] = useState<string>("");
  const [fondoOn, setFondoOn] = useState(false);
  const [fondoPct, setFondoPct] = useState<string>("");

  const crear = useServerFn(crearDestajo);
  const m = useMutation({
    mutationFn: crear,
    onSuccess: (res) => {
      toast.success("Destajo creado");
      onCreated(res.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo destajo</DialogTitle>
          <DialogDescription>
            Crea el destajo y captura su presupuesto. Quedará en borrador hasta que el
            supervisor lo autorice.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Destajista</Label>
            <Select value={destajistaId} onValueChange={setDestajistaId}>
              <SelectTrigger>
                <SelectValue placeholder={trabsQ.isLoading ? "Cargando…" : "Selecciona un trabajador"} />
              </SelectTrigger>
              <SelectContent>
                {trabajadores.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre_completo}
                    {t.puesto ? ` · ${t.puesto}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {trabajadores.length === 0 && !trabsQ.isLoading && (
              <p className="text-xs text-muted-foreground mt-1">
                No hay trabajadores autorizados disponibles.
              </p>
            )}
          </div>
          <div>
            <Label>Nombre del destajo</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Albañilería planta baja"
            />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Alcance general del destajo…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={m.isPending || !destajistaId || !nombre.trim()}
            onClick={() =>
              m.mutate({
                data: {
                  obraId,
                  destajistaId,
                  nombre: nombre.trim(),
                  descripcion: descripcion.trim() || undefined,
                },
              })
            }
          >
            {m.isPending ? "Creando…" : "Crear destajo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
