import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrCreateNomina,
  listTrabajadoresDisponibles,
  asignarTrabajadores,
  guardarAsistencia,
  cerrarNomina,
} from "@/lib/api/nominas.functions";
import { getTrabajadoresBloqueadosPorDestajo } from "@/lib/api/destajos.functions";
import { formatRangoSemana } from "@/lib/estimacion-utils";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";
import { UserPlus, Lock, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrabajadorFormDialog } from "@/components/trabajadores/TrabajadorFormDialog";
import { useEffectiveRoles } from "@/stores/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function diasSemana(inicio: string): string[] {
  const out: string[] = [];
  const d = new Date(inicio + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const dd = String(x.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${dd}`);
  }
  return out;
}

type Renglon = {
  id: string;
  trabajador_id: string;
  sueldo_diario_snapshot: number;
  dias_trabajados: number;
  horas_extras_total: number;
  importe_jornadas: number;
  importe_extras: number;
  importe_total: number;
  trabajador: { id: string; nombre_completo: string; puesto: string | null; sueldo_diario: number } | null;
};

type Asistencia = {
  id: string;
  renglon_id: string;
  fecha: string;
  jornada: number;
  horas_extras: number;
  nota_extras: string | null;
};

export function CapturaNominaSheet({
  obraId, semanaInicio, readOnly, onClose, onChanged,
}: {
  obraId: string;
  semanaInicio: string;
  readOnly?: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const fetchNomina = useServerFn(getOrCreateNomina);
  const nominaQ = useQuery({
    queryKey: ["nomina", obraId, semanaInicio],
    queryFn: () => fetchNomina({ data: { obraId, semanaInicio } }),
  });
  const fetchBloqueados = useServerFn(getTrabajadoresBloqueadosPorDestajo);
  const bloqueadosQ = useQuery({
    queryKey: ["nomina-bloqueados-destajo", obraId],
    queryFn: () => fetchBloqueados({ data: { obraId } }),
  });
  const bloqueadosMap = useMemo(() => {
    const m = new Map<string, { destajo_id: string; destajo_nombre: string }>();
    for (const b of (bloqueadosQ.data ?? []) as Array<{
      trabajador_id: string;
      destajo_id: string;
      destajo_nombre: string;
    }>) {
      m.set(b.trabajador_id, { destajo_id: b.destajo_id, destajo_nombre: b.destajo_nombre });
    }
    return m;
  }, [bloqueadosQ.data]);

  const [asignarOpen, setAsignarOpen] = useState(false);
  const [confirmCerrar, setConfirmCerrar] = useState(false);

  const cerrar = useServerFn(cerrarNomina);
  const cerrarM = useMutation({
    mutationFn: cerrar,
    onSuccess: () => {
      toast.success("Nómina cerrada");
      onChanged();
      qc.invalidateQueries({ queryKey: ["nomina", obraId, semanaInicio] });
      setConfirmCerrar(false);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = nominaQ.data;
  const nomina = data?.nomina;
  const renglones = (data?.renglones ?? []) as Renglon[];
  const asistencias = (data?.asistencias ?? []) as Asistencia[];
  const isClosed = readOnly || nomina?.estatus === "cerrada";
  const dias = useMemo(() => diasSemana(semanaInicio), [semanaInicio]);

  const asistMap = useMemo(() => {
    const m = new Map<string, Asistencia>();
    for (const a of asistencias) m.set(`${a.renglon_id}|${a.fecha}`, a);
    return m;
  }, [asistencias]);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[1100px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle>Nómina semanal</SheetTitle>
            {isClosed && (
              <Badge variant="default" className="gap-1">
                <Lock className="size-3" /> Cerrada
              </Badge>
            )}
          </div>
          <SheetDescription>
            {nomina && formatRangoSemana(nomina.semana_inicio, nomina.semana_fin)}
          </SheetDescription>
        </SheetHeader>

        {nominaQ.isLoading ? (
          <p className="text-sm text-muted-foreground mt-6">Cargando…</p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Trabajadores</p>
                <p className="text-lg font-semibold">{renglones.length}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Días totales</p>
                <p className="text-lg font-semibold tabular-nums">
                  {renglones.reduce((s, r) => s + Number(r.dias_trabajados), 0).toFixed(1)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Horas extras</p>
                <p className="text-lg font-semibold tabular-nums">
                  {renglones.reduce((s, r) => s + Number(r.horas_extras_total), 0).toFixed(1)}
                </p>
              </Card>
              <Card className="p-3 border-primary/30 bg-primary/5">
                <p className="text-xs text-muted-foreground">Monto semana</p>
                <p className="text-lg font-semibold">
                  {formatMXN(Number(nomina?.monto_total ?? 0))}
                </p>
              </Card>
            </div>

            {!isClosed && (
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setAsignarOpen(true)}>
                  <UserPlus className="size-4 mr-1" /> Asignar trabajadores
                </Button>
                <Button onClick={() => setConfirmCerrar(true)} disabled={renglones.length === 0}>
                  Cerrar semana
                </Button>
              </div>
            )}

            {renglones.length === 0 ? (
              <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
                Aún no hay trabajadores asignados a esta semana.
              </Card>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left p-2 min-w-[200px]">Trabajador</th>
                      <th className="text-right p-2">Sueldo/día</th>
                      {dias.map((f, i) => (
                        <th key={f} className="text-center p-1 w-20">
                          <div>{DOW[i]}</div>
                          <div className="text-[10px] font-normal opacity-70">
                            {f.slice(8)}/{f.slice(5, 7)}
                          </div>
                        </th>
                      ))}
                      <th className="text-right p-2 w-20">Días</th>
                      <th className="text-right p-2 w-20">Extras h</th>
                      <th className="text-right p-2 w-28">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renglones.map((r) => {
                      const bloq = bloqueadosMap.get(r.trabajador_id);
                      const filaBloqueada = !!bloq;
                      return (
                      <tr key={r.id} className={cn("border-t border-border", filaBloqueada && "bg-muted/30")}>
                        <td className="p-2">
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            {r.trabajador?.nombre_completo ?? "—"}
                            {bloq && (
                              <Badge
                                variant="outline"
                                className="gap-1"
                                title={`Pago por destajo: ${bloq.destajo_nombre}`}
                              >
                                <Lock className="size-3" /> Destajo: {bloq.destajo_nombre}
                              </Badge>
                            )}
                          </div>
                          {r.trabajador?.puesto && (
                            <div className="text-xs text-muted-foreground">
                              {r.trabajador.puesto}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums text-xs">
                          {formatMXN(Number(r.sueldo_diario_snapshot))}
                        </td>
                        {dias.map((fecha) => {
                          const a = asistMap.get(`${r.id}|${fecha}`);
                          return (
                            <td key={fecha} className="p-1 text-center align-middle">
                              <DiaCell
                                renglonId={r.id}
                                fecha={fecha}
                                jornada={Number(a?.jornada ?? 0)}
                                horasExtras={Number(a?.horas_extras ?? 0)}
                                notaExtras={a?.nota_extras ?? null}
                                disabled={!!isClosed || filaBloqueada}
                                onSaved={() => {
                                  qc.invalidateQueries({
                                    queryKey: ["nomina", obraId, semanaInicio],
                                  });
                                  onChanged();
                                }}
                              />
                            </td>
                          );
                        })}
                        <td className="p-2 text-right tabular-nums">
                          {filaBloqueada ? "—" : Number(r.dias_trabajados).toFixed(1)}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {filaBloqueada ? "—" : Number(r.horas_extras_total).toFixed(1)}
                        </td>
                        <td className="p-2 text-right tabular-nums font-medium">
                          {filaBloqueada ? (
                            <span className="text-muted-foreground">vía destajo</span>
                          ) : (
                            formatMXN(Number(r.importe_total))
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}

        {asignarOpen && nomina && (
          <AsignarTrabajadoresDialog
            obraId={obraId}
            nominaId={nomina.id}
            semanaInicio={semanaInicio}
            asignadosActuales={renglones.map((r) => r.trabajador_id)}
            onClose={() => setAsignarOpen(false)}
            onSaved={() => {
              setAsignarOpen(false);
              qc.invalidateQueries({ queryKey: ["nomina", obraId, semanaInicio] });
              onChanged();
            }}
          />
        )}

        <AlertDialog open={confirmCerrar} onOpenChange={setConfirmCerrar}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cerrar la semana?</AlertDialogTitle>
              <AlertDialogDescription>
                Una vez cerrada la nómina no podrá editarse. Verifica la asistencia y los montos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => nomina && cerrarM.mutate({ data: { id: nomina.id } })}
              >
                Cerrar semana
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function DiaCell({
  renglonId, fecha, jornada, horasExtras, notaExtras, disabled, onSaved,
}: {
  renglonId: string;
  fecha: string;
  jornada: number;
  horasExtras: number;
  notaExtras: string | null;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [j, setJ] = useState(jornada);
  const [h, setH] = useState(horasExtras);
  const [nota, setNota] = useState(notaExtras ?? "");
  const [popOpen, setPopOpen] = useState(false);
  useEffect(() => { setJ(jornada); }, [jornada]);
  useEffect(() => { setH(horasExtras); }, [horasExtras]);
  useEffect(() => { setNota(notaExtras ?? ""); }, [notaExtras]);

  const guardar = useServerFn(guardarAsistencia);
  const save = useMutation({
    mutationFn: guardar,
    onSuccess: () => onSaved(),
    onError: (e: Error) => toast.error(e.message),
  });

  const commitJornada = (nj: number) => {
    if (nj === jornada) return;
    save.mutate({
      data: { renglonId, fecha, jornada: nj, horasExtras, notaExtras: notaExtras ?? null },
    });
  };

  const guardarExtras = () => {
    const notaLimpia = nota.trim();
    if (h > 0 && notaLimpia.length < 3) {
      toast.error("Captura una nota que explique el motivo de las horas extras.");
      return;
    }
    save.mutate(
      {
        data: {
          renglonId,
          fecha,
          jornada: j,
          horasExtras: h,
          notaExtras: h > 0 ? notaLimpia : null,
        },
      },
      { onSuccess: () => setPopOpen(false) },
    );
  };

  return (
    <div className="flex flex-col gap-1 items-center">
      <div className="inline-flex rounded-md border border-border overflow-hidden">
        {[
          { v: 0, label: "·" },
          { v: 0.5, label: "½" },
          { v: 1, label: "1" },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            disabled={disabled || save.isPending}
            onClick={() => {
              setJ(opt.v);
              commitJornada(opt.v);
            }}
            className={cn(
              "w-6 h-6 text-xs leading-none transition-colors",
              j === opt.v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <Popover
        open={popOpen}
        onOpenChange={(o) => {
          setPopOpen(o);
          if (o) {
            setH(horasExtras);
            setNota(notaExtras ?? "");
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "w-14 h-6 text-xs rounded border border-border bg-background hover:bg-muted",
              "inline-flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed",
              horasExtras > 0 && "border-primary/50 text-primary font-medium",
            )}
            title={notaExtras ?? undefined}
          >
            {horasExtras > 0 ? `+${horasExtras}h` : "+h"}
            {horasExtras > 0 && notaExtras && (
              <MessageSquare className="size-3 opacity-70" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="center">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Horas extras</Label>
              <Input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={h || ""}
                disabled={disabled || save.isPending}
                placeholder="0"
                onChange={(e) => setH(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Motivo {h > 0 && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                disabled={disabled || save.isPending || h === 0}
                placeholder="Explica por qué se pagan horas extras este día…"
                rows={3}
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground">
                Requerido cuando hay horas extras. Visible para el administrativo.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPopOpen(false)}
                disabled={save.isPending}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={guardarExtras} disabled={disabled || save.isPending}>
                Guardar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function AsignarTrabajadoresDialog({
  obraId, nominaId, semanaInicio, asignadosActuales, onClose, onSaved,
}: {
  obraId: string;
  nominaId: string;
  semanaInicio: string;
  asignadosActuales: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const roles = useEffectiveRoles();
  const canManage = roles.includes("director") || roles.includes("administrativo");
  const fetchDisp = useServerFn(listTrabajadoresDisponibles);
  const dispQ = useQuery({
    queryKey: ["trabajadores-disponibles", obraId, semanaInicio],
    queryFn: () => fetchDisp({ data: { obraId, semanaInicio } }),
  });
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set(asignadosActuales));
  const [filtro, setFiltro] = useState("");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [idsPrevios, setIdsPrevios] = useState<Set<string> | null>(null);

  const asignar = useServerFn(asignarTrabajadores);
  const asignarM = useMutation({
    mutationFn: asignar,
    onSuccess: () => {
      toast.success("Trabajadores actualizados");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = (dispQ.data ?? []) as any[];

  // Detecta trabajadores recién creados y los pre-selecciona (sólo si el usuario puede autorizar).
  useEffect(() => {
    const idsActuales = new Set<string>(lista.map((t) => t.id));
    if (idsPrevios === null) {
      setIdsPrevios(idsActuales);
      return;
    }
    if (!canManage) return;
    const nuevos: string[] = [];
    lista.forEach((t) => {
      if (!idsPrevios.has(t.id) && t.estatus_autorizacion !== "pendiente") nuevos.push(t.id);
    });
    if (nuevos.length > 0) {
      setSeleccionados((prev) => {
        const next = new Set(prev);
        nuevos.forEach((id) => next.add(id));
        return next;
      });
      setIdsPrevios(idsActuales);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.length]);

  const filtered = lista.filter((t) =>
    t.nombre_completo.toLowerCase().includes(filtro.toLowerCase()),
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar trabajadores a la semana</DialogTitle>
          <DialogDescription>
            Marca los trabajadores que estarán activos en esta obra durante la semana. Los que ya
            tienen asistencia capturada no se pueden quitar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por nombre…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={() => setNuevoOpen(true)}>
              <Plus className="size-4 mr-1" />
              {canManage ? "Nuevo" : "Solicitar alta"}
            </Button>
          </div>
          <Card className="max-h-[400px] overflow-y-auto divide-y">
            {dispQ.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sin resultados.</p>
            ) : (
              filtered.map((t) => {
                const checked = seleccionados.has(t.id);
                const isPendiente = t.estatus_autorizacion === "pendiente";
                return (
                  <Label
                    key={t.id}
                    className={`flex items-center gap-3 p-2 ${
                      isPendiente
                        ? "opacity-60 cursor-not-allowed"
                        : "cursor-pointer hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={isPendiente ? false : checked}
                      disabled={isPendiente}
                      onCheckedChange={(v) => {
                        if (isPendiente) return;
                        const next = new Set(seleccionados);
                        if (v) next.add(t.id); else next.delete(t.id);
                        setSeleccionados(next);
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        <span>{t.nombre_completo}</span>
                        {isPendiente && (
                          <Badge variant="secondary" className="text-[10px]">
                            Pendiente de registro
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.puesto ?? "—"} · {formatMXN(Number(t.sueldo_diario ?? 0))}/día
                      </div>
                    </div>
                  </Label>
                );
              })
            )}
          </Card>
          <p className="text-xs text-muted-foreground">
            {seleccionados.size} seleccionado(s)
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() =>
              asignarM.mutate({
                data: { nominaId, trabajadorIds: Array.from(seleccionados) },
              })
            }
            disabled={asignarM.isPending}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
      {nuevoOpen && (
        <TrabajadorFormDialog
          open
          canManage={canManage}
          obraId={obraId}
          onClose={() => {
            setNuevoOpen(false);
            dispQ.refetch();
          }}
        />
      )}
    </Dialog>
  );
}
