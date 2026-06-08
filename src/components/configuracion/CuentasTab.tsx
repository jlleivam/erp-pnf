import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listCuentas,
  crearCuenta,
  actualizarCuenta,
  setCuentaActiva,
  listMovimientos,
} from "@/lib/api/cuentas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Landmark, Wallet, Plus, Pencil, Power } from "lucide-react";
import { formatMXN, formatDate } from "@/lib/format";

type Cuenta = {
  id: string;
  nombre: string;
  tipo: "bancaria" | "caja_fuerte";
  moneda: string;
  banco: string | null;
  numero_cuenta: string | null;
  clabe: string | null;
  saldo_inicial: number;
  saldo_actual: number;
  activa: boolean;
  notas: string | null;
};

export function CuentasTab() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCuentas);
  const crearFn = useServerFn(crearCuenta);
  const actualizarFn = useServerFn(actualizarCuenta);
  const toggleFn = useServerFn(setCuentaActiva);

  const { data: cuentas = [], isLoading } = useQuery({
    queryKey: ["cuentas"],
    queryFn: () => fetchList() as Promise<Cuenta[]>,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cuenta | null>(null);
  const [detalle, setDetalle] = useState<Cuenta | null>(null);

  const crearMut = useMutation({
    mutationFn: (input: Parameters<typeof crearCuenta>[0]["data"]) =>
      crearFn({ data: input }),
    onSuccess: () => {
      toast.success("Cuenta creada");
      qc.invalidateQueries({ queryKey: ["cuentas"] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editarMut = useMutation({
    mutationFn: (input: Parameters<typeof actualizarCuenta>[0]["data"]) =>
      actualizarFn({ data: input }),
    onSuccess: () => {
      toast.success("Cuenta actualizada");
      qc.invalidateQueries({ queryKey: ["cuentas"] });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (input: { id: string; activa: boolean }) =>
      toggleFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuentas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNueva = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEditar = (c: Cuenta) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const totalBancos = cuentas
    .filter((c) => c.tipo === "bancaria" && c.activa)
    .reduce((s, c) => s + Number(c.saldo_actual || 0), 0);
  const totalCaja = cuentas
    .filter((c) => c.tipo === "caja_fuerte" && c.activa)
    .reduce((s, c) => s + Number(c.saldo_actual || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Landmark className="size-3" /> Bancos
            </div>
            <div className="text-xl font-semibold">{formatMXN(totalBancos)}</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Wallet className="size-3" /> Caja fuerte
            </div>
            <div className="text-xl font-semibold">{formatMXN(totalCaja)}</div>
          </div>
        </div>
        <Button onClick={openNueva}>
          <Plus className="size-4 mr-1" /> Nueva cuenta
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead className="text-right">Saldo actual</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && cuentas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  No hay cuentas registradas
                </TableCell>
              </TableRow>
            )}
            {cuentas.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => setDetalle(c)}
              >
                <TableCell className="font-medium">{c.nombre}</TableCell>
                <TableCell>
                  <Badge variant={c.tipo === "bancaria" ? "default" : "secondary"}>
                    {c.tipo === "bancaria" ? "Bancaria" : "Caja fuerte"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.banco || "—"}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <span className={Number(c.saldo_actual) < 0 ? "text-destructive" : ""}>
                    {formatMXN(Number(c.saldo_actual))}
                  </span>
                </TableCell>
                <TableCell>
                  {c.activa ? (
                    <Badge variant="outline">Activa</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactiva
                    </Badge>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => openEditar(c)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleMut.mutate({ id: c.id, activa: !c.activa })}
                      title={c.activa ? "Desactivar" : "Activar"}
                    >
                      <Power className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CuentaFormDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        onSubmit={(values) => {
          if (editing) {
            editarMut.mutate({
              id: editing.id,
              nombre: values.nombre,
              banco: values.banco,
              numero_cuenta: values.numero_cuenta,
              clabe: values.clabe,
              notas: values.notas,
            });
          } else {
            crearMut.mutate(values);
          }
        }}
        submitting={crearMut.isPending || editarMut.isPending}
      />

      <CuentaDetalleSheet cuenta={detalle} onClose={() => setDetalle(null)} />
    </div>
  );
}

type FormValues = {
  nombre: string;
  tipo: "bancaria" | "caja_fuerte";
  moneda: string;
  banco: string | null;
  numero_cuenta: string | null;
  clabe: string | null;
  saldo_inicial: number;
  notas: string | null;
};

function CuentaFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Cuenta | null;
  onSubmit: (v: FormValues) => void;
  submitting: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"bancaria" | "caja_fuerte">("bancaria");
  const [banco, setBanco] = useState("");
  const [numeroCuenta, setNumeroCuenta] = useState("");
  const [clabe, setClabe] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("0");
  const [notas, setNotas] = useState("");

  // Sync form when opened
  useState(() => {});
  // reset on open change
  const resetKey = `${open}-${editing?.id ?? "new"}`;
  // simple effect via key
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useResetForm(resetKey, () => {
    if (editing) {
      setNombre(editing.nombre);
      setTipo(editing.tipo);
      setBanco(editing.banco ?? "");
      setNumeroCuenta(editing.numero_cuenta ?? "");
      setClabe(editing.clabe ?? "");
      setSaldoInicial(String(editing.saldo_inicial));
      setNotas(editing.notas ?? "");
    } else {
      setNombre("");
      setTipo("bancaria");
      setBanco("");
      setNumeroCuenta("");
      setClabe("");
      setSaldoInicial("0");
      setNotas("");
    }
  });

  const handleSubmit = () => {
    const monto = Number(saldoInicial || 0);
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (Number.isNaN(monto) || monto < 0) {
      toast.error("Saldo inicial inválido");
      return;
    }
    onSubmit({
      nombre: nombre.trim(),
      tipo,
      moneda: "MXN",
      banco: tipo === "bancaria" ? (banco.trim() || null) : null,
      numero_cuenta: tipo === "bancaria" ? (numeroCuenta.trim() || null) : null,
      clabe: tipo === "bancaria" ? (clabe.trim() || null) : null,
      saldo_inicial: monto,
      notas: notas.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!editing && (
            <div className="space-y-2">
              <Label>Tipo de cuenta</Label>
              <RadioGroup
                value={tipo}
                onValueChange={(v) => setTipo(v as "bancaria" | "caja_fuerte")}
                className="grid grid-cols-2 gap-2"
              >
                <label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="bancaria" />
                  <Landmark className="size-4" />
                  <span className="text-sm">Bancaria</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="caja_fuerte" />
                  <Wallet className="size-4" />
                  <span className="text-sm">Caja fuerte</span>
                </label>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cuenta-nombre">Nombre *</Label>
            <Input
              id="cuenta-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={tipo === "bancaria" ? "Ej. BBVA Operativa" : "Ej. Caja oficina"}
            />
          </div>

          {tipo === "bancaria" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cuenta-banco">Banco</Label>
                <Input
                  id="cuenta-banco"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="BBVA, Santander, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cuenta-num">Número de cuenta</Label>
                  <Input
                    id="cuenta-num"
                    value={numeroCuenta}
                    onChange={(e) => setNumeroCuenta(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuenta-clabe">CLABE</Label>
                  <Input
                    id="cuenta-clabe"
                    value={clabe}
                    onChange={(e) => setClabe(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {!editing && (
            <div className="space-y-2">
              <Label htmlFor="cuenta-saldo">Saldo inicial</Label>
              <Input
                id="cuenta-saldo"
                type="number"
                step="0.01"
                min="0"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se registrará como movimiento de apertura. No podrá modificarse después.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cuenta-notas">Notas</Label>
            <Textarea
              id="cuenta-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Guardando…" : editing ? "Guardar" : "Crear cuenta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper: re-run a callback whenever `key` changes.
function useResetForm(key: string, cb: () => void) {
  const { useEffect, useRef } = require("react") as typeof import("react");
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== key) {
      last.current = key;
      cb();
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

function CuentaDetalleSheet({
  cuenta,
  onClose,
}: {
  cuenta: Cuenta | null;
  onClose: () => void;
}) {
  const fetchMov = useServerFn(listMovimientos);
  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["cuenta-movs", cuenta?.id],
    queryFn: () =>
      fetchMov({ data: { cuentaId: cuenta!.id } }) as Promise<
        Array<{
          id: string;
          fecha: string;
          tipo: "ingreso" | "egreso";
          monto: number;
          concepto: string | null;
          referencia: string | null;
          origen: string;
          created_at: string;
        }>
      >,
    enabled: !!cuenta,
  });

  return (
    <Sheet open={!!cuenta} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{cuenta?.nombre}</SheetTitle>
        </SheetHeader>
        {cuenta && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Tipo</div>
                <div>{cuenta.tipo === "bancaria" ? "Bancaria" : "Caja fuerte"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Estado</div>
                <div>{cuenta.activa ? "Activa" : "Inactiva"}</div>
              </div>
              {cuenta.banco && (
                <div>
                  <div className="text-muted-foreground">Banco</div>
                  <div>{cuenta.banco}</div>
                </div>
              )}
              {cuenta.numero_cuenta && (
                <div>
                  <div className="text-muted-foreground">No. cuenta</div>
                  <div>{cuenta.numero_cuenta}</div>
                </div>
              )}
              {cuenta.clabe && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">CLABE</div>
                  <div>{cuenta.clabe}</div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground">Saldo inicial</div>
                <div>{formatMXN(Number(cuenta.saldo_inicial))}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Saldo actual</div>
                <div className="font-semibold">{formatMXN(Number(cuenta.saldo_actual))}</div>
              </div>
              {cuenta.notas && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Notas</div>
                  <div>{cuenta.notas}</div>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Movimientos</div>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          Cargando…
                        </TableCell>
                      </TableRow>
                    )}
                    {!isLoading && movs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          Sin movimientos
                        </TableCell>
                      </TableRow>
                    )}
                    {movs.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{formatDate(m.fecha)}</TableCell>
                        <TableCell className="text-sm">
                          {m.concepto || "—"}
                          {m.referencia && (
                            <span className="text-xs text-muted-foreground block">
                              {m.referencia}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <span
                            className={
                              m.tipo === "ingreso" ? "text-emerald-600" : "text-destructive"
                            }
                          >
                            {m.tipo === "ingreso" ? "+" : "−"}
                            {formatMXN(Number(m.monto))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
