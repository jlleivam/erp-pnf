import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listValesGasolina,
  cancelarValeGasolina,
  confirmarRecepcionVale,
} from "@/lib/api/vales-gasolina.functions";
import { useEffectiveIsDirector, useEffectiveRoles, useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Check, X, Link2, CheckCheck, Fuel } from "lucide-react";
import { toast } from "sonner";
import { formatMXN, formatDate } from "@/lib/format";
import { NuevoValeDialog } from "./NuevoValeDialog";
import { AutorizarValeDialog } from "./AutorizarValeDialog";
import { LigarCodigoDialog } from "./LigarCodigoDialog";

type Estatus =
  | "pendiente_autorizacion" | "autorizado" | "rechazado"
  | "cancelado" | "entregado" | "confirmado";

type Vale = {
  id: string;
  folio: string;
  obra_id: string | null;
  obra_nombre: string | null;
  tipo_combustible: "magna" | "premium" | "diesel";
  monto_solicitado: number;
  monto_autorizado: number | null;
  descripcion: string;
  estatus: Estatus;
  solicitado_por: string;
  solicitado_nombre: string | null;
  solicitado_at: string;
  autorizado_nombre: string | null;
  autorizado_at: string | null;
  rechazado_nombre: string | null;
  rechazado_at: string | null;
  motivo_rechazo: string | null;
  codigo_vale: string | null;
  ligado_nombre: string | null;
  ligado_at: string | null;
  confirmado_nombre: string | null;
  confirmado_at: string | null;
};

const ESTATUS_LABEL: Record<Estatus, string> = {
  pendiente_autorizacion: "Pendiente",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  entregado: "Entregado",
  confirmado: "Confirmado",
};
const ESTATUS_VARIANT: Record<Estatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente_autorizacion: "outline",
  autorizado: "default",
  rechazado: "destructive",
  cancelado: "secondary",
  entregado: "default",
  confirmado: "secondary",
};

const TIPO_LABEL: Record<Vale["tipo_combustible"], string> = {
  magna: "Magna",
  premium: "Premium",
  diesel: "Diésel",
};

function tipoBadgeClass(t: Vale["tipo_combustible"]) {
  // Use semantic tokens via tailwind colors mapped in styles.css
  switch (t) {
    case "magna": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "premium": return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
    case "diesel": return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  }
}

type Props = {
  /** Si se pasa, vista por obra. Si no, vista admin (todas las de la empresa). */
  obraId?: string;
  scope?: "obra" | "admin";
};

