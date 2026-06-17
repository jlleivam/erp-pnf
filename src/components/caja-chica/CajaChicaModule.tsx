import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listGastosCajaChica,
  listReembolsosCajaChica,
  listFondosCajaChica,
  listAsignacionesCajaChica,
  eliminarGastoCajaChica,
  entregarFondoCajaChica,
  autorizarFondoCajaChica,
  rechazarFondoCajaChica,
  reponerReembolsoCajaChica,
  getSaldoCajaChica,
} from "@/lib/api/caja-chica.functions";
import { useEffectiveIsDirector, useEffectiveRoles, useAuthStore } from "@/stores/auth";
import { useObraRole } from "@/hooks/useObraRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Send, Banknote, Wallet, Receipt, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatMXN, formatDate } from "@/lib/format";
import { montoGastoObra } from "@/lib/api/caja-chica.functions";
import { NuevoGastoDialog } from "./NuevoGastoDialog";
import { EditarGastoDialog } from "./EditarGastoDialog";
import { SolicitarReembolsoDialog } from "./SolicitarReembolsoDialog";
import { SolicitarFondoDialog } from "./SolicitarFondoDialog";
import { EntregarFondoDialog } from "./EntregarFondoDialog";
import { AsignarMontoBaseDialog } from "./AsignarMontoBaseDialog";
import { ReponerReembolsoDialog } from "./ReponerReembolsoDialog";
import { RevisarReembolsoSheet } from "./RevisarReembolsoSheet";

const TIPO_LABEL: Record<string, string> = {
  factura: "Factura", nota: "Nota", ninguno: "Sin comprobante",
};
const TIPO_CLASS: Record<string, string> = {
  factura: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  nota: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  ninguno: "bg-muted text-muted-foreground",
};

const GASTO_ESTATUS_LABEL: Record<string, string> = {
  borrador: "Borrador", solicitado: "Solicitado", aprobado: "Aprobado",
  rechazado: "Rechazado", reembolsado: "Reembolsado",
};
const GASTO_ESTATUS_VARIANT: Record<string, "default"|"secondary"|"destructive"|"outline"> = {
  borrador: "outline", solicitado: "secondary", aprobado: "default",
  rechazado: "destructive", reembolsado: "secondary",
};

const REEMB_ESTATUS_LABEL: Record<string, string> = {
  solicitado: "Solicitado", en_revision: "En revisión",
  enviado_admin: "Por reponer", repuesto: "Repuesto", rechazado: "Rechazado",
};
const REEMB_ESTATUS_VARIANT: Record<string, "default"|"secondary"|"destructive"|"outline"> = {
  solicitado: "outline", en_revision: "default", enviado_admin: "default",
  repuesto: "secondary", rechazado: "destructive",
};

const FONDO_ESTATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pendiente_autorizacion: "Pendiente autorización",
  autorizado: "Autorizado · esperando pago",
  entregado: "Entregado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};
const FONDO_ESTATUS_VARIANT: Record<string, "default"|"secondary"|"destructive"|"outline"> = {
  pendiente: "outline",
  pendiente_autorizacion: "outline",
  autorizado: "default",
  entregado: "secondary",
  rechazado: "destructive",
  cancelado: "destructive",
};

type Props = {
  obraId?: string;
  scope?: "obra" | "admin";
};

