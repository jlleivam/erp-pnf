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
import { Switch } from "@/components/ui/switch";
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
    const arr = (tercQ.data ?? []) as unknown as Array<{
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
  const [anticipoOn, setAnticipoOn] = useState(false);
  const [anticipoPct, setAnticipoPct] = useState<string>("");
  const [fondoOn, setFondoOn] = useState(false);
  const [fondoPct, setFondoPct] = useState<string>("");

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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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

          <div className="border-t pt-3 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Términos económicos
            </p>

            <div className="flex items-start gap-3">
              <Switch checked={anticipoOn} onCheckedChange={setAnticipoOn} className="mt-1" />
              <div className="flex-1">
                <Label className="text-sm">Requiere anticipo</Label>
                <p className="text-xs text-muted-foreground">
                  Se amortizará proporcionalmente al avance de cada estimación.
                </p>
                {anticipoOn && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      max={100}
                      value={anticipoPct}
                      onChange={(e) => setAnticipoPct(e.target.value)}
                      placeholder="Ej. 20"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">% del contrato</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Switch checked={fondoOn} onCheckedChange={setFondoOn} className="mt-1" />
              <div className="flex-1">
                <Label className="text-sm">Aplicar fondo de garantía</Label>
                <p className="text-xs text-muted-foreground">
                  Se retendrá este % de cada estimación; podrás liberarlo parcialmente.
                </p>
                {fondoOn && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      max={100}
                      value={fondoPct}
                      onChange={(e) => setFondoPct(e.target.value)}
                      placeholder="Ej. 5"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">% por estimación</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              El monto del anticipo se calculará al autorizar el presupuesto base.
            </p>
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
                  anticipoPct: anticipoOn ? Number(anticipoPct || 0) : 0,
                  fondoGarantiaPct: fondoOn ? Number(fondoPct || 0) : 0,
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
