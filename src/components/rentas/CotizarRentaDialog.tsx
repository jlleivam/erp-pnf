import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { cotizarRenta } from "@/lib/api/rentas.functions";
import { listTerceros } from "@/lib/api/terceros.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function CotizarRentaDialog({
  rentaId,
  initialProveedorId,
  initialPeriodicidad,
  initialTarifa,
  initialDeposito,
  initialCondiciones,
  onClose,
  onSaved,
}: {
  rentaId: string;
  initialProveedorId?: string | null;
  initialPeriodicidad?: string | null;
  initialTarifa?: number | null;
  initialDeposito?: number | null;
  initialCondiciones?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fetchTerc = useServerFn(listTerceros);
  const tercQ = useQuery({
    queryKey: ["terceros-proveedores"],
    queryFn: () => fetchTerc({ data: {} }),
  });
  const proveedores = useMemo(() => {
    const arr = (tercQ.data ?? []) as unknown as Array<{
      id: string; razon_social: string; rfc: string; categoria: string;
    }>;
    return arr.filter((t) => t.categoria === "proveedor" || t.categoria === "ambos");
  }, [tercQ.data]);

  const [proveedorId, setProveedorId] = useState(initialProveedorId ?? "");
  const [periodicidad, setPeriodicidad] = useState(initialPeriodicidad ?? "");
  const [tarifa, setTarifa] = useState(String(initialTarifa ?? ""));
  const [deposito, setDeposito] = useState(String(initialDeposito ?? "0"));
  const [condiciones, setCondiciones] = useState(initialCondiciones ?? "");

  const cot = useServerFn(cotizarRenta);
  const m = useMutation({
    mutationFn: cot,
    onSuccess: () => { toast.success("Cotización guardada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cotizar renta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Proveedor</Label>
            <Select value={proveedorId} onValueChange={setProveedorId}>
              <SelectTrigger>
                <SelectValue placeholder={tercQ.isLoading ? "Cargando…" : "Selecciona un proveedor"} />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.razon_social} · {t.rfc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {proveedores.length === 0 && !tercQ.isLoading && (
              <p className="text-xs text-muted-foreground mt-1">
                No hay proveedores en el catálogo. Agrega uno con categoría "proveedor" o "ambos".
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Periodicidad</Label>
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
            <div>
              <Label>Tarifa por periodo (por unidad)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={tarifa}
                onChange={(e) => setTarifa(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Depósito en garantía</Label>
            <Input
              type="number" min="0" step="0.01"
              value={deposito}
              onChange={(e) => setDeposito(e.target.value)}
            />
          </div>
          <div>
            <Label>Condiciones (opcional)</Label>
            <Textarea
              value={condiciones}
              onChange={(e) => setCondiciones(e.target.value)}
              placeholder="Forma de pago, traslado, penalizaciones, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={
              m.isPending ||
              !proveedorId ||
              !periodicidad ||
              Number(tarifa) < 0 ||
              tarifa === ""
            }
            onClick={() =>
              m.mutate({
                data: {
                  id: rentaId,
                  proveedorId,
                  periodicidad: periodicidad as any,
                  tarifaUnitaria: Number(tarifa),
                  deposito: Number(deposito) || 0,
                  condiciones: condiciones.trim() || undefined,
                },
              })
            }
          >
            {m.isPending ? "Guardando…" : "Guardar cotización"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
