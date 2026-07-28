import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { solicitarInsumo } from "@/lib/api/insumos.functions";

export function SolicitarInsumoRapidoDialog({
  open, onOpenChange, categorias, unidades, isDirector, onCreated, disponibleRenta,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  categorias: Array<{ id: string; nombre: string }>;
  unidades: Array<{ id: string; codigo: string; nombre?: string }>;
  isDirector: boolean;
  onCreated: (newId?: string) => void;
  disponibleRenta?: boolean;
}) {
  const solicitar = useServerFn(solicitarInsumo);
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<string>("none");

  useEffect(() => {
    if (open) {
      setNombre("");
      setCategoriaId("none");
      setUnidad(unidades[0]?.codigo ?? "");
    }
  }, [open, unidades]);

  const mut = useMutation({
    mutationFn: solicitar,
    onSuccess: (r: any) => {
      toast.success(
        isDirector
          ? "Insumo creado y autorizado."
          : "Solicitud enviada. Un Director revisará tu solicitud.",
      );
      onCreated(isDirector ? r?.id : undefined);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDirector ? "Nuevo insumo" : "Solicitar insumo"}</DialogTitle>
          <DialogDescription>
            {isDirector
              ? "El insumo se creará autorizado y podrás agregarlo al momento."
              : "El Director revisará tu solicitud. Podrás agregar el insumo una vez autorizado."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidad</Label>
              <Select value={unidad} onValueChange={setUnidad}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {unidades.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Sin unidades. Pide al Director crearlas.
                    </div>
                  )}
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.codigo}>
                      {u.codigo}{u.nombre ? ` — ${u.nombre}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!nombre.trim() || !unidad || mut.isPending}
            onClick={() => mut.mutate({ data: {
              nombre: nombre.trim(),
              unidad,
              categoriaId: categoriaId === "none" ? null : categoriaId,
              disponibleRenta: disponibleRenta ?? false,
            } })}
          >
            {isDirector ? "Crear" : "Solicitar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
