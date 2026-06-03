import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crearTarea } from "@/lib/api/tareas.functions";
import { listCompanyUsers } from "@/lib/api/obras.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  obraId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAsignado?: string;
}

export function NuevaTareaDialog({ obraId, open, onOpenChange, defaultAsignado }: Props) {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listCompanyUsers);
  const crear = useServerFn(crearTarea);

  const { data: users } = useQuery({
    queryKey: ["company-users"],
    queryFn: () => fetchUsers(),
    enabled: open,
  });

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [asignado, setAsignado] = useState(defaultAsignado ?? "");
  const [fechaLimite, setFechaLimite] = useState("");

  const m = useMutation({
    mutationFn: () =>
      crear({
        data: {
          obraId,
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          asignado_a: asignado,
          fecha_limite: fechaLimite || null,
        },
      }),
    onSuccess: () => {
      toast.success("Tarea creada");
      qc.invalidateQueries({ queryKey: ["tareas-obra", obraId] });
      qc.invalidateQueries({ queryKey: ["mis-tareas-obra", obraId] });
      setTitulo("");
      setDescripcion("");
      setFechaLimite("");
      setAsignado(defaultAsignado ?? "");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al crear"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={255} />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>
          <div>
            <Label>Asignar a *</Label>
            <Select value={asignado} onValueChange={setAsignado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha límite</Label>
            <Input
              type="date"
              value={fechaLimite}
              onChange={(e) => setFechaLimite(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={!titulo.trim() || !asignado || m.isPending}
          >
            {m.isPending ? "Creando…" : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
