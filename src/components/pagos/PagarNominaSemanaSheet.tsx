import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { listCuentas } from "@/lib/api/cuentas.functions";
import { listTrabajadoresPagoSemana, pagarNominaSemana } from "@/lib/api/nominas.functions";
import { formatMXN, formatDate } from "@/lib/format";
import type { SemanaNominaRow } from "./NominaPorPagarTab";

type Cheque = {
  id: string;
  cuentaId: string;
  folio: string;
  trabajadorId: string | null;
  trabajadorNombre: string;
  monto: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function PagarNominaSemanaSheet({
  semana, open, onOpenChange,
}: {
  semana: SemanaNominaRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const fetchCuentas = useServerFn(listCuentas);
  const fetchTrabajadores = useServerFn(listTrabajadoresPagoSemana);
  const pagar = useServerFn(pagarNominaSemana);

  const cuentasQ = useQuery({ queryKey: ["cuentas-activas"], queryFn: () => fetchCuentas() });
  const trabsQ = useQuery({
    queryKey: ["nomina-trabajadores", semana.semana_inicio],
    queryFn: () => fetchTrabajadores({ data: { semanaInicio: semana.semana_inicio } }),
  });

  const cuentas = (cuentasQ.data ?? []) as any[];
  const cuentasBancarias = cuentas.filter((c) => c.tipo === "bancaria" && c.activa);
  const cajasFuertes = cuentas.filter((c) => c.tipo === "caja_fuerte" && c.activa);
  const trabajadores = (trabsQ.data ?? []) as Array<{ trabajador_id: string; nombre: string; importe: number }>;

  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState("");
  const [cuentaCajaFuerteId, setCuentaCajaFuerteId] = useState<string>("");
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [saving, setSaving] = useState(false);

  // Preselect caja fuerte (nombre = "Caja fuerte" o primera)
  useMemo(() => {
    if (!cuentaCajaFuerteId && cajasFuertes.length > 0) {
      const preferida = cajasFuertes.find((c) => /caja fuerte/i.test(c.nombre)) ?? cajasFuertes[0];
      setCuentaCajaFuerteId(preferida.id);
    }
  }, [cajasFuertes, cuentaCajaFuerteId]);

  const totalCheques = cheques.reduce((s, c) => s + (Number(c.monto) || 0), 0);
  const remanente = +(semana.total - totalCheques).toFixed(2);

  const valesPorObra = useMemo(() => {
    if (remanente <= 0.005 || semana.total <= 0) return [] as Array<{ obra_nombre: string; monto: number }>;
    const out: Array<{ obra_nombre: string; monto: number }> = [];
    let acc = 0;
    for (let i = 0; i < semana.obras.length; i++) {
      const o = semana.obras[i];
      const share = o.monto / semana.total;
      const monto = i === semana.obras.length - 1
        ? +(remanente - acc).toFixed(2)
        : +(remanente * share).toFixed(2);
      acc = +(acc + monto).toFixed(2);
      if (monto > 0) out.push({ obra_nombre: o.obra_nombre, monto });
    }
    return out;
  }, [remanente, semana]);

  function addCheque() {
    setCheques((prev) => [...prev, {
      id: uid(),
      cuentaId: cuentasBancarias[0]?.id ?? "",
      folio: "",
      trabajadorId: null,
      trabajadorNombre: "",
      monto: "",
    }]);
  }

  function updateCheque(id: string, patch: Partial<Cheque>) {
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCheque(id: string) {
    setCheques((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleSave() {
    if (!cuentaCajaFuerteId) {
      toast.error("Selecciona la caja fuerte para los vales");
      return;
    }
    if (totalCheques > semana.total + 0.01) {
      toast.error("Los cheques exceden el total de la nómina");
      return;
    }
    for (const c of cheques) {
      if (!c.cuentaId) return toast.error("Selecciona la cuenta bancaria del cheque");
      if (!c.folio.trim()) return toast.error("Captura el folio del cheque");
      if (!c.trabajadorNombre.trim()) return toast.error("Selecciona el trabajador beneficiario");
      if (!c.monto || Number(c.monto) <= 0) return toast.error("Captura el monto del cheque");
    }
    setSaving(true);
    try {
      await pagar({
        data: {
          semanaInicio: semana.semana_inicio,
          fechaPago,
          notas: notas.trim() || null,
          cuentaCajaFuerteId,
          cheques: cheques.map((c) => ({
            cuentaId: c.cuentaId,
            folio: c.folio.trim(),
            trabajadorId: c.trabajadorId,
            trabajadorNombre: c.trabajadorNombre.trim(),
            monto: Number(c.monto),
          })),
        },
      });
      toast.success("Nómina pagada");
      qc.invalidateQueries({ queryKey: ["nomina-por-pagar"] });
      qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrar el pago");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="pr-10">
          <SheetTitle>Pagar nómina semanal</SheetTitle>
          <SheetDescription>
            Semana {formatDate(semana.semana_inicio)} → {formatDate(semana.semana_fin)} · Total {formatMXN(semana.total)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Fecha de pago</Label>
              <Input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </div>
            <div>
              <Label>Caja fuerte para vales</Label>
              <Select value={cuentaCajaFuerteId} onValueChange={setCuentaCajaFuerteId}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {cajasFuertes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre} · {formatMXN(Number(c.saldo_actual))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Cheques emitidos</h4>
                <p className="text-xs text-muted-foreground">Uno por cheque físico. El beneficiario debe ser un trabajador incluido en la nómina.</p>
              </div>
              <Button size="sm" variant="outline" onClick={addCheque}>
                <Plus className="size-4 mr-1" /> Agregar cheque
              </Button>
            </div>

            {cheques.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Sin cheques. Todo el monto se cubrirá con vales de efectivo.</p>
            )}

            {cheques.length > 0 && (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuenta bancaria</TableHead>
                      <TableHead>Folio</TableHead>
                      <TableHead>Trabajador</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cheques.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Select value={c.cuentaId} onValueChange={(v) => updateCheque(c.id, { cuentaId: v })}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Cuenta…" /></SelectTrigger>
                            <SelectContent>
                              {cuentasBancarias.map((b) => (
                                <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input className="h-8" value={c.folio} onChange={(e) => updateCheque(c.id, { folio: e.target.value })} placeholder="Folio" />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={c.trabajadorId ?? ""}
                            onValueChange={(v) => {
                              const t = trabajadores.find((x) => x.trabajador_id === v);
                              updateCheque(c.id, { trabajadorId: v, trabajadorNombre: t?.nombre ?? "" });
                            }}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder="Trabajador…" /></SelectTrigger>
                            <SelectContent>
                              {trabajadores.map((t) => (
                                <SelectItem key={t.trabajador_id} value={t.trabajador_id}>
                                  {t.nombre} · {formatMXN(t.importe)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="h-8 w-28 text-right"
                            type="number"
                            step="0.01"
                            value={c.monto}
                            onChange={(e) => updateCheque(c.id, { monto: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeCheque(c.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-2">Vales de efectivo (remanente por obra)</h4>
            {valesPorObra.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Sin remanente. Los cheques cubren toda la nómina.
              </p>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Obra</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valesPorObra.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell>{v.obra_nombre}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">{formatMXN(v.monto)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <Card className="px-3 py-2">
              <p className="text-xs text-muted-foreground">Total nómina</p>
              <p className="font-semibold">{formatMXN(semana.total)}</p>
            </Card>
            <Card className="px-3 py-2">
              <p className="text-xs text-muted-foreground">Total cheques</p>
              <p className="font-semibold">{formatMXN(totalCheques)}</p>
            </Card>
            <Card className="px-3 py-2">
              <p className="text-xs text-muted-foreground">Total vales</p>
              <p className="font-semibold">{formatMXN(Math.max(0, remanente))}</p>
            </Card>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Registrar pago"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
