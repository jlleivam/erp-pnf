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
import { registrarPagoOC } from "@/lib/api/pagos.functions";
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

interface Props {
  ocId: string;
  ocFolio: string;
  saldoPendiente: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

export function RegistrarPagoOCDialog({
  ocId, ocFolio, saldoPendiente, open, onOpenChange, onSaved,
}: Props) {
  const hoy = new Date().toISOString().slice(0, 10);
  const fetchCuentas = useServerFn(listCuentas);
  const registrarFn = useServerFn(registrarPagoOC);

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
  const [monto, setMonto] = useState<string>(saldoPendiente.toFixed(2));
  const [fecha, setFecha] = useState<string>(hoy);
  const [referencia, setReferencia] = useState<string>("");
  const [notas, setNotas] = useState<string>("");

  const cuentaSel = cuentas.find((c) => c.id === cuentaId);

  // Ajustar método cuando cambia tipo de cuenta
  const handleCuentaChange = (id: string) => {
    setCuentaId(id);
    const c = cuentas.find((x) => x.id === id);
    if (c?.tipo === "caja_fuerte") setMetodo("efectivo");
    else if (c?.tipo === "bancaria" && metodo === "efectivo") setMetodo("transferencia");
  };

  const montoNum = Number(monto);
  const excedeOC = montoNum > saldoPendiente + 0.001;
  const excedeCuenta = cuentaSel ? montoNum > Number(cuentaSel.saldo_actual) + 0.001 : false;
  const disabled =
    !cuentaId || !montoNum || montoNum <= 0 || excedeOC || excedeCuenta || !fecha;

  const m = useMutation({
    mutationFn: () => registrarFn({
      data: {
        ocId,
        cuentaId,
        monto: montoNum,
        metodo,
        fecha,
        referencia: referencia.trim() || undefined,
        notas: notas.trim() || undefined,
      },
    }),
    onSuccess: () => {
      toast.success("Pago registrado");
      onSaved?.();
      onOpenChange(false);
      // reset
      setCuentaId(""); setMonto(saldoPendiente.toFixed(2));
      setReferencia(""); setNotas(""); setFecha(hoy);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refLabel = metodo === "cheque" ? "# Cheque"
    : metodo === "transferencia" ? "# Referencia / folio"
    : "Referencia (opcional)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pago · {ocFolio}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Saldo pendiente de la OC</span>
            <span className="font-semibold">{formatMXN(saldoPendiente)}</span>
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
                El monto excede el saldo disponible de la cuenta ({formatMXN(Number(cuentaSel.saldo_actual))})
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
                    <RadioGroupItem value="efectivo" id="m-ef" />
                    <Label htmlFor="m-ef" className="font-normal">Efectivo</Label>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="transferencia" id="m-tr" />
                      <Label htmlFor="m-tr" className="font-normal">Transferencia</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="cheque" id="m-ch" />
                      <Label htmlFor="m-ch" className="font-normal">Cheque</Label>
                    </div>
                  </>
                )}
              </RadioGroup>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto</Label>
              <Input
                type="number" step="0.01" min="0" max={saldoPendiente}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              {excedeOC && (
                <p className="text-xs text-rose-600 mt-1">Excede el saldo pendiente</p>
              )}
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
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
            {m.isPending ? "Guardando…" : "Registrar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
