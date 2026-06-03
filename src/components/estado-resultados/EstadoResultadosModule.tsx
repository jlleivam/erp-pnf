import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import {
  getEstadoResultadosSemana,
  getEstadoResultadosHistorico,
  getEstadoResultadosAcumulado,
  getObraSemanaBoundaries,
  type CostoCategoria,
  type DocumentoCosto,
  type ConceptoDetalle,
} from "@/lib/api/estado-resultados.functions";
import { calcularSemana, formatRangoSemana, numeroSemanaObra, rangoSemanaObra, toISODate } from "@/lib/estimacion-utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  const [modo, setModo] = useState<"semana" | "global">("semana");
  const [semanaInicio, setSemanaInicio] = useState<string>(semanaActual.inicio);

  const fetchSemana = useServerFn(getEstadoResultadosSemana);
  const fetchHistorico = useServerFn(getEstadoResultadosHistorico);
  const fetchAcumulado = useServerFn(getEstadoResultadosAcumulado);
  const fetchBoundaries = useServerFn(getObraSemanaBoundaries);

  const boundariesQ = useQuery({
    queryKey: ["obra-semana-boundaries", obraId],
    queryFn: () => fetchBoundaries({ data: { obraId } }),
  });

  const semanaQ = useQuery({
    queryKey: ["estado-resultados", obraId, semanaInicio],
    queryFn: () => fetchSemana({ data: { obraId, semanaInicio } }),
    enabled: modo === "semana",
  });

  const acumQ = useQuery({
    queryKey: ["estado-resultados-acum", obraId],
    queryFn: () => fetchAcumulado({ data: { obraId } }),
    enabled: modo === "global",
  });

  const histQ = useQuery({
    queryKey: ["estado-resultados-hist", obraId],
    queryFn: () => fetchHistorico({ data: { obraId, semanas: 8 } }),
  });

  const activeQ = modo === "semana" ? semanaQ : acumQ;
  const semana = activeQ.data;
  const fechaInicio = boundariesQ.data?.fechaInicio;
  const primerSemana = boundariesQ.data?.primerSemana;
  const numActual = fechaInicio
    ? numeroSemanaObra(fechaInicio, semanaActual.inicio)
    : 0;
  const numSeleccion = fechaInicio
    ? numeroSemanaObra(fechaInicio, semanaInicio)
    : 0;
  const rango =
    modo === "semana"
      ? fechaInicio
        ? `Semana ${numSeleccion} · ${rangoSemanaObra(fechaInicio, semanaInicio)}`
        : formatRangoSemana(semanaInicio, shiftSemana(semanaInicio, 6))
      : fechaInicio
        ? `Acumulado · Semanas 1–${numActual} hasta hoy`
        : "Acumulado de la obra";

  const puedeAnterior =
    modo === "semana" && (!primerSemana || semanaInicio > primerSemana);
  const puedeSiguiente =
    modo === "semana" && semanaInicio < semanaActual.inicio;

  const acumulado = useMemo(() => {
    if (modo !== "semana" || !histQ.data) return null;
    const hasta = histQ.data.filter((s) => s.semana_inicio <= semanaInicio);
    return hasta.reduce(
      (acc, s) => ({
        produccion: acc.produccion + s.produccion,
        costos: acc.costos + s.costos_total,
        resultado: acc.resultado + s.resultado,
      }),
      { produccion: 0, costos: 0, resultado: 0 },
    );
  }, [histQ.data, semanaInicio, modo]);


  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Estado de resultados</h1>
          <p className="text-sm text-muted-foreground">
            Producción contra costos · {modo === "semana"
              ? fechaInicio ? `Semana ${numSeleccion} de la obra` : "semana seleccionada"
              : "acumulado de la obra"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ToggleGroup
            type="single"
            value={modo}
            onValueChange={(v) => v && setModo(v as "semana" | "global")}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
            <ToggleGroupItem value="global">Global</ToggleGroupItem>
          </ToggleGroup>

          {modo === "semana" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSemanaInicio(shiftSemana(semanaInicio, -7))}
                disabled={!puedeAnterior}
                aria-label="Semana anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="text-sm font-medium px-3 min-w-[260px] text-center">{rango}</div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSemanaInicio(shiftSemana(semanaInicio, 7))}
                disabled={!puedeSiguiente}
                aria-label="Semana siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{rango}</div>
          )}
        </div>
      </header>

      {activeQ.isLoading ? (

        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !semana ? (
        <p className="text-sm text-destructive">No se pudo cargar el estado de resultados.</p>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4 border-l-4 border-l-emerald-500">
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
          {/* Producción y categorías de costo (acordeón inline) */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-medium">Desglose de la semana</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Expande cada categoría para ver documentos y conceptos.
              </p>
            </div>
            <Accordion type="multiple" className="divide-y divide-border">
              {/* Producción */}
              <CategoriaAccordion
                value="produccion"
                label="Producción ejercida"
                monto={semana.produccion}
                pctCosto={null}
                pctProd={null}
                accent="emerald"
                docs={semana.produccion_detalle}
              />
              {/* Categorías de costo */}
              {CATEGORIAS.map((cat) => {
                const monto = semana.costos[cat];
                const pctCosto =
                  semana.costos_total > 0 ? (monto / semana.costos_total) * 100 : 0;
                const pctProd =
                  semana.produccion > 0 ? (monto / semana.produccion) * 100 : 0;
                return (
                  <CategoriaAccordion
                    key={cat}
                    value={cat}
                    label={CATEGORIA_LABELS[cat]}
                    monto={monto}
                    pctCosto={monto > 0 ? pctCosto : null}
                    pctProd={monto > 0 && semana.produccion > 0 ? pctProd : null}
                    accent="rose"
                    docs={semana.detalle[cat]}
                  />
                );
              })}
              {/* Total costos (no expandible) */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 font-semibold text-sm bg-muted/30">
                <div>Total costos</div>
                <div className="tabular-nums text-right min-w-[110px]">
                  {formatMXN(semana.costos_total)}
                </div>
                <div className="tabular-nums text-right text-muted-foreground min-w-[60px]">
                  100%
                </div>
                <div className="tabular-nums text-right text-muted-foreground min-w-[70px]">
                  {semana.produccion > 0
                    ? `${((semana.costos_total / semana.produccion) * 100).toFixed(1)}%`
                    : "—"}
                </div>
              </div>
            </Accordion>
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
                      semana: fechaInicio
                        ? `S${numeroSemanaObra(fechaInicio, s.semana_inicio)}`
                        : s.semana_inicio.slice(5),
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
              <h2 className="text-sm font-medium mb-3">
                Acumulado de la obra{fechaInicio ? ` (Semanas 1–${numSeleccion})` : " (hasta esta semana)"}
              </h2>
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

    </div>
  );
}

function CategoriaAccordion({
  value,
  label,
  monto,
  pctCosto,
  pctProd,
  accent,
  docs,
}: {
  value: string;
  label: string;
  monto: number;
  pctCosto: number | null;
  pctProd: number | null;
  accent: "emerald" | "rose";
  docs: DocumentoCosto[];
}) {
  const disabled = monto <= 0;
  const accentClass =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <AccordionItem value={value} className="border-0" disabled={disabled}>
      <AccordionTrigger
        className="px-4 py-3 hover:no-underline data-[disabled]:opacity-60 data-[disabled]:cursor-default"
        disabled={disabled}
      >
        <div className="flex-1 grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 pr-2 text-sm">
          <div className="font-medium text-left">{label}</div>
          <div className={`tabular-nums text-right min-w-[110px] ${monto > 0 ? accentClass : "text-muted-foreground"}`}>
            {monto > 0 ? formatMXN(monto) : "—"}
          </div>
          <div className="tabular-nums text-right text-muted-foreground min-w-[60px]">
            {pctCosto != null ? `${pctCosto.toFixed(1)}%` : "—"}
          </div>
          <div className="tabular-nums text-right text-muted-foreground min-w-[70px]">
            {pctProd != null ? `${pctProd.toFixed(1)}%` : "—"}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-0 bg-muted/20">
        <DocumentosLista docs={docs} />
      </AccordionContent>
    </AccordionItem>
  );
}


function DocumentosLista({ docs }: { docs: DocumentoCosto[] }) {
  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin movimientos en esta semana.</p>;
  }
  // Si ningún documento tiene conceptos, mostrar lista plana
  const conConceptos = docs.some((d) => d.conceptos && d.conceptos.length > 0);
  if (!conConceptos) {
    return (
      <div className="space-y-2">
        {docs.map((doc) => (
          <DocumentoFlat key={doc.id} doc={doc} />
        ))}
      </div>
    );
  }
  return (
    <Accordion type="multiple" className="space-y-2">
      {docs.map((doc) => {
        const hasConceptos = (doc.conceptos?.length ?? 0) > 0;
        if (!hasConceptos) {
          return (
            <div key={doc.id}>
              <DocumentoFlat doc={doc} />
            </div>
          );
        }
        return (
          <AccordionItem
            key={doc.id}
            value={doc.id}
            className="border border-border rounded-md px-3"
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex-1 flex items-start justify-between gap-3 min-w-0 pr-2">
                <div className="min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{doc.titulo}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {doc.estatus && (
                      <Badge variant="outline" className="text-xs">
                        {doc.estatus}
                      </Badge>
                    )}
                    {doc.meta && (
                      <span className="text-xs text-muted-foreground truncate">{doc.meta}</span>
                    )}
                  </div>
                </div>
                <p className="text-sm tabular-nums font-medium whitespace-nowrap">
                  {formatMXN(doc.monto)}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <ConceptosTabla items={doc.conceptos!} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function DocumentoFlat({ doc }: { doc: DocumentoCosto }) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-md border border-border">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{doc.titulo}</p>
        <div className="flex items-center gap-2 mt-1">
          {doc.estatus && (
            <Badge variant="outline" className="text-xs">
              {doc.estatus}
            </Badge>
          )}
          {doc.meta && (
            <span className="text-xs text-muted-foreground truncate">{doc.meta}</span>
          )}
        </div>
      </div>
      <p className="text-sm tabular-nums font-medium whitespace-nowrap">
        {formatMXN(doc.monto)}
      </p>
    </div>
  );
}

function ConceptosTabla({ items }: { items: ConceptoDetalle[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin conceptos.</p>;
  }
  const showCantidad = items.some(
    (i) => i.cantidad != null && i.cantidad !== 0,
  );
  const showPU = items.some(
    (i) => i.precio_unitario != null && i.precio_unitario !== 0,
  );
  return (
    <div className="overflow-x-auto -mx-3">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left font-normal py-1.5 px-3">Concepto</th>
            {showCantidad && <th className="text-right font-normal py-1.5 px-2">Cant.</th>}
            {showPU && <th className="text-right font-normal py-1.5 px-2">P.U.</th>}
            <th className="text-right font-normal py-1.5 px-3">Importe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="border-b border-border/50 last:border-b-0">
              <td className="py-1.5 px-3">
                <div className="font-medium">{c.descripcion}</div>
                {c.meta && (
                  <div className="text-[10px] text-muted-foreground">{c.meta}</div>
                )}
              </td>
              {showCantidad && (
                <td className="text-right tabular-nums py-1.5 px-2">
                  {c.cantidad != null
                    ? `${c.cantidad}${c.unidad ? ` ${c.unidad}` : ""}`
                    : "—"}
                </td>
              )}
              {showPU && (
                <td className="text-right tabular-nums py-1.5 px-2 text-muted-foreground">
                  {c.precio_unitario != null ? formatMXN(c.precio_unitario) : "—"}
                </td>
              )}
              <td className="text-right tabular-nums py-1.5 px-3 font-medium">
                {formatMXN(c.monto)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
