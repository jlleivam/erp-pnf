import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import {
  getEstadoResultadosSemana,
  getEstadoResultadosHistorico,
  type CostoCategoria,
  type DocumentoCosto,
} from "@/lib/api/estado-resultados.functions";
import { calcularSemana, formatRangoSemana, toISODate } from "@/lib/estimacion-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { formatMXN } from "@/lib/format";

const CATEGORIA_LABELS: Record<CostoCategoria, string> = {
  almacen: "Almacén (consumido)",
  nomina: "Nómina",
  destajos: "Destajos",
  subcontratos: "Subcontratos",
  rentas: "Rentas",
  gasolinas: "Gasolinas",
  cajaChica: "Caja chica",
};

const CATEGORIAS: CostoCategoria[] = [
  "almacen",
  "nomina",
  "destajos",
  "subcontratos",
  "rentas",
  "gasolinas",
  "cajaChica",
];

function shiftSemana(inicio: string, dias: number): string {
  const d = new Date(inicio + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return toISODate(d);
}

export function EstadoResultadosModule({ obraId }: { obraId: string }) {
  const semanaActual = useMemo(() => calcularSemana(new Date()), []);
  const [semanaInicio, setSemanaInicio] = useState<string>(semanaActual.inicio);
  const [detalleCat, setDetalleCat] = useState<CostoCategoria | "produccion" | null>(null);

  const fetchSemana = useServerFn(getEstadoResultadosSemana);
  const fetchHistorico = useServerFn(getEstadoResultadosHistorico);

  const semanaQ = useQuery({
    queryKey: ["estado-resultados", obraId, semanaInicio],
    queryFn: () => fetchSemana({ data: { obraId, semanaInicio } }),
  });

  const histQ = useQuery({
    queryKey: ["estado-resultados-hist", obraId],
    queryFn: () => fetchHistorico({ data: { obraId, semanas: 8 } }),
  });

  const semana = semanaQ.data;
  const rango = formatRangoSemana(semanaInicio, shiftSemana(semanaInicio, 6));

  const detalleDocs: DocumentoCosto[] =
    detalleCat === "produccion"
      ? semana?.produccion_detalle ?? []
      : detalleCat
        ? semana?.detalle[detalleCat] ?? []
        : [];
  const detalleTitulo =
    detalleCat === "produccion"
      ? "Producción ejercida"
      : detalleCat
        ? CATEGORIA_LABELS[detalleCat]
        : "";

  const acumulado = useMemo(() => {
    if (!histQ.data) return null;
    const hasta = histQ.data.filter((s) => s.semana_inicio <= semanaInicio);
    return hasta.reduce(
      (acc, s) => ({
        produccion: acc.produccion + s.produccion,
        costos: acc.costos + s.costos_total,
        resultado: acc.resultado + s.resultado,
      }),
      { produccion: 0, costos: 0, resultado: 0 },
    );
  }, [histQ.data, semanaInicio]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estado de resultados</h1>
          <p className="text-sm text-muted-foreground">
            Producción contra costos por semana
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSemanaInicio(shiftSemana(semanaInicio, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-sm font-medium px-3 min-w-[180px] text-center">{rango}</div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSemanaInicio(shiftSemana(semanaInicio, 7))}
            disabled={semanaInicio >= semanaActual.inicio}
            aria-label="Semana siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      {semanaQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !semana ? (
        <p className="text-sm text-destructive">No se pudo cargar el estado de resultados.</p>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="grid gap-4 sm:grid-cols-3">
            <button
              onClick={() => setDetalleCat("produccion")}
              className="text-left"
            >
              <Card className="p-4 border-l-4 border-l-emerald-500 hover:border-l-emerald-400 transition-colors">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Producción ejercida
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatMXN(semana.produccion)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {semana.produccion_detalle.length} estimación(es)
                </p>
              </Card>
            </button>

            <Card className="p-4 border-l-4 border-l-rose-500">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Costos totales
              </p>
              <p className="mt-2 text-2xl font-semibold text-rose-600 dark:text-rose-400">
                {formatMXN(semana.costos_total)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {semana.produccion > 0
                  ? `${((semana.costos_total / semana.produccion) * 100).toFixed(1)}% de producción`
                  : "—"}
              </p>
            </Card>

            <Card
              className={`p-4 border-l-4 ${
                semana.resultado >= 0 ? "border-l-emerald-500" : "border-l-rose-500"
              }`}
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Resultado
              </p>
              <p
                className={`mt-2 text-2xl font-semibold flex items-center gap-2 ${
                  semana.resultado >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {semana.resultado >= 0 ? (
                  <TrendingUp className="size-5" />
                ) : (
                  <TrendingDown className="size-5" />
                )}
                {formatMXN(semana.resultado)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Margen {(semana.margen * 100).toFixed(1)}%
              </p>
            </Card>
          </div>

          {/* Tabla por categoría */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium">Costos por categoría</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">% costo</TableHead>
                  <TableHead className="text-right">% producción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CATEGORIAS.map((cat) => {
                  const monto = semana.costos[cat];
                  const pctCosto = semana.costos_total > 0 ? (monto / semana.costos_total) * 100 : 0;
                  const pctProd = semana.produccion > 0 ? (monto / semana.produccion) * 100 : 0;
                  return (
                    <TableRow
                      key={cat}
                      className="cursor-pointer"
                      onClick={() => monto > 0 && setDetalleCat(cat)}
                    >
                      <TableCell className="font-medium">{CATEGORIA_LABELS[cat]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {monto > 0 ? formatMXN(monto) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {monto > 0 ? `${pctCosto.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {monto > 0 && semana.produccion > 0 ? `${pctProd.toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total costos</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMXN(semana.costos_total)}
                  </TableCell>
                  <TableCell className="text-right">100%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {semana.produccion > 0
                      ? `${((semana.costos_total / semana.produccion) * 100).toFixed(1)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>

          {/* Histórico 8 semanas */}
          {histQ.data && histQ.data.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-medium mb-3">Últimas 8 semanas</h2>
              <ClientOnly fallback={<div className="h-[220px]" />}>
                <ChartContainer
                  config={{
                    produccion: { label: "Producción", color: "hsl(142 71% 45%)" },
                    costos: { label: "Costos", color: "hsl(346 77% 50%)" },
                  }}
                  className="h-[220px] w-full"
                >
                  <BarChart
                    data={histQ.data.map((s) => ({
                      semana: s.semana_inicio.slice(5),
                      produccion: s.produccion,
                      costos: s.costos_total,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="semana" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} width={50} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <span>
                              <span className="text-muted-foreground mr-2">
                                {name === "produccion" ? "Producción" : "Costos"}:
                              </span>
                              {formatMXN(Number(value))}
                            </span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="produccion" fill="var(--color-produccion)" radius={4} />
                    <Bar dataKey="costos" fill="var(--color-costos)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </ClientOnly>
            </Card>
          )}

          {/* Acumulado */}
          {acumulado && (
            <Card className="p-4">
              <h2 className="text-sm font-medium mb-3">Acumulado de la obra (hasta esta semana)</h2>
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Producción
                  </p>
                  <p className="mt-1 text-lg font-semibold">{formatMXN(acumulado.produccion)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Costos</p>
                  <p className="mt-1 text-lg font-semibold">{formatMXN(acumulado.costos)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Resultado
                  </p>
                  <p
                    className={`mt-1 text-lg font-semibold ${
                      acumulado.resultado >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatMXN(acumulado.resultado)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Calculado sobre las últimas 8 semanas.
              </p>
            </Card>
          )}
        </>
      )}

      {/* Detalle por categoría */}
      <Sheet open={!!detalleCat} onOpenChange={(o) => !o && setDetalleCat(null)}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detalleTitulo}</SheetTitle>
            <SheetDescription>{rango}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {detalleDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin movimientos en esta semana.</p>
            ) : (
              detalleDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border border-border"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.titulo}</p>
                    {doc.estatus && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {doc.estatus}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm tabular-nums font-medium whitespace-nowrap">
                    {formatMXN(doc.monto)}
                  </p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
