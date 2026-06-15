import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Unlock, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from "@/components/ui/tooltip";
import { formatDate, formatMXN } from "@/lib/format";
import {
  getSemanaActual,
  actualizarUtilizado,
  bloquearSemana,
  solicitarDesbloqueoSemana,
  listSolicitudesDesbloqueo,
  resolverSolicitudDesbloqueo,
} from "@/lib/api/almacen.functions";
import { useObraRole } from "@/hooks/useObraRole";

export function SemanaActualPanel({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(getSemanaActual);
  const actualizarFn = useServerFn(actualizarUtilizado);
  const bloquearFn = useServerFn(bloquearSemana);
  const solicitarFn = useServerFn(solicitarDesbloqueoSemana);
  const listSolFn = useServerFn(listSolicitudesDesbloqueo);
  const resolverFn = useServerFn(resolverSolicitudDesbloqueo);

  const { role, isDirector } = useObraRole(obraId);
  const puedeEditar = isDirector || role === "residente" || role === "supervisor";
  const puedeResolver = isDirector || role === "supervisor";


  const { data, isLoading } = useQuery({
    queryKey: ["almacen", "semana-actual", obraId],
    queryFn: () => fn({ data: { obraId } }),
  });

  const solicitudesQuery = useQuery({
    queryKey: ["almacen", "solicitudes-pendientes", obraId],
    queryFn: () => listSolFn({ data: { obraId, estatus: "pendiente" } }),
  });

  const [bloquearOpen, setBloquearOpen] = useState(false);
  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  const updateMut = useMutation({
    mutationFn: (input: { movimientoId: string; utilizado: number }) =>
      actualizarFn({ data: input }),
    onError: (e: any) => toast.error(e?.message ?? "Error al guardar"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["almacen", "semana-actual", obraId] });
    },
  });

  const bloquearMut = useMutation({
    mutationFn: (semanaId: string) => bloquearFn({ data: { semanaId } }),
    onSuccess: () => {
      toast.success("Semana bloqueada");
      setBloquearOpen(false);
      qc.invalidateQueries({ queryKey: ["almacen", "semana-actual", obraId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al bloquear"),
  });

  const solicitarMut = useMutation({
    mutationFn: (input: { semanaId: string; motivo: string }) => solicitarFn({ data: input }),
    onSuccess: () => {
      toast.success("Solicitud enviada al supervisor");
      setSolicitarOpen(false);
      setMotivo("");
      qc.invalidateQueries({ queryKey: ["almacen", "solicitudes-pendientes", obraId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al enviar solicitud"),
  });

  const resolverMut = useMutation({
    mutationFn: (input: { solicitudId: string; accion: "aprobar" | "rechazar"; respuesta?: string }) =>
      resolverFn({ data: input }),
    onSuccess: (_d, vars) => {
      toast.success(vars.accion === "aprobar" ? "Solicitud aprobada" : "Solicitud rechazada");
      qc.invalidateQueries({ queryKey: ["almacen", "solicitudes-pendientes", obraId] });
      qc.invalidateQueries({ queryKey: ["almacen", "semana-actual", obraId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al resolver"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data) return null;

  const items = data.items;
  const semana = data.semana as { id: string; semana_inicio: string; semana_fin: string; estatus: string };
  const bloqueada = semana.estatus === "bloqueada";
  const solicitudPendiente = (solicitudesQuery.data ?? []).find(
    (s: any) => s.semana_id === semana.id,
  );

  const totRecibido = items.reduce(
    (s: number, m: any) => s + Number(m.recibido) * Number(m.precio_unitario), 0,
  );
  const totUtilizado = items.reduce(
    (s: number, m: any) => s + Number(m.utilizado) * Number(m.precio_unitario), 0,
  );

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <Card className="p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Semana</span>
              {bloqueada ? (
                <Badge className="bg-amber-100 text-amber-800 text-xs flex items-center gap-1">
                  <Lock className="size-3" /> Bloqueada
                </Badge>
              ) : (
                <Badge className="bg-emerald-100 text-emerald-800 text-xs">Abierta</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDate(semana.semana_inicio)} – {formatDate(semana.semana_fin)} (lun–dom)
            </span>
            {items.length > 0 && (
              <span className="text-xs text-muted-foreground flex gap-3 ml-2">
                <span>Recibido: <span className="font-medium text-foreground">{formatMXN(totRecibido)}</span></span>
                <span>Utilizado: <span className="font-medium text-foreground">{formatMXN(totUtilizado)}</span></span>
              </span>
            )}
          </div>

          {!bloqueada && esResidenteOSupervisor && (
            <Button size="sm" onClick={() => setBloquearOpen(true)} disabled={items.length === 0}>
              <Lock className="size-3.5 mr-1.5" /> Bloquear semana
            </Button>
          )}
          {bloqueada && esResidenteOSupervisor && !solicitudPendiente && (
            <Button size="sm" variant="outline" onClick={() => setSolicitarOpen(true)}>
              <Unlock className="size-3.5 mr-1.5" /> Solicitar desbloqueo
            </Button>
          )}
          {bloqueada && solicitudPendiente && (
            <span className="text-xs text-amber-700 flex items-center gap-1">
              <ShieldAlert className="size-3.5" /> Desbloqueo solicitado el {formatDate(solicitudPendiente.created_at)}
            </span>
          )}
        </Card>

        {/* Panel supervisor/director con solicitudes pendientes a resolver */}
        {puedeResolver && (solicitudesQuery.data ?? []).length > 0 && (
          <Card className="p-3 space-y-2 border-amber-200 bg-amber-50/40">
            <p className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="size-4 text-amber-700" />
              Solicitudes de desbloqueo pendientes
            </p>
            {(solicitudesQuery.data ?? []).map((s: any) => (
              <div key={s.id} className="flex items-start justify-between gap-3 rounded-md border bg-background p-2">
                <div className="text-xs space-y-0.5">
                  <p className="font-medium">
                    {s.solicitante?.nombre_completo || s.solicitante?.email || "Usuario"}
                    {" · "}
                    <span className="text-muted-foreground">
                      Semana {s.semana?.semana_inicio} – {s.semana?.semana_fin}
                    </span>
                  </p>
                  <p className="text-muted-foreground"><span className="font-medium">Motivo:</span> {s.motivo}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolverMut.mutate({ solicitudId: s.id, accion: "rechazar" })}
                    disabled={resolverMut.isPending}
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => resolverMut.mutate({ solicitudId: s.id, accion: "aprobar" })}
                    disabled={resolverMut.isPending}
                  >
                    Aprobar
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}

        <Card>
          <Table className="text-xs w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase tracking-wide py-1.5 px-1.5 w-[26%]">Insumo</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-center py-1.5 px-1 w-[16%]">Proveedor</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-center py-1.5 px-1 w-[7%]">Ud</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-center py-1.5 px-1 w-[11%]">PU</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-center py-1.5 px-1 w-[8%]">Ini</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-center py-1.5 px-1 w-[8%]">Rec</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-center py-1.5 px-1 w-[14%]">Util</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wide text-center py-1.5 px-1 w-[10%]">Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m: any) => (
                <MovRow
                  key={m.id}
                  mov={m}
                  disabled={bloqueada}
                  onSave={(val) => updateMut.mutate({ movimientoId: m.id, utilizado: val })}
                />
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Aún no hay material en el almacén esta semana. Registra recepciones desde la pestaña "Por recibir".
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <AlertDialog open={bloquearOpen} onOpenChange={setBloquearOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bloquear la semana</AlertDialogTitle>
              <AlertDialogDescription>
                La semana quedará bloqueada y no podrás editar el material utilizado ni registrar recepciones.
                Para volver a abrirla deberás solicitar al supervisor que la desbloquee.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  bloquearMut.mutate(semana.id);
                }}
                disabled={bloquearMut.isPending}
              >
                {bloquearMut.isPending ? "Bloqueando…" : "Bloquear"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={solicitarOpen} onOpenChange={setSolicitarOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar desbloqueo</DialogTitle>
              <DialogDescription>
                Explica por qué necesitas desbloquear la semana. El supervisor o director recibirá tu solicitud.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Motivo de la solicitud…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setSolicitarOpen(false)}>Cancelar</Button>
              <Button
                disabled={motivo.trim().length < 3 || solicitarMut.isPending}
                onClick={() => solicitarMut.mutate({ semanaId: semana.id, motivo: motivo.trim() })}
              >
                {solicitarMut.isPending ? "Enviando…" : "Enviar solicitud"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function MovRow({ mov, disabled, onSave }: { mov: any; disabled: boolean; onSave: (utilizado: number) => void }) {
  const [val, setVal] = useState<string>(String(Number(mov.utilizado)));
  useEffect(() => { setVal(String(Number(mov.utilizado))); }, [mov.utilizado]);
  const final = Number(mov.inv_inicial) + Number(mov.recibido) - (Number(val) || 0);
  const max = Number(mov.inv_inicial) + Number(mov.recibido);
  const overflow = Number(val) > max + 1e-6;
  const insumoNombre = mov.insumo?.nombre ?? "—";
  const proveedor = mov.proveedor || "—";

  return (
    <TableRow>
      <TableCell className="py-1.5 px-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate block cursor-default">{insumoNombre}</span>
          </TooltipTrigger>
          <TooltipContent side="top">{insumoNombre}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="py-1.5 px-1 text-center text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate block cursor-default">{proveedor}</span>
          </TooltipTrigger>
          <TooltipContent side="top">{proveedor}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="py-1.5 px-1 text-center text-muted-foreground">{mov.insumo?.unidad ?? "—"}</TableCell>
      <TableCell className="py-1.5 px-1 text-center tabular-nums truncate">{formatMXN(Number(mov.precio_unitario))}</TableCell>
      <TableCell className="py-1.5 px-1 text-center tabular-nums">{Number(mov.inv_inicial)}</TableCell>
      <TableCell className="py-1.5 px-1 text-center tabular-nums">{Number(mov.recibido)}</TableCell>
      <TableCell className="py-1.5 px-1 text-center">
        <Input
          type="number"
          step="0.01"
          min={0}
          value={val}
          disabled={disabled}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            const n = Number(val);
            if (isNaN(n) || n < 0) { setVal(String(Number(mov.utilizado))); return; }
            if (n === Number(mov.utilizado)) return;
            onSave(n);
          }}
          className={`h-7 w-full max-w-[64px] px-1 text-center mx-auto tabular-nums ${overflow ? "border-rose-500" : ""}`}
        />
      </TableCell>
      <TableCell className={`py-1.5 px-1 text-center tabular-nums font-medium ${final < 0 ? "text-rose-600" : ""}`}>
        {final}
      </TableCell>
    </TableRow>
  );
}
