import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { crearGastoOficina } from "@/lib/api/gastos-oficina.functions";
import { listProveedores } from "@/lib/api/cotizaciones.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
};

export function NuevoGastoOficinaDialog({ open, onOpenChange, onCreated }: Props) {
  const crear = useServerFn(crearGastoOficina);
  const fetchProveedores = useServerFn(listProveedores);
  const provQ = useQuery({
    queryKey: ["proveedores-cot"],
    queryFn: () => fetchProveedores(),
    enabled: open,
  });

  const [tipo, setTipo] = useState<"servicio" | "papeleria" | "otro">("servicio");
  const [concepto, setConcepto] = useState("");
  const [proveedorId, setProveedorId] = useState<string>("");
  const [monto, setMonto] = useState<string>("");
  const [fechaGasto, setFechaGasto] = useState<string>(new Date().toISOString().slice(0, 10));
  const [fechaPago, setFechaPago] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTipo("servicio");
    setConcepto("");
    setProveedorId("");
    setMonto("");
    setFechaGasto(new Date().toISOString().slice(0, 10));
    setFechaPago("");
    setNotas("");
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const submit = async () => {
    const m = Number(monto);
    if (!concepto.trim()) return toast.error("Captura un concepto");
    if (!m || m <= 0) return toast.error("Monto inválido");
    if (!proveedorId) return toast.error("Selecciona un proveedor");
    setSaving(true);
    try {
      await crear({
        data: {
          tipo,
          concepto: concepto.trim(),
          proveedorId,
          monto: m,
          fechaGasto,
          fechaRequeridaPago: fechaPago || null,
          notas: notas.trim() || null,
        },
      });
      toast.success("Solicitud creada · pendiente de aprobación");
      onCreated();
      handleClose(false);
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo gasto de oficina</DialogTitle>
          <DialogDescription>
            Queda como pendiente de aprobación. Tras aprobarse pasa a cuentas por pagar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="servicio">Servicio (luz, agua, internet, renta…)</SelectItem>
                  <SelectItem value="papeleria">Papelería</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <Label>Concepto</Label>
            <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. CFE recibo abril 2026" />
          </div>
          <div>
            <Label>Proveedor</Label>
            <Select value={proveedorId} onValueChange={setProveedorId}>
              <SelectTrigger>
                <SelectValue placeholder={provQ.isLoading ? "Cargando…" : "Selecciona proveedor"} />
              </SelectTrigger>
              <SelectContent>
                {(provQ.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.razon_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha del gasto</Label>
              <Input type="date" value={fechaGasto} onChange={(e) => setFechaGasto(e.target.value)} />
            </div>
            <div>
              <Label>Fecha requerida de pago</Label>
              <Input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Solicitar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