export function GasolinasModule({ obraId, scope = "obra" }: Props) {
  const director = useEffectiveIsDirector();
  const roles = useEffectiveRoles();
  const userId = useAuthStore((s) => s.userId);
  const isSupervisor = roles.includes("supervisor");
  const isAdministrativo = roles.includes("administrativo");

  const qc = useQueryClient();
  const fetchList = useServerFn(listValesGasolina);
  const queryKey = ["vales-gasolina", scope, obraId ?? "all"];
  const listQ = useQuery({
    queryKey,
    queryFn: () => fetchList({ data: obraId ? { obraId } : {} }),
  });

  const cancelar = useServerFn(cancelarValeGasolina);
  const cancelarM = useMutation({
    mutationFn: cancelar,
    onSuccess: () => {
      toast.success("Vale cancelado");
      qc.invalidateQueries({ queryKey });
      setToCancel(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const confirmar = useServerFn(confirmarRecepcionVale);
  const confirmarM = useMutation({
    mutationFn: confirmar,
    onSuccess: () => {
      toast.success("Recepción confirmada");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const [creating, setCreating] = useState(false);
  const [toAuth, setToAuth] = useState<Vale | null>(null);
  const [toLink, setToLink] = useState<Vale | null>(null);
  const [toCancel, setToCancel] = useState<Vale | null>(null);
  const [tab, setTab] = useState<"activos" | "historico">("activos");

  const all: Vale[] = (listQ.data as any) ?? [];
  const { activos, historico } = useMemo(() => {
    const activos = all.filter(v => ["pendiente_autorizacion", "autorizado", "entregado"].includes(v.estatus));
    const historico = all.filter(v => ["confirmado", "rechazado", "cancelado"].includes(v.estatus));
    return { activos, historico };
  }, [all]);

  const canCreate = director || isAdministrativo || isSupervisor || scope === "obra";
  const canAuth = director || isSupervisor;
  const canLink = director || isAdministrativo;

  function Row({ v }: { v: Vale }) {
    const isOwn = v.solicitado_por === userId;
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-medium">{v.folio}</span>
              <Badge variant={ESTATUS_VARIANT[v.estatus]}>{ESTATUS_LABEL[v.estatus]}</Badge>
              <Badge variant="outline" className={tipoBadgeClass(v.tipo_combustible)}>
                {TIPO_LABEL[v.tipo_combustible]}
              </Badge>
              {v.obra_nombre && (
                <Badge variant="secondary" className="font-normal">{v.obra_nombre}</Badge>
              )}
              {!v.obra_id && (
                <Badge variant="secondary" className="font-normal">General</Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-2">{v.descripcion}</div>
            <div className="text-xs text-muted-foreground">
              Solicitó {v.solicitado_nombre ?? "—"} · {formatDate(v.solicitado_at)}
            </div>
            {v.codigo_vale && (
              <div className="text-xs">
                <span className="text-muted-foreground">Código: </span>
                <span className="font-mono">{v.codigo_vale}</span>
              </div>
            )}
            {v.motivo_rechazo && (
              <div className="text-xs text-destructive">Rechazado: {v.motivo_rechazo}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Solicitado</div>
            <div className="font-semibold">{formatMXN(v.monto_solicitado)}</div>
            {v.monto_autorizado != null && (
              <>
                <div className="text-xs text-muted-foreground mt-1">Autorizado</div>
                <div className="font-semibold text-primary">{formatMXN(v.monto_autorizado)}</div>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {v.estatus === "pendiente_autorizacion" && canAuth && (
            <Button size="sm" onClick={() => setToAuth(v)}>
              <Check className="w-4 h-4 mr-1" /> Revisar
            </Button>
          )}
          {v.estatus === "pendiente_autorizacion" && (isOwn || director) && (
            <Button size="sm" variant="outline" onClick={() => setToCancel(v)}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          )}
          {v.estatus === "autorizado" && canLink && (
            <Button size="sm" onClick={() => setToLink(v)}>
              <Link2 className="w-4 h-4 mr-1" /> Ligar código
            </Button>
          )}
          {v.estatus === "entregado" && (isOwn || director) && (
            <Button
              size="sm"
              onClick={() => confirmarM.mutate({ data: { id: v.id } })}
              disabled={confirmarM.isPending}
            >
              <CheckCheck className="w-4 h-4 mr-1" /> Confirmar recepción
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Fuel className="w-6 h-6" /> Gasolinas
          </h2>
          <p className="text-sm text-muted-foreground">
            {scope === "admin"
              ? "Vales de gasolina de toda la empresa"
              : "Vales de gasolina de esta obra"}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo vale
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="activos">Activos ({activos.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({historico.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="activos" className="space-y-3 mt-4">
          {listQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!listQ.isLoading && activos.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin vales activos.</p>
          )}
          {activos.map((v) => <Row key={v.id} v={v} />)}
        </TabsContent>
        <TabsContent value="historico" className="space-y-3 mt-4">
          {historico.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin histórico todavía.</p>
          )}
          {historico.map((v) => <Row key={v.id} v={v} />)}
        </TabsContent>
      </Tabs>

      <NuevoValeDialog
        open={creating}
        onOpenChange={setCreating}
        obraId={obraId ?? null}
        pickObra={scope === "admin"}
      />
      <AutorizarValeDialog
        open={!!toAuth}
        onOpenChange={(v) => !v && setToAuth(null)}
        vale={toAuth}
      />
      <LigarCodigoDialog
        open={!!toLink}
        onOpenChange={(v) => !v && setToLink(null)}
        vale={toLink}
      />
      <AlertDialog open={!!toCancel} onOpenChange={(v) => !v && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar vale {toCancel?.folio}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. ¿Cancelar el vale?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toCancel && cancelarM.mutate({ data: { id: toCancel.id } })}
            >
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
