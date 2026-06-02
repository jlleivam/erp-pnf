import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { crearSubcontrato } from "@/lib/api/subcontratos.functions";
import { listTerceros } from "@/lib/api/terceros.functions";
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
import { toast } from "sonner";

export function NuevoSubcontratoDialog({
  obraId,
  onClose,
  onCreated,
}: {
  obraId: string;
  onClose: () => void;
  onCreated: (subcontratoId: string) => void;
}) {
  const fetchTerc = useServerFn(listTerceros);
  const tercQ = useQuery({
    queryKey: ["terceros-contratistas"],
    queryFn: () => fetchTerc({ data: {} }),
  });

  const contratistas = useMemo(() => {
    const arr = (tercQ.data ?? []) as Array<{
      id: string;
      razon_social: string;
      rfc: string;
      categoria: string;
    }>;
    return arr.filter((t) => t.categoria === "contratista" || t.categoria === "ambos");
  }, [tercQ.data]);

  const [contratistaId, setContratistaId] = useState<string>("");
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const crear = useServerFn(crearSubcontrato);
  const m = useMutation({
    mutationFn: crear,
    onSuccess: (res) => {
      toast.success("Subcontrato creado");
      onCreated(res.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo subcontrato</DialogTitle>
          <DialogDescription>
            Crea el subcontrato y captura su presupuesto. Quedará en borrador hasta que
            el supervisor lo autorice.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Contratista</Label>
            <Select value={contratistaId} onValueChange={setContratistaId}>
              <SelectTrigger>
                <SelectValue placeholder={tercQ.isLoading ? "Cargando…" : "Selecciona un contratista"} />
              </SelectTrigger>
              <SelectContent>
                {contratistas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.razon_social} · {t.rfc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contratistas.length === 0 && !tercQ.isLoading && (
              <p className="text-xs text-muted-foreground mt-1">
                No hay contratistas en el catálogo de terceros. Agrega uno con categoría
                "contratista" o "ambos".
              </p>
            )}
          </div>
          <div>
            <Label>Nombre del subcontrato</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Instalación eléctrica nivel 1"
            />
          </div>
          <div>
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Alcance general del subcontrato…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={m.isPending || !contratistaId || !nombre.trim()}
            onClick={() =>
              m.mutate({
                data: {
                  obraId,
                  contratistaId,
                  nombre: nombre.trim(),
                  descripcion: descripcion.trim() || undefined,
                },
              })
            }
          >
            {m.isPending ? "Creando…" : "Crear subcontrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
