import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { crearValeGasolina } from "@/lib/api/vales-gasolina.functions";
import { listObras } from "@/lib/api/obras.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId?: string | null;
  /** Si true, permite seleccionar obra (vista admin). */
  pickObra?: boolean;
};

export function NuevoValeDialog({ open, onOpenChange, obraId = null, pickObra = false }: Props) {
  const qc = useQueryClient();
  const crear = useServerFn(crearValeGasolina);
  const listObrasFn = useServerFn(listObras);

  const obrasQ = useQuery({
    queryKey: ["obras-for-vale"],
    queryFn: () => listObrasFn({ data: {} as any }).catch(() => []),
    enabled: pickObra && open,
  });

  const [tipo, setTipo] = useState<"magna" | "premium" | "diesel">("magna");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [selObra, setSelObra] = useState<string>(obraId ?? "general");

  const m = useMutation({
    mutationFn: crear,
    onSuccess: (res: any) => {
      toast.success(`Vale ${res.folio} creado`);
      qc.invalidateQueries({ queryKey: ["vales-gasolina"] });
      onOpenChange(false);
      setMonto(""); setDescripcion("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const submit = () => {
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return toast.error("Monto inválido");
    if (descripcion.trim().length < 3) return toast.error("Descripción requerida");
    const targetObra = pickObra ? (selObra === "general" ? null : selObra) : obraId;
    m.mutate({ data: { obraId: targetObra, tipoCombustible: tipo, monto: n, descripcion } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar vale de gasolina</DialogTitle>
          <DialogDescription>
            Captura los datos del vale. Será revisado por un supervisor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {pickObra && (
            <div className="space-y-1">
              <Label>Obra</Label>
              <Select value={selObra} onValueChange={setSelObra}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">— Vale general (sin obra) —</SelectItem>
                  {(obrasQ.data ?? []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Tipo de combustible</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="magna">Magna</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="diesel">Diésel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Monto solicitado (MXN)</Label>
            <Input
              type="number" min="0" step="0.01"
              value={monto} onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label>Descripción del uso</Label>
            <Textarea
              value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              placeholder="¿En qué se usará?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Creando..." : "Solicitar vale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
