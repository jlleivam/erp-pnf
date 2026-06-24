import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TruncatedCell } from "@/components/pagos/TruncatedCell";
import { formatMXN } from "@/lib/format";
import {
  getCondensadoSemanal,
  type CondensadoSemanalData,
} from "@/lib/api/condensado-semanal.functions";

// ============================================================
// Date helpers — semana lunes a domingo
// ============================================================
function startOfWeekLunes(d: Date): Date {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay(); // 0=domingo
  const diff = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return dt;
}
function toISO(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
function formatRangoSemana(inicio: string, fin: string): string {
  const i = new Date(inicio + "T00:00:00Z");
  const f = new Date(fin + "T00:00:00Z");
  const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
  const yr = i.getUTCFullYear();
  return `${fmt(i)} – ${fmt(f)} ${yr}`;
}
function formatFechaCorta(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("es-MX", {
    day: "2-digit", month: "2-digit", timeZone: "UTC",
  });
}

// ============================================================
// Component
// ============================================================
export function CondensadoSemanalModule() {
  const fetchData = useServerFn(getCondensadoSemanal);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekLunes(new Date()));
  const [soloPendiente, setSoloPendiente] = useState(false);

  const inicio = toISO(weekStart);
  const fin = toISO(addDays(weekStart, 6));

  const q = useQuery<CondensadoSemanalData>({
    queryKey: ["condensado-semanal", inicio],
    queryFn: () => fetchData({ data: { semanaInicio: inicio } }),
  });

  const data = q.data;

  const gruposFiltrados = useMemo(() => {
    if (!data) return [];
    if (!soloPendiente) return data.grupos;
    return data.grupos
      .map((g) => ({
        ...g,
        conceptos: g.conceptos.filter((c) => c.devengado - c.pagado > 0.01),
      }))
      .filter((g) => g.conceptos.length > 0);
  }, [data, soloPendiente]);

  const goPrev = () => setWeekStart((d) => addDays(d, -7));
  const goNext = () => setWeekStart((d) => addDays(d, 7));
  const goHoy = () => setWeekStart(startOfWeekLunes(new Date()));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Condensado semanal de gastos</h1>
        <p className="text-sm text-muted-foreground">
          Vista consolidada de gastos devengados y pagados de todas las obras y oficina.
        </p>
      </header>

      {/* Selector de semana */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">
                Semana {isoWeekNumber(weekStart)} · {formatRangoSemana(inicio, fin)}
              </div>
              <div className="text-xs text-muted-foreground">Lunes a domingo</div>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={goNext} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goHoy} className="ml-1">Hoy</Button>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="solo-pendiente"
            checked={soloPendiente}
            onCheckedChange={(v) => setSoloPendiente(Boolean(v))}
          />
          <Label htmlFor="solo-pendiente" className="text-sm cursor-pointer">
            Solo conceptos con saldo pendiente
          </Label>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Devengado</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {data ? formatMXN(data.totales.devengado) : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Pagado</div>
          <div className="text-2xl font-semibold tabular-nums mt-1">
            {data ? formatMXN(data.totales.pagado) : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Pendiente de pago</div>
          <div className="text-2xl font-semibold tabular-nums mt-1 text-amber-600 dark:text-amber-500">
            {data ? formatMXN(data.totales.pendiente) : "—"}
          </div>
        </Card>
      </div>

      {/* Loading / error / empty */}
      {q.isLoading && (
        <Card className="p-6 text-center text-muted-foreground">Cargando…</Card>
      )}
      {q.isError && (
        <Card className="p-6 text-center text-destructive">
          Error al cargar: {(q.error as any)?.message ?? "desconocido"}
        </Card>
      )}
      {data && gruposFiltrados.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">
          No hay gastos registrados en esta semana.
        </Card>
      )}

      {/* Grupos por obra / oficina */}
      {data && gruposFiltrados.length > 0 && (
        <Accordion type="multiple" defaultValue={gruposFiltrados.map((g) => g.obra_id ?? "oficina")} className="space-y-2">
          {gruposFiltrados.map((g) => {
            const key = g.obra_id ?? "oficina";
            return (
              <AccordionItem key={key} value={key} className="border rounded-md bg-card">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-4 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {g.obra_id === null && <Badge variant="secondary">Oficina</Badge>}
                      <span className="font-medium truncate">{g.obra_nombre}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0 tabular-nums">
                      <span className="text-muted-foreground">
                        Deveng. <span className="font-medium text-foreground">{formatMXN(g.devengado)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Pagado <span className="font-medium text-foreground">{formatMXN(g.pagado)}</span>
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {/* Subtotales por concepto */}
                  <div className="rounded border overflow-hidden mb-3">
                    <Table className="table-fixed w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Concepto</TableHead>
                          <TableHead className="w-32 text-right">Devengado</TableHead>
                          <TableHead className="w-32 text-right">Pagado</TableHead>
                          <TableHead className="w-32 text-right">Pendiente</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.conceptos.map((c) => {
                          const pend = Math.round((c.devengado - c.pagado) * 100) / 100;
                          return (
                            <TableRow key={c.tipo}>
                              <TableCell><TruncatedCell>{c.label}</TruncatedCell></TableCell>
                              <TableCell className="text-right tabular-nums">{formatMXN(c.devengado)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatMXN(c.pagado)}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                <span className={pend > 0 ? "text-amber-600 dark:text-amber-500" : ""}>
                                  {formatMXN(pend)}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Detalle */}
                  <details className="group">
                    <summary className="text-sm cursor-pointer text-primary hover:underline list-none">
                      <span className="group-open:hidden">Ver detalle ▾</span>
                      <span className="hidden group-open:inline">Ocultar detalle ▴</span>
                    </summary>
                    <div className="mt-2 rounded border overflow-hidden">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Fecha</TableHead>
                            <TableHead className="w-28">Folio</TableHead>
                            <TableHead className="w-32">Concepto</TableHead>
                            <TableHead>Detalle</TableHead>
                            <TableHead className="w-40">Beneficiario</TableHead>
                            <TableHead className="w-28 text-right">Devengado</TableHead>
                            <TableHead className="w-28 text-right">Pagado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.conceptos.flatMap((c) =>
                            c.items.map((it) => (
                              <TableRow key={it.id}>
                                <TableCell><TruncatedCell>{formatFechaCorta(it.fecha)}</TruncatedCell></TableCell>
                                <TableCell><TruncatedCell>{it.folio ?? "—"}</TruncatedCell></TableCell>
                                <TableCell><TruncatedCell>{c.label}</TruncatedCell></TableCell>
                                <TableCell><TruncatedCell>{it.concepto || "—"}</TruncatedCell></TableCell>
                                <TableCell><TruncatedCell>{it.beneficiario ?? "—"}</TruncatedCell></TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {it.devengado > 0 ? formatMXN(it.devengado) : "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {it.pagado > 0 ? formatMXN(it.pagado) : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
