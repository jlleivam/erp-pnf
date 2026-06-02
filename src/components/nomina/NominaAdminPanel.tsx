import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPanelGlobalNomina } from "@/lib/api/nominas.functions";
import { calcularSemana, formatRangoSemana, toISODate } from "@/lib/estimacion-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { formatMXN } from "@/lib/format";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function diasSemana(inicio: string): string[] {
  const out: string[] = [];
  const d = new Date(inicio + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    out.push(toISODate(x));
  }
  return out;
}

function shiftSemana(inicio: string, deltaDias: number): string {
  const d = new Date(inicio + "T12:00:00");
  d.setDate(d.getDate() + deltaDias);
  return calcularSemana(d).inicio;
}

type TrabajadorPanel = {
  trabajador_id: string;
  nombre: string;
  puesto: string | null;
  sueldo_diario: number;
  dias_totales: number;
  horas_extras_totales: number;
  importe_total: number;
  obras: {
    obra_id: string;
    nombre: string;
    nomina_id: string;
    dias: number;
    horas_extras: number;
    importe: number;
    asistencias: { fecha: string; jornada: number; horas_extras: number; nota_extras: string | null }[];
  }[];
  duplicados: { fecha: string; suma: number }[];
};

export function NominaAdminPanel() {
  const [semanaInicio, setSemanaInicio] = useState<string>(
    () => calcularSemana(new Date()).inicio,
  );
  const [filtroDup, setFiltroDup] = useState(false);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [verDetalle, setVerDetalle] = useState<TrabajadorPanel | null>(null);

  const fetchPanel = useServerFn(getPanelGlobalNomina);
  const panelQ = useQuery({
    queryKey: ["nomina-panel", semanaInicio],
    queryFn: () => fetchPanel({ data: { semanaInicio } }),
  });

  const semana = useMemo(() => calcularSemana(semanaInicio), [semanaInicio]);
  const trabajadores = (panelQ.data?.trabajadores ?? []) as TrabajadorPanel[];
  const obrasConNomina = panelQ.data?.obrasConNomina ?? 0;

  const filtered = trabajadores.filter((t) => {
    if (filtroDup && t.duplicados.length === 0) return false;
    if (filtroNombre && !t.nombre.toLowerCase().includes(filtroNombre.toLowerCase())) return false;
    return true;
  });

  const totalImporte = trabajadores.reduce((s, t) => s + t.importe_total, 0);
  const totalDuplicados = trabajadores.filter((t) => t.duplicados.length > 0).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nómina — Panel global</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vista consolidada de todos los trabajadores de la semana, cruzando obras.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSemanaInicio(shiftSemana(semanaInicio, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={semanaInicio}
            onChange={(e) => e.target.value && setSemanaInicio(calcularSemana(e.target.value).inicio)}
            className="w-44"
          />
          <Button variant="outline" size="sm" onClick={() => setSemanaInicio(shiftSemana(semanaInicio, 7))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSemanaInicio(calcularSemana(new Date()).inicio)}>
            Hoy
          </Button>
        </div>
      </header>

      <Card className="p-3 bg-muted/30">
        <p className="text-sm">
          Semana <span className="font-medium">{formatRangoSemana(semana.inicio, semana.fin)}</span>
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Trabajadores</p>
          <p className="mt-2 text-xl font-semibold">{trabajadores.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Obras con nómina</p>
          <p className="mt-2 text-xl font-semibold">{obrasConNomina}</p>
        </Card>
        <Card className={cn("p-4", totalDuplicados > 0 && "border-destructive/50 bg-destructive/5")}>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Con duplicados</p>
          <p className="mt-2 text-xl font-semibold">{totalDuplicados}</p>
        </Card>
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total a pagar</p>
          <p className="mt-2 text-xl font-semibold">{formatMXN(totalImporte)}</p>
        </Card>
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Buscar</Label>
          <Input
            placeholder="Nombre del trabajador…"
            value={filtroNombre}
            onChange={(e) => setFiltroNombre(e.target.value)}
          />
        </div>
        <Button
          variant={filtroDup ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltroDup((v) => !v)}
        >
          <AlertTriangle className="size-4 mr-1" />
          Solo duplicados
        </Button>
      </div>

      {panelQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
          {trabajadores.length === 0
            ? "Aún no hay asistencia capturada esta semana."
            : "Ningún trabajador coincide con los filtros."}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Trabajador</th>
                <th className="text-right p-3 w-28">Sueldo/día</th>
                <th className="text-right p-3 w-20">Días</th>
                <th className="text-right p-3 w-20">Extras h</th>
                <th className="text-left p-3">Obras</th>
                <th className="text-right p-3 w-32">Importe</th>
                <th className="text-center p-3 w-24">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.trabajador_id}
                  className={cn(
                    "border-t border-border hover:bg-muted/30 cursor-pointer",
                    t.duplicados.length > 0 && "bg-destructive/5",
                  )}
                  onClick={() => setVerDetalle(t)}
                >
                  <td className="p-3">
                    <div className="font-medium">{t.nombre}</div>
                    {t.puesto && (
                      <div className="text-xs text-muted-foreground">{t.puesto}</div>
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums text-xs">
                    {formatMXN(t.sueldo_diario)}
                  </td>
                  <td className="p-3 text-right tabular-nums">{t.dias_totales.toFixed(1)}</td>
                  <td className="p-3 text-right tabular-nums">
                    {t.horas_extras_totales.toFixed(1)}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {t.obras.map((o) => (
                        <Badge key={o.nomina_id} variant="secondary" className="text-xs">
                          {o.nombre} ({o.dias.toFixed(1)})
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right tabular-nums font-medium">
                    {formatMXN(t.importe_total)}
                  </td>
                  <td className="p-3 text-center">
                    {t.duplicados.length > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="size-3" /> {t.duplicados.length}
                      </Badge>
                    ) : (
                      <Badge variant="outline">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {verDetalle && (
        <DetalleTrabajadorDialog
          trabajador={verDetalle}
          dias={diasSemana(semanaInicio)}
          onClose={() => setVerDetalle(null)}
        />
      )}
    </div>
  );
}

function DetalleTrabajadorDialog({
  trabajador, dias, onClose,
}: {
  trabajador: TrabajadorPanel;
  dias: string[];
  onClose: () => void;
}) {
  // sumar por fecha entre obras
  const sumaPorFecha = new Map<string, number>();
  for (const o of trabajador.obras) {
    for (const a of o.asistencias) {
      sumaPorFecha.set(a.fecha, (sumaPorFecha.get(a.fecha) ?? 0) + a.jornada);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{trabajador.nombre}</DialogTitle>
          <DialogDescription>
            {trabajador.puesto ?? "—"} · Sueldo {formatMXN(trabajador.sueldo_diario)}/día
          </DialogDescription>
        </DialogHeader>

        {trabajador.duplicados.length > 0 && (
          <Card className="p-3 border-destructive/50 bg-destructive/5">
            <p className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {trabajador.duplicados.length} día(s) con suma de jornada mayor a 1.0
            </p>
            <ul className="text-xs text-muted-foreground mt-1 list-disc ml-5">
              {trabajador.duplicados.map((d) => (
                <li key={d.fecha}>
                  {d.fecha}: {d.suma.toFixed(1)} jornadas
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-2">Obra</th>
                {dias.map((f, i) => (
                  <th key={f} className="text-center p-1 w-14">
                    <div>{DOW[i]}</div>
                    <div className="text-[10px] font-normal opacity-70">{f.slice(8)}</div>
                  </th>
                ))}
                <th className="text-right p-2 w-20">Días</th>
                <th className="text-right p-2 w-20">Extras h</th>
                <th className="text-right p-2 w-24">Importe</th>
              </tr>
            </thead>
            <tbody>
              {trabajador.obras.map((o) => {
                const map = new Map(o.asistencias.map((a) => [a.fecha, a]));
                return (
                  <tr key={o.nomina_id} className="border-t border-border">
                    <td className="p-2 font-medium">{o.nombre}</td>
                    {dias.map((f) => {
                      const a = map.get(f);
                      return (
                        <td key={f} className="p-1 text-center tabular-nums text-xs">
                          {a && a.jornada > 0 ? a.jornada.toFixed(1) : "—"}
                          {a && a.horas_extras > 0 && (
                            <div
                              className="text-[10px] text-primary inline-flex items-center gap-0.5 cursor-help"
                              title={a.nota_extras ?? "Sin nota"}
                            >
                              +{a.horas_extras}h
                              {a.nota_extras && <MessageSquare className="size-2.5 opacity-70" />}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-right tabular-nums">{o.dias.toFixed(1)}</td>
                    <td className="p-2 text-right tabular-nums">{o.horas_extras.toFixed(1)}</td>
                    <td className="p-2 text-right tabular-nums">{formatMXN(o.importe)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border font-medium bg-muted/30">
                <td className="p-2">Suma diaria</td>
                {dias.map((f) => {
                  const s = sumaPorFecha.get(f) ?? 0;
                  const dup = s > 1.0001;
                  return (
                    <td
                      key={f}
                      className={cn(
                        "p-1 text-center tabular-nums text-xs",
                        dup && "text-destructive font-semibold",
                      )}
                    >
                      {s > 0 ? s.toFixed(1) : "—"}
                    </td>
                  );
                })}
                <td className="p-2 text-right tabular-nums">{trabajador.dias_totales.toFixed(1)}</td>
                <td className="p-2 text-right tabular-nums">
                  {trabajador.horas_extras_totales.toFixed(1)}
                </td>
                <td className="p-2 text-right tabular-nums">
                  {formatMXN(trabajador.importe_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
