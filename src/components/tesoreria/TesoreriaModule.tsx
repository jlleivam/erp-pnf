import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Wallet, Download } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMXN } from "@/lib/format";

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

const shortDateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

function formatDateShort(iso: string): string {
  // iso = YYYY-MM-DD; evitar shift por timezone
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return shortDateFmt.format(new Date(y, m - 1, d));
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
  const visibles = showInactivas ? [...activas, ...inactivas] : activas;

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

  const saldosCorridos = useMemo(() => {
    if (!selected) return [] as number[];
    const map = new Map<string, number>();
    let running = Number(selected.saldo_actual);
    for (const m of movsRaw) {
      map.set(m.id, running);
      running =
        m.tipo === "ingreso"
          ? running - Number(m.monto)
          : running + Number(m.monto);
    }
    return movs.map((m) => map.get(m.id) ?? 0);
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
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* KPI compacto */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Landmark className="size-4" />
            <span>Saldo total · cuentas activas</span>
            <span className="text-xs">
              ({activas.length} cuenta{activas.length === 1 ? "" : "s"})
            </span>
          </div>
          <span className="text-base font-semibold tracking-tight">
            {formatMXN(totalActivas)}
          </span>
        </div>

        {/* Chips de cuentas */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {cuentasQ.isLoading && (
            <span className="text-xs text-muted-foreground">Cargando…</span>
          )}
          {!cuentasQ.isLoading && activas.length === 0 && (
            <span className="text-xs text-muted-foreground">
              No hay cuentas activas
            </span>
          )}
          {visibles.map((c) => {
            const isSel = selectedId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition ${
                  isSel
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border hover:border-primary/40"
                } ${!c.activa ? "opacity-60" : ""}`}
              >
                {c.tipo === "bancaria" ? (
                  <Landmark className="size-3.5 text-muted-foreground" />
                ) : (
                  <Wallet className="size-3.5 text-muted-foreground" />
                )}
                <span className="font-medium">{c.nombre}</span>
                <span className="text-xs text-muted-foreground">
                  {formatMXN(Number(c.saldo_actual))}
                </span>
                {!c.activa && (
                  <Badge variant="secondary" className="ml-1 text-[10px] py-0">
                    inactiva
                  </Badge>
                )}
              </button>
            );
          })}
          {inactivas.length > 0 && (
            <button
              type="button"
              onClick={() => setShowInactivas((v) => !v)}
              className="shrink-0 px-3 py-1.5 rounded-full border border-dashed text-xs text-muted-foreground hover:text-foreground"
            >
              {showInactivas ? "Ocultar" : `+${inactivas.length}`} inactivas
            </button>
          )}
        </div>

        {/* Detalle */}
        {!selected && (
          <Card className="p-10 text-center border-dashed">
            <Landmark className="size-8 mx-auto text-muted-foreground" />
            <p className="text-sm mt-3">
              Selecciona una cuenta para ver sus movimientos
            </p>
          </Card>
        )}
        {selected && (
          <Card className="p-4 space-y-3">
            {/* Header cuenta */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 className="text-base font-semibold truncate">
                  {selected.nombre}
                </h2>
                <Badge variant="secondary" className="capitalize text-xs">
                  {selected.tipo === "bancaria" ? "Bancaria" : "Caja fuerte"}
                </Badge>
                {!selected.activa && (
                  <Badge className="bg-slate-100 text-slate-700 text-xs">
                    Inactiva
                  </Badge>
                )}
                {selected.tipo === "bancaria" && (
                  <span className="text-xs text-muted-foreground">
                    {[
                      selected.banco,
                      last4(selected.numero_cuenta) &&
                        `····${last4(selected.numero_cuenta)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-right cursor-help">
                    <p className="text-[10px] text-muted-foreground leading-none">
                      Saldo actual
                    </p>
                    <p className="text-lg font-semibold leading-tight">
                      {formatMXN(Number(selected.saldo_actual))}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Saldo inicial: {formatMXN(Number(selected.saldo_inicial))}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Filtros + export en una fila */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col">
                <Label className="text-[10px] text-muted-foreground">
                  Desde
                </Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 w-[140px]"
                />
              </div>
              <div className="flex flex-col">
                <Label className="text-[10px] text-muted-foreground">
                  Hasta
                </Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 w-[140px]"
                />
              </div>
              <div className="flex flex-col">
                <Label className="text-[10px] text-muted-foreground">
                  Tipo
                </Label>
                <Select
                  value={tipoFiltro}
                  onValueChange={(v) =>
                    setTipoFiltro(v as "todos" | "ingreso" | "egreso")
                  }
                >
                  <SelectTrigger className="h-8 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="ingreso">Ingresos</SelectItem>
                    <SelectItem value="egreso">Egresos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={exportCSV}
                disabled={movs.length === 0}
              >
                <Download className="size-3.5 mr-1" /> CSV
              </Button>

              {/* Totales inline */}
              <div className="ml-auto flex items-center gap-3 text-xs">
                <span>
                  <span className="text-muted-foreground">Ingresos </span>
                  <span className="font-medium text-emerald-700">
                    {formatMXN(totales.ingresos)}
                  </span>
                </span>
                <span className="text-muted-foreground">·</span>
                <span>
                  <span className="text-muted-foreground">Egresos </span>
                  <span className="font-medium text-rose-600">
                    {formatMXN(totales.egresos)}
                  </span>
                </span>
                <span className="text-muted-foreground">·</span>
                <span>
                  <span className="text-muted-foreground">Neto </span>
                  <span
                    className={`font-semibold ${totales.neto < 0 ? "text-rose-600" : "text-emerald-700"}`}
                  >
                    {formatMXN(totales.neto)}
                  </span>
                </span>
              </div>
            </div>

            {/* Tabla */}
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center h-9">Fecha</TableHead>
                    <TableHead className="text-left h-9">Concepto</TableHead>
                    <TableHead className="text-center h-9">Ingreso</TableHead>
                    <TableHead className="text-center h-9">Egreso</TableHead>
                    <TableHead className="text-center h-9">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movsQ.isLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground py-6"
                      >
                        Cargando movimientos…
                      </TableCell>
                    </TableRow>
                  )}
                  {!movsQ.isLoading && movs.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground py-6"
                      >
                        Sin movimientos en este rango.
                      </TableCell>
                    </TableRow>
                  )}
                  {movs.map((m, i) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-center whitespace-nowrap py-1.5 text-sm tabular-nums">
                        {formatDateShort(m.fecha)}
                      </TableCell>
                      <TableCell className="text-left py-1.5 text-sm max-w-[200px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate cursor-help">
                              {m.concepto ?? "—"}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1">
                              <p className="text-xs">
                                {m.concepto ?? "Sin concepto"}
                              </p>
                              <p className="text-[10px] opacity-80">
                                Origen: {ORIGEN_LABEL[m.origen] ?? m.origen}
                              </p>
                              {m.referencia && (
                                <p className="text-[10px] opacity-80">
                                  Ref: {m.referencia}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-center py-1.5 text-sm text-emerald-700 tabular-nums">
                        {m.tipo === "ingreso"
                          ? formatMXN(Number(m.monto))
                          : ""}
                      </TableCell>
                      <TableCell className="text-center py-1.5 text-sm text-rose-600 tabular-nums">
                        {m.tipo === "egreso"
                          ? formatMXN(Number(m.monto))
                          : ""}
                      </TableCell>
                      <TableCell className="text-center py-1.5 text-sm font-medium tabular-nums">
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
    </TooltipProvider>
  );
}
