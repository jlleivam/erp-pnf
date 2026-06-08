import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Landmark,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
} from "lucide-react";
import { listCuentas, listMovimientos } from "@/lib/api/cuentas.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type Movimiento = {
  id: string;
  fecha: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  concepto: string | null;
  referencia: string | null;
  origen: string;
  creado_por: string | null;
  created_at: string;
};

const ORIGEN_LABEL: Record<string, string> = {
  apertura: "Apertura",
  ajuste: "Ajuste",
  pago: "Pago",
  traspaso: "Traspaso",
  ingreso_manual: "Ingreso manual",
};

const last4 = (s: string | null) => (s ? s.slice(-4).padStart(4, "•") : null);

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TesoreriaModule() {
  const fetchCuentas = useServerFn(listCuentas);
  const fetchMovs = useServerFn(listMovimientos);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInactivas, setShowInactivas] = useState(false);
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoToday());
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "ingreso" | "egreso">(
    "todos"
  );

  const cuentasQ = useQuery({
    queryKey: ["tesoreria", "cuentas"],
    queryFn: () => fetchCuentas() as Promise<Cuenta[]>,
  });

  const cuentas = cuentasQ.data ?? [];
  const activas = cuentas.filter((c) => c.activa);
  const inactivas = cuentas.filter((c) => !c.activa);
  const totalActivas = activas.reduce((s, c) => s + Number(c.saldo_actual), 0);

  const selected = useMemo(
    () => cuentas.find((c) => c.id === selectedId) ?? null,
    [cuentas, selectedId]
  );

  const movsQ = useQuery({
    queryKey: ["tesoreria", "movs", selectedId, from, to],
    queryFn: () =>
      fetchMovs({ data: { cuentaId: selectedId!, from, to } }) as Promise<
        Movimiento[]
      >,
    enabled: !!selectedId,
  });

  const movsRaw = movsQ.data ?? [];
  const movs = movsRaw.filter(
    (m) => tipoFiltro === "todos" || m.tipo === tipoFiltro
  );

  // Saldo corrido: parte del saldo_actual y revierte movimientos desc → asc
  const saldosCorridos = useMemo(() => {
    if (!selected) return [] as number[];
    // movsRaw viene ordenado por fecha DESC; saldo del primer renglón = saldo_actual
    const result: number[] = [];
    let running = Number(selected.saldo_actual);
    // Pero el filtro por tipo puede ocultar renglones. Calculamos sobre movsRaw
    // y luego mapeamos por id.
    const map = new Map<string, number>();
    for (const m of movsRaw) {
      map.set(m.id, running);
      // revertir: el siguiente (más antiguo) tuvo el saldo previo a este mov
      running =
        m.tipo === "ingreso"
          ? running - Number(m.monto)
          : running + Number(m.monto);
    }
    for (const m of movs) {
      result.push(map.get(m.id) ?? 0);
    }
    return result;
  }, [movs, movsRaw, selected]);

  const totales = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    for (const m of movs) {
      const v = Number(m.monto);
      if (m.tipo === "ingreso") ingresos += v;
      else egresos += v;
    }
    return { ingresos, egresos, neto: ingresos - egresos };
  }, [movs]);

  const exportCSV = () => {
    if (!selected) return;
    const header = [
      "fecha",
      "concepto",
      "referencia",
      "origen",
      "tipo",
      "monto",
      "saldo",
    ];
    const rows = movs.map((m, i) => [
      m.fecha,
      m.concepto ?? "",
      m.referencia ?? "",
      ORIGEN_LABEL[m.origen] ?? m.origen,
      m.tipo,
      String(m.monto),
      String(saldosCorridos[i] ?? ""),
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos-${selected.nombre.replace(/\s+/g, "_")}-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* KPI total */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-transparent">
        <p className="text-sm text-muted-foreground">
          Saldo total · cuentas activas
        </p>
        <p className="text-3xl font-semibold tracking-tight mt-1">
          {formatMXN(totalActivas)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {activas.length} cuenta{activas.length === 1 ? "" : "s"} activa
          {activas.length === 1 ? "" : "s"}
        </p>
      </Card>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        {/* Lista de cuentas */}
        <div className="space-y-3">
          {cuentasQ.isLoading && (
            <Card className="p-4 text-sm text-muted-foreground">
              Cargando cuentas…
            </Card>
          )}
          {!cuentasQ.isLoading && activas.length === 0 && (
            <Card className="p-6 border-dashed text-center">
              <Wallet className="size-8 mx-auto text-muted-foreground" />
              <p className="text-sm mt-2">No hay cuentas activas</p>
              <p className="text-xs text-muted-foreground mt-1">
                Crea cuentas desde Configuración → Cuentas.
              </p>
            </Card>
          )}
          {activas.map((c) => (
            <CuentaCard
              key={c.id}
              cuenta={c}
              selected={selectedId === c.id}
              onClick={() => setSelectedId(c.id)}
            />
          ))}

          {inactivas.length > 0 && (
            <>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline w-full text-left"
                onClick={() => setShowInactivas((v) => !v)}
              >
                {showInactivas ? "Ocultar" : "Ver"} cuentas inactivas (
                {inactivas.length})
              </button>
              {showInactivas &&
                inactivas.map((c) => (
                  <CuentaCard
                    key={c.id}
                    cuenta={c}
                    selected={selectedId === c.id}
                    onClick={() => setSelectedId(c.id)}
                    dimmed
                  />
                ))}
            </>
          )}
        </div>

        {/* Detalle */}
        <div>
          {!selected && (
            <Card className="p-10 text-center border-dashed">
              <Landmark className="size-10 mx-auto text-muted-foreground" />
              <p className="text-sm mt-3">
                Selecciona una cuenta para ver sus movimientos
              </p>
            </Card>
          )}
          {selected && (
            <Card className="p-5 space-y-5">
              <header className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold">{selected.nombre}</h2>
                    <Badge variant="secondary" className="capitalize">
                      {selected.tipo === "bancaria" ? "Bancaria" : "Caja fuerte"}
                    </Badge>
                    {!selected.activa && (
                      <Badge className="bg-slate-100 text-slate-700">
                        Inactiva
                      </Badge>
                    )}
                  </div>
                  {selected.tipo === "bancaria" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {[selected.banco, last4(selected.numero_cuenta) && `····${last4(selected.numero_cuenta)}`]
                        .filter(Boolean)
                        .join(" · ")}
                      {selected.clabe && ` · CLABE ····${last4(selected.clabe)}`}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Saldo actual</p>
                  <p className="text-2xl font-semibold">
                    {formatMXN(Number(selected.saldo_actual))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Inicial: {formatMXN(Number(selected.saldo_inicial))}
                  </p>
                </div>
              </header>

              {/* Filtros */}
              <div className="grid sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Hasta</Label>
                  <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={tipoFiltro}
                    onValueChange={(v) =>
                      setTipoFiltro(v as "todos" | "ingreso" | "egreso")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="ingreso">Ingresos</SelectItem>
                      <SelectItem value="egreso">Egresos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={exportCSV}
                    disabled={movs.length === 0}
                  >
                    <Download className="size-4 mr-1" /> CSV
                  </Button>
                </div>
              </div>

              {/* Totales del rango */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowDownCircle className="size-3.5 text-emerald-600" />
                    Ingresos
                  </div>
                  <p className="text-base font-semibold mt-1">
                    {formatMXN(totales.ingresos)}
                  </p>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowUpCircle className="size-3.5 text-rose-600" />
                    Egresos
                  </div>
                  <p className="text-base font-semibold mt-1">
                    {formatMXN(totales.egresos)}
                  </p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Neto</p>
                  <p
                    className={`text-base font-semibold mt-1 ${totales.neto < 0 ? "text-rose-600" : "text-emerald-700"}`}
                  >
                    {formatMXN(totales.neto)}
                  </p>
                </Card>
              </div>

              {/* Tabla */}
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Ref.</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead className="text-right">Ingreso</TableHead>
                      <TableHead className="text-right">Egreso</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movsQ.isLoading && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-sm text-muted-foreground py-6"
                        >
                          Cargando movimientos…
                        </TableCell>
                      </TableRow>
                    )}
                    {!movsQ.isLoading && movs.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-sm text-muted-foreground py-6"
                        >
                          Sin movimientos en este rango.
                        </TableCell>
                      </TableRow>
                    )}
                    {movs.map((m, i) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(m.fecha)}
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate">
                          {m.concepto ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.referencia ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {ORIGEN_LABEL[m.origen] ?? m.origen}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-emerald-700">
                          {m.tipo === "ingreso" ? formatMXN(Number(m.monto)) : ""}
                        </TableCell>
                        <TableCell className="text-right text-rose-600">
                          {m.tipo === "egreso" ? formatMXN(Number(m.monto)) : ""}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMXN(saldosCorridos[i] ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CuentaCard({
  cuenta,
  selected,
  onClick,
  dimmed,
}: {
  cuenta: Cuenta;
  selected: boolean;
  onClick: () => void;
  dimmed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left transition ${dimmed ? "opacity-60" : ""}`}
    >
      <Card
        className={`p-4 hover:border-primary/50 ${
          selected ? "border-primary ring-1 ring-primary/30" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {cuenta.tipo === "bancaria" ? (
              <Landmark className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <Wallet className="size-4 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{cuenta.nombre}</p>
              <p className="text-xs text-muted-foreground truncate">
                {cuenta.tipo === "bancaria"
                  ? [cuenta.banco, last4(cuenta.numero_cuenta) && `····${last4(cuenta.numero_cuenta)}`]
                      .filter(Boolean)
                      .join(" · ") || "Bancaria"
                  : "Caja fuerte"}
              </p>
            </div>
          </div>
        </div>
        <p className="text-lg font-semibold mt-2">
          {formatMXN(Number(cuenta.saldo_actual))}
        </p>
        {cuenta.moneda && cuenta.moneda !== "MXN" && (
          <p className="text-xs text-muted-foreground">{cuenta.moneda}</p>
        )}
      </Card>
    </button>
  );
}