export function CajaChicaModule({ obraId, scope = "obra" }: Props) {
  const director = useEffectiveIsDirector();
  const roles = useEffectiveRoles();
  const userId = useAuthStore((s) => s.userId);
  const isSupervisor = roles.includes("supervisor");
  const isAdmin = roles.includes("administrativo");
  const isResidente = roles.includes("residente");
  const obraRole = useObraRole(scope === "obra" ? obraId : null);

  const qc = useQueryClient();

  const fetchGastos = useServerFn(listGastosCajaChica);
  const fetchReemb = useServerFn(listReembolsosCajaChica);
  const fetchFondos = useServerFn(listFondosCajaChica);
  const fetchAsig = useServerFn(listAsignacionesCajaChica);
  const fetchSaldo = useServerFn(getSaldoCajaChica);

  const baseKey = ["caja-chica", scope, obraId ?? "all"];

  const gastosQ = useQuery({
    queryKey: [...baseKey, "gastos"],
    queryFn: () => fetchGastos({ data: { obraId, residenteId: userId ?? undefined } }),
    enabled: scope === "obra" && !!obraId,
  });
  const reembQ = useQuery({
    queryKey: [...baseKey, "reembolsos"],
    queryFn: () => fetchReemb({ data: obraId ? { obraId } : {} }),
  });
  const fondosQ = useQuery({
    queryKey: [...baseKey, "fondos"],
    queryFn: () => fetchFondos({ data: obraId ? { obraId } : {} }),
  });
  const asigQ = useQuery({
    queryKey: [...baseKey, "asignaciones"],
    queryFn: () => fetchAsig({ data: { obraId: obraId! } }),
    enabled: scope === "obra" && !!obraId,
  });
  const saldoQ = useQuery({
    queryKey: [...baseKey, "saldo", userId],
    queryFn: () => fetchSaldo({ data: { obraId: obraId!, residenteId: userId! } }),
    enabled: scope === "obra" && !!obraId && !!userId,
  });

  const eliminar = useServerFn(eliminarGastoCajaChica);
  const eliminarM = useMutation({
    mutationFn: eliminar,
    onSuccess: () => {
      toast.success("Gasto eliminado");
      qc.invalidateQueries({ queryKey: baseKey });
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const autorizarFn = useServerFn(autorizarFondoCajaChica);
  const autorizarM = useMutation({
    mutationFn: (id: string) => autorizarFn({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(`Fondo autorizado (${r?.folio ?? "CxP"})`);
      qc.invalidateQueries({ queryKey: baseKey });
      qc.invalidateQueries({ queryKey: ["caja-chica-por-pagar"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const rechazarFn = useServerFn(rechazarFondoCajaChica);
  const rechazarM = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      rechazarFn({ data: { id, motivo } }),
    onSuccess: () => {
      toast.success("Solicitud rechazada");
      qc.invalidateQueries({ queryKey: baseKey });
      setRechazandoFondo(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const [creatingGasto, setCreatingGasto] = useState(false);
  const [editingGasto, setEditingGasto] = useState<any | null>(null);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [solicitarReemb, setSolicitarReemb] = useState(false);
  const [solicitarFondo, setSolicitarFondo] = useState(false);
  const [entregarFondo, setEntregarFondo] = useState<any | null>(null);
  const [asignarMonto, setAsignarMonto] = useState(false);
  const [reponerR, setReponerR] = useState<any | null>(null);
  const [revisarR, setRevisarR] = useState<any | null>(null);
  const [rechazandoFondo, setRechazandoFondo] = useState<any | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const puedeCrearGasto = scope === "obra" && obraRole.isResidente;
  const verMisGastos = scope === "obra" && obraRole.isResidente;
  const [tab, setTab] = useState<string>(
    scope === "admin" || !verMisGastos ? "reembolsos" : "mis-gastos",
  );

  const gastosAll: any[] = (gastosQ.data as any) ?? [];
  const borradores = useMemo(() => gastosAll.filter((g) => g.estatus === "borrador"), [gastosAll]);
  const reembAll: any[] = (reembQ.data as any) ?? [];
  const fondosAll: any[] = (fondosQ.data as any) ?? [];
  const asigAll: any[] = (asigQ.data as any) ?? [];

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const selectedTotal = borradores
    .filter((g) => selected[g.id])
    .reduce((a, g) => a + Number(g.monto), 0);

  const saldo = saldoQ.data as any;

  const canSeeAsignaciones = director && scope === "obra";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Wallet className="w-6 h-6" /> Caja Chica
          </h2>
          <p className="text-sm text-muted-foreground">
            {scope === "admin" ? "Caja chica de toda la empresa" : "Caja chica de esta obra"}
          </p>
        </div>
      </div>

      {scope === "obra" && saldo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Monto base</div>
            <div className="text-lg font-semibold">{formatMXN(saldo.montoBase)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Entregado</div>
            <div className="text-lg font-semibold">{formatMXN(saldo.entregado)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Gastos pendientes</div>
            <div className="text-lg font-semibold">{formatMXN(saldo.gastosPendientes)}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Disponible estimado</div>
            <div className={`text-lg font-semibold ${saldo.disponible < 0 ? "text-destructive" : ""}`}>
              {formatMXN(saldo.disponible)}
            </div>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {verMisGastos && <TabsTrigger value="mis-gastos">Mis gastos</TabsTrigger>}
          <TabsTrigger value="reembolsos">Reembolsos</TabsTrigger>
          <TabsTrigger value="fondos">Fondos</TabsTrigger>
          {canSeeAsignaciones && <TabsTrigger value="asignaciones">Asignaciones</TabsTrigger>}
        </TabsList>

        {verMisGastos && (
          <TabsContent value="mis-gastos" className="space-y-3 mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              {puedeCrearGasto && (
                <Button size="sm" onClick={() => setCreatingGasto(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Nuevo gasto
                </Button>
              )}
              {selectedIds.length > 0 && (
                <Button size="sm" variant="default" onClick={() => setSolicitarReemb(true)}>
                  <Send className="w-4 h-4 mr-1" />
                  Solicitar reembolso ({selectedIds.length} · {formatMXN(selectedTotal)})
                </Button>
              )}
            </div>
            {gastosQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {!gastosQ.isLoading && borradores.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin gastos en borrador.</p>
            )}
            {borradores.map((g) => (
              <Card key={g.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={!!selected[g.id]}
                    onCheckedChange={(v) =>
                      setSelected((s) => ({ ...s, [g.id]: !!v }))}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{g.concepto}</span>
                      <Badge variant="outline" className={TIPO_CLASS[g.tipo_comprobante]}>
                        {TIPO_LABEL[g.tipo_comprobante]}
                      </Badge>
                      <Badge variant={GASTO_ESTATUS_VARIANT[g.estatus]}>
                        {GASTO_ESTATUS_LABEL[g.estatus]}
                      </Badge>
                    </div>
                    {g.descripcion && (
                      <div className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {g.descripcion}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(g.fecha)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatMXN(Number(g.monto))}</div>
                    {g.tipo_comprobante === "factura" && (
                      <div className="text-[11px] text-muted-foreground">
                        Obra: {formatMXN(montoGastoObra(Number(g.monto), g.tipo_comprobante))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingGasto(g)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive"
                    onClick={() => setToDelete(g)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                  </Button>
                </div>
              </Card>
            ))}

            <h3 className="text-sm font-medium text-muted-foreground mt-6">
              Gastos ya enviados
            </h3>
            {gastosAll.filter((g) => g.estatus !== "borrador").map((g) => (
              <Card key={g.id} className="p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{g.concepto}</span>
                      <Badge variant={GASTO_ESTATUS_VARIANT[g.estatus]}>
                        {GASTO_ESTATUS_LABEL[g.estatus]}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(g.fecha)}
                    </div>
                    {g.motivo_rechazo && (
                      <div className="text-xs text-destructive mt-1">
                        Rechazado: {g.motivo_rechazo}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold">{formatMXN(Number(g.monto))}</div>
                </div>
              </Card>
            ))}
          </TabsContent>
        )}

        <TabsContent value="reembolsos" className="space-y-3 mt-4">
          {reembQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!reembQ.isLoading && reembAll.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin reembolsos.</p>
          )}
          {reembAll.map((r) => {
            const isOwn = r.residente_id === userId;
            return (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm">{r.folio}</span>
                      <Badge variant={REEMB_ESTATUS_VARIANT[r.estatus]}>
                        {REEMB_ESTATUS_LABEL[r.estatus]}
                      </Badge>
                      {scope === "admin" && r.obra_nombre && (
                        <Badge variant="secondary" className="font-normal">{r.obra_nombre}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Semana {formatDate(r.semana_inicio)} — {formatDate(r.semana_fin)} ·
                      {" "}Residente: {r.residente_nombre ?? "—"}
                    </div>
                    {r.motivo_rechazo && (
                      <div className="text-xs text-destructive mt-1">
                        Rechazado: {r.motivo_rechazo}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Aprobado</div>
                    <div className="font-semibold">{formatMXN(Number(r.monto_aprobado))}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => setRevisarR(r)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                  </Button>
                  {r.estatus === "enviado_admin" && (director || isAdmin) && (
                    <Button size="sm" onClick={() => setReponerR(r)}>
                      <Banknote className="w-3.5 h-3.5 mr-1" /> Reponer efectivo
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="fondos" className="space-y-3 mt-4">
          {scope === "obra" && (director || isResidente) && (
            <Button size="sm" onClick={() => setSolicitarFondo(true)}>
              <Plus className="w-4 h-4 mr-1" /> Solicitar fondo
            </Button>
          )}
          {fondosQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!fondosQ.isLoading && fondosAll.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin solicitudes de fondo.</p>
          )}
          {fondosAll.map((f) => (
            <Card key={f.id} className="p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={FONDO_ESTATUS_VARIANT[f.estatus]}>
                      {FONDO_ESTATUS_LABEL[f.estatus]}
                    </Badge>
                    {scope === "admin" && f.obra_nombre && (
                      <Badge variant="secondary" className="font-normal">{f.obra_nombre}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {f.residente_nombre ?? "—"} · {formatDate(f.solicitado_at)}
                  </div>
                  {f.notas && <div className="text-sm mt-1">{f.notas}</div>}
                  {f.motivo_rechazo && (
                    <div className="text-xs text-destructive mt-1">
                      Motivo: {f.motivo_rechazo}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Solicitado</div>
                  <div className="font-semibold">{formatMXN(Number(f.monto_solicitado))}</div>
                  {f.monto_entregado != null && (
                    <>
                      <div className="text-xs text-muted-foreground mt-1">Entregado</div>
                      <div className="font-semibold text-primary">
                        {formatMXN(Number(f.monto_entregado))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {f.estatus === "pendiente_autorizacion" && (director || isSupervisor) && (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => autorizarM.mutate(f.id)}
                    disabled={autorizarM.isPending}
                  >
                    <Banknote className="w-3.5 h-3.5 mr-1" /> Autorizar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => { setRechazandoFondo(f); setMotivoRechazo(""); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Rechazar
                  </Button>
                </div>
              )}
              {f.estatus === "autorizado" && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Esperando pago en Cuentas por pagar.
                </div>
              )}
            </Card>
          ))}
        </TabsContent>

        {canSeeAsignaciones && (
          <TabsContent value="asignaciones" className="space-y-3 mt-4">
            <Button size="sm" onClick={() => setAsignarMonto(true)}>
              <Plus className="w-4 h-4 mr-1" /> Asignar / actualizar
            </Button>
            {asigQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {!asigQ.isLoading && asigAll.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin asignaciones todavía.</p>
            )}
            {asigAll.map((a) => (
              <Card key={a.id} className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{a.residente_nombre ?? "—"}</span>
                </div>
                <div className="font-semibold">{formatMXN(Number(a.monto_base))}</div>
              </Card>
            ))}
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      {obraId && (
        <>
          <NuevoGastoDialog
            open={creatingGasto} onOpenChange={setCreatingGasto}
            obraId={obraId}
            onSaved={() => qc.invalidateQueries({ queryKey: baseKey })}
          />
          <EditarGastoDialog
            open={!!editingGasto}
            onOpenChange={(v) => !v && setEditingGasto(null)}
            obraId={obraId}
            gasto={editingGasto}
            onSaved={() => qc.invalidateQueries({ queryKey: baseKey })}
          />
          <SolicitarReembolsoDialog
            open={solicitarReemb} onOpenChange={setSolicitarReemb}
            obraId={obraId}
            gastos={borradores.filter((g) => selected[g.id])}
            onSaved={() => {
              setSelected({});
              qc.invalidateQueries({ queryKey: baseKey });
            }}
          />
          <SolicitarFondoDialog
            open={solicitarFondo} onOpenChange={setSolicitarFondo}
            obraId={obraId}
            montoBase={saldo ? Number(saldo.montoBase) : undefined}
            disponible={saldo ? Number(saldo.montoBase) - Number(saldo.entregado) : undefined}
            onSaved={() => qc.invalidateQueries({ queryKey: baseKey })}
          />
          <AsignarMontoBaseDialog
            open={asignarMonto} onOpenChange={setAsignarMonto}
            obraId={obraId}
            onSaved={() => qc.invalidateQueries({ queryKey: baseKey })}
          />
        </>
      )}
      <EntregarFondoDialog
        open={!!entregarFondo}
        onOpenChange={(v) => !v && setEntregarFondo(null)}
        fondo={entregarFondo}
        onSaved={() => qc.invalidateQueries({ queryKey: baseKey })}
      />
      <ReponerReembolsoDialog
        open={!!reponerR}
        onOpenChange={(v) => !v && setReponerR(null)}
        reembolso={reponerR}
        onSaved={() => qc.invalidateQueries({ queryKey: baseKey })}
      />
      <RevisarReembolsoSheet
        open={!!revisarR}
        onOpenChange={(v) => !v && setRevisarR(null)}
        reembolsoId={revisarR?.id ?? null}
        onChanged={() => qc.invalidateQueries({ queryKey: baseKey })}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar gasto</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && eliminarM.mutate({ data: { id: toDelete.id } })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!rechazandoFondo}
        onOpenChange={(v) => { if (!v) { setRechazandoFondo(null); setMotivoRechazo(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar solicitud de fondo</AlertDialogTitle>
            <AlertDialogDescription>
              Indícale al residente por qué se rechaza esta solicitud.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            className="w-full border rounded p-2 text-sm min-h-[80px]"
            placeholder="Motivo del rechazo"
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={motivoRechazo.trim().length < 2 || rechazarM.isPending}
              onClick={() =>
                rechazandoFondo &&
                rechazarM.mutate({ id: rechazandoFondo.id, motivo: motivoRechazo.trim() })
              }
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
