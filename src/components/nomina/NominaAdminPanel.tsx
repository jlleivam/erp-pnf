import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPanelGlobalNomina, ajustarAsistenciaAdmin } from "@/lib/api/nominas.functions";
import { calcularSemana, formatRangoSemana, toISODate } from "@/lib/estimacion-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMXN, formatDateTime } from "@/lib/format";
import { AlertTriangle, ChevronLeft, ChevronRight, MessageSquare, Pencil, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
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

type AsistenciaPanel = {
  fecha: string;
  jornada: number;
  horas_extras: number;
  nota_extras: string | null;
  jornada_original: number | null;
  horas_extras_original: number | null;
  ajustado_at: string | null;
  ajuste_motivo: string | null;
};

type ObraPanel = {
  obra_id: string;
  nombre: string;
  nomina_id: string;
  renglon_id: string;
  estatus: string;
  dias: number;
  horas_extras: number;
  importe: number;
  asistencias: AsistenciaPanel[];
};

type TrabajadorPanel = {
  trabajador_id: string;
  nombre: string;
  puesto: string | null;
  sueldo_diario: number;
  dias_totales: number;
  horas_extras_totales: number;
  importe_total: number;
  obras: ObraPanel[];
  duplicados: { fecha: string; suma: number }[];
};

export function NominaAdminPanel() {
  const [semanaInicio, setSemanaInicio] = useState<string>(
    () => calcularSemana(new Date()).inicio,
  );
  const [filtroDup, setFiltroDup] = useState(false);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [verDetalleId, setVerDetalleId] = useState<string | null>(null);

  const fetchPanel = useServerFn(getPanelGlobalNomina);
  const panelQ = useQuery({
    queryKey: ["nomina-panel", semanaInicio],
    queryFn: () => fetchPanel({ data: { semanaInicio } }),
  });

  const semana = useMemo(() => calcularSemana(semanaInicio), [semanaInicio]);
  const trabajadores = (panelQ.data?.trabajadores ?? []) as TrabajadorPanel[];
  const obrasConNomina = panelQ.data?.obrasConNomina ?? 0;
  const puedeAjustar = !!panelQ.data?.puedeAjustar;

  const filtered = trabajadores.filter((t) => {
    if (filtroDup && t.duplicados.length === 0) return false;
    if (filtroNombre && !t.nombre.toLowerCase().includes(filtroNombre.toLowerCase())) return false;
    return true;
  });

  const totalImporte = trabajadores.reduce((s, t) => s + t.importe_total, 0);
  const totalDuplicados = trabajadores.filter((t) => t.duplicados.length > 0).length;
  const verDetalle = trabajadores.find((t) => t.trabajador_id === verDetalleId) ?? null;

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

      {totalDuplicados > 0 && (
        <Card className="p-3 border-destructive/50 bg-destructive/5">
          <p className="text-sm font-medium text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            {totalDuplicados} trabajador(es) con días duplicados. Esta semana no se puede enviar a
            pagos hasta cuadrarla.
          </p>
          {puedeAjustar && (
            <p className="text-xs text-muted-foreground mt-1">
              Abre el trabajador y ajusta la jornada por obra y día indicando el motivo.
            </p>
          )}
        </Card>
      )}

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
        <Card className="overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-2 whitespace-nowrap">Trabajador</th>
                <th className="text-center py-2 px-2 w-20 whitespace-nowrap">$/día</th>
                <th className="text-center py-2 px-2 w-12 whitespace-nowrap">Días</th>
                <th className="text-center py-2 px-2 w-14 whitespace-nowrap">HE</th>
                <th className="text-center py-2 px-2 whitespace-nowrap">Obras</th>
                <th className="text-center py-2 px-2 w-24 whitespace-nowrap">Importe</th>
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
                  onClick={() => setVerDetalleId(t.trabajador_id)}
                >
                  <td className="py-2 px-2 text-left">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {t.duplicados.length > 0 && (
                        <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                      )}
                      <span className="font-medium truncate">{t.nombre}</span>
                      {t.puesto && (
                        <span className="text-xs text-muted-foreground truncate">· {t.puesto}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums text-xs">
                    {formatMXN(t.sueldo_diario)}
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums">{t.dias_totales.toFixed(1)}</td>
                  <td className="py-2 px-2 text-center tabular-nums">
                    {t.horas_extras_totales.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-center min-w-0">
                    <div className="flex gap-1 overflow-hidden whitespace-nowrap justify-center">
                      {t.obras.map((o) => (
                        <Badge key={o.nomina_id} variant="secondary" className="text-[11px] shrink-0">
                          {o.nombre} ({o.dias.toFixed(1)})
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums font-medium whitespace-nowrap">
                    {formatMXN(t.importe_total)}
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
          semanaInicio={semanaInicio}
          puedeAjustar={puedeAjustar}
          onClose={() => setVerDetalleId(null)}
        />
      )}
    </div>
  );
}

function DetalleTrabajadorDialog({
  trabajador, dias, semanaInicio, puedeAjustar, onClose,
}: {
  trabajador: TrabajadorPanel;
  dias: string[];
  semanaInicio: string;
  puedeAjustar: boolean;
  onClose: () => void;
}) {
  const [editando, setEditando] = useState<{
    obra: ObraPanel;
    fecha: string;
    asistencia: AsistenciaPanel | null;
  } | null>(null);

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

        {trabajador.duplicados.length > 0 ? (
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
        ) : (
          <Card className="p-3 border-primary/30 bg-primary/5">
            <p className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              Semana cuadrada: ningún día excede una jornada.
            </p>
          </Card>
        )}

        {puedeAjustar && (
          <p className="text-xs text-muted-foreground">
            Haz click en una celda para ajustar la jornada u horas extras de esa obra y día. Cada
            ajuste requiere motivo y queda registrado.
          </p>
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
                <th className="text-right p-2 w-20">HE</th>
                <th className="text-right p-2 w-24">Importe</th>
              </tr>
            </thead>
            <tbody>
              {trabajador.obras.map((o) => {
                const map = new Map(o.asistencias.map((a) => [a.fecha, a]));
                const editable = puedeAjustar && o.estatus !== "pagada";
                return (
                  <tr key={o.nomina_id} className="border-t border-border">
                    <td className="p-2 font-medium">{o.nombre}</td>
                    {dias.map((f) => {
                      const a = map.get(f) ?? null;
                      const ajustada = !!a?.ajustado_at;
                      const contenido = (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="inline-flex items-center gap-0.5">
                            {a && a.jornada > 0 ? a.jornada.toFixed(1) : "—"}
                            {ajustada && <Pencil className="size-2.5 text-primary" />}
                          </span>
                          {a && a.horas_extras > 0 && (
                            <span
                              className="text-[10px] text-primary inline-flex items-center gap-0.5"
                              title={a.nota_extras ?? "Sin nota"}
                            >
                              +{a.horas_extras}h
                              {a.nota_extras && <MessageSquare className="size-2.5 opacity-70" />}
                            </span>
                          )}
                        </div>
                      );
                      return (
                        <td
                          key={f}
                          className={cn(
                            "p-1 text-center tabular-nums text-xs",
                            editable && "cursor-pointer hover:bg-muted/50 rounded",
                            ajustada && "bg-primary/5",
                          )}
                          onClick={
                            editable
                              ? () => setEditando({ obra: o, fecha: f, asistencia: a })
                              : undefined
                          }
                        >
                          {ajustada ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>{contenido}</div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                <p>
                                  Ajustado {formatDateTime(a!.ajustado_at)} · antes{" "}
                                  {Number(a!.jornada_original ?? 0).toFixed(1)} jornada
                                  {a!.horas_extras_original
                                    ? ` / ${Number(a!.horas_extras_original).toFixed(1)}h extra`
                                    : ""}
                                </p>
                                <p className="mt-1 opacity-80">{a!.ajuste_motivo}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            contenido
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

        {editando && (
          <AjusteAsistenciaDialog
            obra={editando.obra}
            fecha={editando.fecha}
            asistencia={editando.asistencia}
            semanaInicio={semanaInicio}
            trabajadorNombre={trabajador.nombre}
            onClose={() => setEditando(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AjusteAsistenciaDialog({
  obra, fecha, asistencia, semanaInicio, trabajadorNombre, onClose,
}: {
  obra: ObraPanel;
  fecha: string;
  asistencia: AsistenciaPanel | null;
  semanaInicio: string;
  trabajadorNombre: string;
  onClose: () => void;
}) {
  const yaAjustada = !!asistencia?.ajustado_at;
  const [jornada, setJornada] = useState<number>(asistencia?.jornada ?? 0);
  const [horas, setHoras] = useState<string>(String(asistencia?.horas_extras ?? 0));
  const [motivo, setMotivo] = useState(asistencia?.ajuste_motivo ?? "");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const ajustar = useServerFn(ajustarAsistenciaAdmin);

  const horasNum = Number(horas) || 0;
  const valido = motivo.trim().length >= 5 && horasNum >= 0 && horasNum <= 24;

  async function guardar() {
    if (!valido) return;
    setSaving(true);
    try {
      await ajustar({
        data: {
          renglonId: obra.renglon_id,
          fecha,
          jornada,
          horasExtras: horasNum,
          motivo: motivo.trim(),
        },
      });
      await qc.invalidateQueries({ queryKey: ["nomina-panel", semanaInicio] });
      await qc.invalidateQueries({ queryKey: ["nomina-por-pagar"] });
      toast.success("Asistencia ajustada");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo ajustar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{yaAjustada ? "Editar ajuste" : "Ajustar asistencia"}</DialogTitle>
          <DialogDescription>
            {trabajadorNombre} · {obra.nombre} · {fecha}
          </DialogDescription>
        </DialogHeader>

        {yaAjustada && (
          <Card className="p-3 bg-muted/40 text-xs space-y-1">
            <p className="font-medium">
              Ajustado el {formatDateTime(asistencia!.ajustado_at)}
            </p>
            <p className="text-muted-foreground">
              Valores originales: {Number(asistencia!.jornada_original ?? 0).toFixed(1)} jornada ·{" "}
              {Number(asistencia!.horas_extras_original ?? 0).toFixed(1)} h extra
            </p>
            <p className="text-muted-foreground">
              Al guardar se actualiza este mismo ajuste (no se crea uno nuevo).
            </p>
          </Card>
        )}

        <div className="space-y-4">

          <div>
            <Label className="text-xs">Jornada</Label>
            <div className="flex gap-2 mt-1">
              {[0, 0.5, 1].map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={jornada === v ? "default" : "outline"}
                  onClick={() => setJornada(v)}
                >
                  {v === 0 ? "Falta" : v === 0.5 ? "Medio día" : "Día completo"}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Horas extras</Label>
            <Input
              type="number"
              min={0}
              max={24}
              step="0.5"
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">
              Motivo del ajuste <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. El trabajador estuvo medio día en esta obra; el resto en la otra."
              rows={3}
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Mínimo 5 caracteres.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!valido || saving}>
            {saving ? "Guardando…" : yaAjustada ? "Actualizar ajuste" : "Guardar ajuste"}
          </Button>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
