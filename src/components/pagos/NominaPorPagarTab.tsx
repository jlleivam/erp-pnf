import { Fragment, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listSemanasNominaPorPagar } from "@/lib/api/nominas.functions";
import { formatMXN, formatDate } from "@/lib/format";
import { PagarNominaSemanaSheet } from "./PagarNominaSemanaSheet";

export type ObraNominaEstado = {
  nomina_id: string | null;
  obra_id: string;
  obra_nombre: string;
  residente: string;
  estatus: "cerrada" | "borrador" | "sin_capturar";
  cerrada_at: string | null;
  monto: number;
};

export type SemanaNominaRow = {
  semana_inicio: string;
  semana_fin: string;
  total: number;
  total_borrador?: number;
  obras: ObraNominaEstado[];
  nomina_ids: string[];
  duplicados?: number;
  cerradas?: number;
  abiertas?: number;
  sin_capturar?: number;
};

function EstadoBadge({ estatus }: { estatus: ObraNominaEstado["estatus"] }) {
  if (estatus === "cerrada") {
    return <Badge variant="secondary" className="text-[11px]">Cerrada</Badge>;
  }
  if (estatus === "borrador") {
    return <Badge className="text-[11px] bg-edited text-edited-foreground border border-edited-border hover:bg-edited">Abierta</Badge>;
  }
  return <Badge variant="outline" className="text-[11px] text-muted-foreground">Sin capturar</Badge>;
}

export function NominaPorPagarTab() {
  const fetchSemanas = useServerFn(listSemanasNominaPorPagar);
  const [pagar, setPagar] = useState<SemanaNominaRow | null>(null);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});

  const q = useQuery({
    queryKey: ["nomina-por-pagar"],
    queryFn: () => fetchSemanas() as Promise<SemanaNominaRow[]>,
  });

  const rows = (q.data ?? []) as SemanaNominaRow[];
  const total = rows.reduce((s, r) => s + r.total, 0);
  const enCaptura = rows.reduce((s, r) => s + (r.total_borrador ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Monitor semanal de nóminas</h3>
          <p className="text-xs text-muted-foreground">
            Revisa si cada residente ya cerró su nómina. Sólo se pagan las nóminas cerradas; el
            remanente se distribuye como vale de efectivo, uno por obra.
          </p>
        </div>
        <div className="flex gap-2">
          <Card className="px-4 py-2">
            <p className="text-xs text-muted-foreground">Total por pagar</p>
            <p className="text-lg font-semibold">{formatMXN(total)}</p>
          </Card>
          <Card className="px-4 py-2">
            <p className="text-xs text-muted-foreground">En captura</p>
            <p className="text-lg font-semibold text-muted-foreground">{formatMXN(enCaptura)}</p>
          </Card>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Semana</TableHead>
              <TableHead>Estado obras</TableHead>
              <TableHead className="text-right">Total nómina</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            )}
            {!q.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  <Users className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin nóminas registradas.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const open = !!abiertas[r.semana_inicio];
              const cerradas = r.cerradas ?? 0;
              const dup = r.duplicados ?? 0;
              const pendientes = (r.abiertas ?? 0) + (r.sin_capturar ?? 0);
              const puedePagar = dup === 0 && cerradas > 0;
              return (
                <Fragment key={r.semana_inicio}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setAbiertas((s) => ({ ...s, [r.semana_inicio]: !open }))}
                  >
                    <TableCell className="w-8 text-muted-foreground">
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatDate(r.semana_inicio)} → {formatDate(r.semana_fin)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        <span className="whitespace-nowrap">
                          {cerradas} cerrada{cerradas === 1 ? "" : "s"} · {r.abiertas ?? 0} abierta
                          {(r.abiertas ?? 0) === 1 ? "" : "s"} · {r.sin_capturar ?? 0} sin capturar
                        </span>
                        {dup > 0 && (
                          <Badge variant="destructive" className="text-[11px] gap-1">
                            <AlertTriangle className="size-3" />
                            {dup} con duplicados
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-semibold">
                      {formatMXN(r.total)}
                      {(r.total_borrador ?? 0) > 0 && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          + {formatMXN(r.total_borrador ?? 0)} en captura
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {!puedePagar ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block">
                              <Button size="sm" disabled>Pagar semana</Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            {dup > 0
                              ? "Hay trabajadores con días duplicados. Cuadra la semana en Nómina → Panel global antes de pagar."
                              : "Ninguna nómina de la semana ha sido cerrada por el residente."}
                          </TooltipContent>
                        </Tooltip>
                      ) : pendientes > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              onClick={() =>
                                setPagar({ ...r, obras: r.obras.filter((o) => o.estatus === "cerrada") })
                              }
                            >
                              Pagar cerradas
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            {pendientes} obra{pendientes === 1 ? "" : "s"} sin cerrar quedarán fuera de
                            este pago.
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            setPagar({ ...r, obras: r.obras.filter((o) => o.estatus === "cerrada") })
                          }
                        >
                          Pagar semana
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                  {open && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={4} className="py-2">
                        <div className="space-y-1">
                          {r.obras.map((o) => (
                            <div
                              key={o.obra_id}
                              className="flex items-center justify-between gap-3 text-sm py-1 border-b last:border-0 border-border/50"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{o.obra_nombre}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Residente: {o.residente}
                                  {o.cerrada_at ? ` · Cerrada ${formatDate(o.cerrada_at)}` : ""}
                                </p>
                              </div>
                              <EstadoBadge estatus={o.estatus} />
                              <span className="w-28 text-right whitespace-nowrap tabular-nums">
                                {o.estatus === "sin_capturar" ? "—" : formatMXN(o.monto)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {pagar && (
        <PagarNominaSemanaSheet
          semana={pagar}
          open={!!pagar}
          onOpenChange={(o: boolean) => !o && setPagar(null)}
        />
      )}
    </div>
  );
}
