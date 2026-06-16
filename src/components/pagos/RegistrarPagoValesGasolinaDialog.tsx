import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { listCuentas } from "@/lib/api/cuentas.functions";
import { pagarValesGasolina } from "@/lib/api/vales-gasolina.functions";
import { formatMXN } from "@/lib/format";

type Cuenta = {
  id: string;
  nombre: string;
  tipo: "bancaria" | "caja_fuerte";
  banco: string | null;
  saldo_actual: number;
  activa: boolean;
};

type Metodo = "efectivo" | "transferencia" | "cheque";

export type ValeSeleccionado = {
  id: string;
  folio: string;
  obra_nombre: string | null;
  saldo: number;
};

interface Props {
  vales: ValeSeleccionado[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

export function RegistrarPagoValesGasolinaDialog({ vales, open, onOpenChange, onSaved }: Props) {
  const hoy = new Date().toISOString().slice(0, 10);
  const fetchCuentas = useServerFn(listCuentas);
  const pagarFn = useServerFn(pagarValesGasolina);

  const cuentasQ = useQuery({
    queryKey: ["cuentas-activas"],
    queryFn: () => fetchCuentas(),
    enabled: open,
  });

  const cuentas: Cuenta[] = useMemo(
    () => ((cuentasQ.data ?? []) as unknown as Cuenta[]).filter((c) => c.activa),
    [cuentasQ.data],
  );

  const [cuentaId, setCuentaId] = useState<string>("");
  const [metodo, setMetodo] = useState<Metodo>("transferencia");
  const [fecha, setFecha] = useState<string>(hoy);
  const [referencia, setReferencia] = useState<string>("");
  const [notas, setNotas] = useState<string>("");

  const cuentaSel = cuentas.find((c) => c.id === cuentaId);
  const total = useMemo(() => +vales.reduce((s, v) => s + v.saldo, 0).toFixed(2), [vales]);
  const excedeCuenta = cuentaSel ? total > Number(cuentaSel.saldo_actual) + 0.001 : false;

  const handleCuentaChange = (id: string) => {
    setCuentaId(id);
    const c = cuentas.find((x) => x.id === id);
    if (c?.tipo === "caja_fuerte") setMetodo("efectivo");
    else if (c?.tipo === "bancaria" && metodo === "efectivo") setMetodo("transferencia");
  };

  const m = useMutation({
    mutationFn: () => pagarFn({
      data: {
        valeIds: vales.map((v) => v.id),
        cuentaId,
        metodo,
        fecha,
        referencia: referencia.trim() || undefined,
        notas: notas.trim() || undefined,
      },
    }),
    onSuccess: (r: any) => {
      toast.success(`Pago registrado: ${r.count} vales · ${formatMXN(r.total)}`);
      onSaved?.();
      onOpenChange(false);
      setCuentaId(""); setReferencia(""); setNotas(""); setFecha(hoy);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabled = !cuentaId || excedeCuenta || !fecha || vales.length === 0;

  const refLabel = metodo === "cheque" ? "# Cheque"
    : metodo === "transferencia" ? "# Referencia / folio"
    : "Referencia (opcional)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Pago de vales de gasolina</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 max-h-48 overflow-y-auto">
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              {vales.length} vale{vales.length === 1 ? "" : "s"} seleccionado{vales.length === 1 ? "" : "s"}
            </div>
            <div className="space-y-1">
              {vales.map((v) => (
                <div key={v.id} className="flex justify-between text-sm">
                  <span>
                    <span className="font-medium">{v.folio}</span>
                    {v.obra_nombre && <span className="text-muted-foreground"> · {v.obra_nombre}</span>}
                  </span>
                  <span>{formatMXN(v.saldo)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-semibold text-base mt-2 pt-2 border-t">
              <span>Total</span>
              <span>{formatMXN(total)}</span>
            </div>
          </div>

          <div>
            <Label>Cuenta</Label>
            <Select value={cuentaId} onValueChange={handleCuentaChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una cuenta…" />
              </SelectTrigger>
              <SelectContent>
                {cuentas.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay cuentas activas</div>
                )}
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} · {c.tipo === "bancaria" ? (c.banco ?? "Banco") : "Caja fuerte"} · {formatMXN(Number(c.saldo_actual))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cuentaSel && excedeCuenta && (
              <p className="text-xs text-rose-600 mt-1">
                El total excede el saldo disponible ({formatMXN(Number(cuentaSel.saldo_actual))})
              </p>
            )}
          </div>

          {cuentaSel && (
            <div>
              <Label>Método de pago</Label>
              <RadioGroup
                value={metodo}
                onValueChange={(v) => setMetodo(v as Metodo)}
                className="flex gap-4 mt-2"
              >
                {cuentaSel.tipo === "caja_fuerte" ? (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="efectivo" id="vg-m-ef" />
                    <Label htmlFor="vg-m-ef" className="font-normal">Efectivo</Label>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="transferencia" id="vg-m-tr" />
                      <Label htmlFor="vg-m-tr" className="font-normal">Transferencia</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="cheque" id="vg-m-ch" />
                      <Label htmlFor="vg-m-ch" className="font-normal">Cheque</Label>
                    </div>
                  </>
                )}
              </RadioGroup>
            </div>
          )}

          <div>
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div>
            <Label>{refLabel}</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>

          <div>
            <Label>Notas (opcional)</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={disabled || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Guardando…" : `Registrar pago ${formatMXN(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
