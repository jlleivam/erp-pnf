import { useState, useMemo, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { TrabajadorFormDialog } from "@/components/trabajadores/TrabajadorFormDialog";
import { useEffectiveRoles } from "@/stores/auth";

export function NuevoDestajoDialog({
  obraId,
  onClose,
  onCreated,
}: {
  obraId: string;
  onClose: () => void;
  onCreated: (destajoId: string) => void;
}) {
  const roles = useEffectiveRoles();
  const canManage = roles.includes("director") || roles.includes("administrativo");

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
  const [nuevoTrabajadorOpen, setNuevoTrabajadorOpen] = useState(false);
  const [idsPrevios, setIdsPrevios] = useState<Set<string> | null>(null);

  // Detecta un trabajador recién creado y lo pre-selecciona (solo si el usuario puede autorizar altas).
  useEffect(() => {
    const idsActuales = new Set<string>(trabajadores.map((t) => t.id));
    if (idsPrevios === null) {
      setIdsPrevios(idsActuales);
      return;
    }
    if (!canManage) {
      setIdsPrevios(idsActuales);
      return;
    }
    const nuevos = trabajadores.filter((t) => !idsPrevios.has(t.id));
    if (nuevos.length > 0) {
      if (!destajistaId) setDestajistaId(nuevos[0].id);
      setIdsPrevios(idsActuales);
    }
  }, [trabajadores, idsPrevios, canManage, destajistaId]);

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
            <div className="flex items-center gap-2">
              <div className="flex-1">
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
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNuevoTrabajadorOpen(true)}
              >
                <Plus className="size-4 mr-1" />
                {canManage ? "Nuevo" : "Solicitar alta"}
              </Button>
            </div>
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
            disabled={m.isPending || !destajistaId || !nombre.trim()}
            onClick={() =>
              m.mutate({
                data: {
                  obraId,
                  destajistaId,
                  nombre: nombre.trim(),
                  descripcion: descripcion.trim() || undefined,
                  anticipoPct: anticipoOn ? Number(anticipoPct || 0) : 0,
                  fondoGarantiaPct: fondoOn ? Number(fondoPct || 0) : 0,
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
