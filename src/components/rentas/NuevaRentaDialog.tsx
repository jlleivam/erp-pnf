import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackagePlus } from "lucide-react";
import { crearSolicitudRenta } from "@/lib/api/rentas.functions";
import { listInsumos, listCategorias, listUnidades } from "@/lib/api/insumos.functions";
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
import { SolicitarInsumoRapidoDialog } from "@/components/insumos/SolicitarInsumoRapidoDialog";
import { useEffectiveRoles, isDirector as checkDirector } from "@/stores/auth";


export function NuevaRentaDialog({
  obraId,
  onClose,
  onCreated,
}: {
  obraId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [insumoId, setInsumoId] = useState<string>("");
  const [cantidad, setCantidad] = useState("1");
  const [descripcion, setDescripcion] = useState("");
  const [fechaEstimada, setFechaEstimada] = useState("");
  const [periodicidad, setPeriodicidad] = useState<string>("");
  const [periodos, setPeriodos] = useState("");
  const [diasAviso, setDiasAviso] = useState("3");

  const periodoLabel =
    periodicidad === "diaria" ? "días"
    : periodicidad === "semanal" ? "semanas"
    : periodicidad === "quincenal" ? "quincenas"
    : periodicidad === "mensual" ? "meses"
    : "periodos";

  const qc = useQueryClient();
  const listFn = useServerFn(listInsumos);
  const insumosQ = useQuery({
    queryKey: ["insumos-renta"],
    queryFn: () => listFn({ data: { estatus: "autorizado", soloRenta: true } }),
  });
  const insumos = useMemo(
    () => (insumosQ.data ?? []).slice().sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)),
    [insumosQ.data],
  );

  const fetchCategorias = useServerFn(listCategorias);
  const categoriasQ = useQuery({ queryKey: ["insumo-categorias"], queryFn: () => fetchCategorias() });
  const categorias = (categoriasQ.data ?? []) as Array<{ id: string; nombre: string }>;
  const fetchUnidades = useServerFn(listUnidades);
  const unidadesQ = useQuery({ queryKey: ["insumo-unidades"], queryFn: () => fetchUnidades() });
  const unidades = (unidadesQ.data ?? []) as Array<{ id: string; codigo: string; nombre?: string }>;

  const roles = useEffectiveRoles();
  const isDirector = checkDirector(roles);
  const [solicitarOpen, setSolicitarOpen] = useState(false);


  const crear = useServerFn(crearSolicitudRenta);
  const m = useMutation({
    mutationFn: crear,
    onSuccess: (res) => {
      toast.success("Solicitud creada");
      onCreated(res.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sinInsumos = !insumosQ.isLoading && insumos.length === 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva solicitud de renta</DialogTitle>
          <DialogDescription>
            Selecciona un equipo del catálogo. El administrativo cotizará y el supervisor
            autorizará antes de comenzar la renta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <Label>Equipo</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSolicitarOpen(true)}
              >
                <PackagePlus className="size-3.5 mr-1" />
                {isDirector ? "Nuevo insumo" : "Solicitar insumo"}
              </Button>
            </div>

            <Select value={insumoId} onValueChange={setInsumoId} disabled={sinInsumos}>
              <SelectTrigger>
                <SelectValue placeholder={
                  insumosQ.isLoading
                    ? "Cargando…"
                    : sinInsumos
                      ? "Sin equipos disponibles para renta"
                      : "Selecciona un equipo del catálogo"
                } />
              </SelectTrigger>
              <SelectContent>
                {insumos.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.codigo ? `${i.codigo} — ` : ""}{i.nombre} ({i.unidad})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sinInsumos && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Pídele al Director que marque insumos como "Disponible para rentas" en el catálogo.
              </p>
            )}
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
              <Label>Cantidad de periodos a ocupar</Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={periodos}
                  disabled={!periodicidad}
                  placeholder={periodicidad ? `Ej. 3 ${periodoLabel}` : "Elige periodicidad"}
                  onChange={(e) => setPeriodos(e.target.value)}
                />
              </div>
              {periodicidad && periodos && Number(periodos) > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  ≈ {periodos} {periodoLabel}
                </p>
              )}
            </div>
            <div>
              <Label>Fecha estimada de inicio</Label>
              <Input
                type="date"
                value={fechaEstimada}
                onChange={(e) => setFechaEstimada(e.target.value)}
              />
            </div>
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
            disabled={m.isPending || !insumoId || Number(cantidad) <= 0}
            onClick={() =>
              m.mutate({
                data: {
                  obraId,
                  insumoId,
                  cantidad: Number(cantidad),
                  descripcion: descripcion.trim() || undefined,
                  fechaEstimadaInicio: fechaEstimada || undefined,
                  periodicidadSugerida: (periodicidad || undefined) as any,
                  periodosEstimados: periodos && Number(periodos) > 0 ? Number(periodos) : undefined,
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
