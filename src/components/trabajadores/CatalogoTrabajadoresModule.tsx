import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  autorizarTrabajador,
  eliminarTrabajador,
  listTrabajadores,
} from "@/lib/api/trabajadores.functions";
import { useAuthStore } from "@/stores/auth";
import {
  DOCS_BADGE,
  DOCS_LABEL,
  IMSS_BADGE,
  IMSS_LABEL,
  mascararCurp,
} from "./imss";
import { TrabajadorFormDialog } from "./TrabajadorFormDialog";
import { TrabajadorDetalle } from "./TrabajadorDetalle";

type Row = {
  id: string;
  nombre_completo: string;
  curp: string | null;
  nss: string | null;
  puesto: string | null;
  imss_estatus: "alta_activa" | "sin_alta" | "en_tramite" | "baja";
  estatus_autorizacion: "autorizado" | "pendiente";
  fecha_ingreso: string | null;
  documentos_estado: "al_dia" | "por_vencer" | "vencido_o_faltante";
};

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-700"
      : tone === "danger"
        ? "text-rose-700"
        : tone === "warning"
          ? "text-amber-700"
          : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
    </Card>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <div className="size-9 rounded-full bg-[#0f1e3d] text-white grid place-items-center text-xs font-medium shrink-0">
      {initials || "?"}
    </div>
  );
}

export function CatalogoTrabajadoresModule() {
  const roles = useAuthStore((s) => s.roles);
  const canManage = roles.includes("director") || roles.includes("administrativo");
  const canRequest =
    canManage || roles.includes("residente") || roles.includes("auxiliar");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [imssFiltro, setImssFiltro] = useState<"todos" | Row["imss_estatus"]>("todos");
  const [puestoFiltro, setPuestoFiltro] = useState<string>("todos");
  const [tab, setTab] = useState<"todos" | "pendientes">("todos");
  const [creating, setCreating] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const fetchList = useServerFn(listTrabajadores);
  const listQ = useQuery({
    queryKey: ["trabajadores", search, imssFiltro, puestoFiltro, tab],
    queryFn: () =>
      fetchList({
        data: {
          search: search || undefined,
          imss_estatus: imssFiltro === "todos" ? undefined : imssFiltro,
          puesto: puestoFiltro === "todos" ? undefined : puestoFiltro,
          solo_pendientes: tab === "pendientes" ? true : undefined,
        },
      }),
  });

  const rows: Row[] = (listQ.data ?? []) as Row[];

  const puestos = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.puesto && set.add(r.puesto));
    return Array.from(set).sort();
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const altaActiva = rows.filter((r) => r.imss_estatus === "alta_activa").length;
    const sinAlta = rows.filter((r) => r.imss_estatus === "sin_alta").length;
    const pendientes = rows.filter((r) => r.estatus_autorizacion === "pendiente").length;
    return { total, altaActiva, sinAlta, pendientes };
  }, [rows]);

  const eliminar = useServerFn(eliminarTrabajador);
  const delM = useMutation({
    mutationFn: eliminar,
    onSuccess: () => {
      toast.success("Trabajador eliminado");
      qc.invalidateQueries({ queryKey: ["trabajadores"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autorizar = useServerFn(autorizarTrabajador);
  const autM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => {
      toast.success("Trabajador autorizado");
      qc.invalidateQueries({ queryKey: ["trabajadores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Trabajadores</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Personal de obra, IMSS y documentación.
          </p>
        </div>
        {canRequest && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-[#0f1e3d] hover:bg-[#0f1e3d]/90"
          >
            <Plus className="size-4 mr-1" />
            {canManage ? "Nuevo trabajador" : "Solicitar alta"}
          </Button>
        )}
      </div>

      {stats.sinAlta > 0 && (
        <Card className="bg-rose-50 border-rose-200 p-4 flex items-center gap-3">
          <AlertTriangle className="size-5 text-rose-600 shrink-0" />
          <p className="text-sm text-rose-900">
            <strong>{stats.sinAlta}</strong> trabajador{stats.sinAlta === 1 ? "" : "es"}{" "}
            sin alta en el IMSS. Regulariza para evitar contingencias.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total trabajadores" value={stats.total} />
        <MetricCard label="Alta activa" value={stats.altaActiva} tone="success" />
        <MetricCard label="Sin alta IMSS" value={stats.sinAlta} tone="danger" />
        <MetricCard label="Pendientes autorización" value={stats.pendientes} tone="warning" />
      </div>

      {canManage && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="pendientes">
              Pendientes de autorización
              {stats.pendientes > 0 && (
                <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100">
                  {stats.pendientes}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, CURP o NSS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={imssFiltro} onValueChange={(v) => setImssFiltro(v as typeof imssFiltro)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estatus IMSS</SelectItem>
            <SelectItem value="alta_activa">Alta activa</SelectItem>
            <SelectItem value="sin_alta">Sin alta</SelectItem>
            <SelectItem value="en_tramite">En trámite</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <Select value={puestoFiltro} onValueChange={setPuestoFiltro}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los puestos</SelectItem>
            {puestos.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>Puesto</TableHead>
              <TableHead>IMSS</TableHead>
              <TableHead>Documentos</TableHead>
              <TableHead>Estatus</TableHead>
              {canManage && <TableHead className="w-40 text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5}>
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Users className="size-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Sin trabajadores</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {canRequest
                        ? "Da de alta el primer trabajador para empezar."
                        : "Aún no hay trabajadores registrados."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setDetalleId(r.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={r.nombre_completo} />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.nombre_completo}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {mascararCurp(r.curp)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{r.puesto ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={IMSS_BADGE[r.imss_estatus]} variant="secondary">
                      {IMSS_LABEL[r.imss_estatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={DOCS_BADGE[r.documentos_estado]}
                      variant="secondary"
                    >
                      {DOCS_LABEL[r.documentos_estado]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.estatus_autorizacion === "autorizado" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Autorizado
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        Pendiente
                      </Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {r.estatus_autorizacion === "pendiente" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Autorizar"
                          onClick={() => autM.mutate({ data: { id: r.id } })}
                          disabled={autM.isPending}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <CheckCircle2 className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(r)}
                        title="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setToDelete(r)}
                        title="Eliminar"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {(creating || editing) && (
        <TrabajadorFormDialog
          open
          canManage={canManage}
          initial={editing as unknown as never}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <TrabajadorDetalle
        trabajadorId={detalleId}
        open={!!detalleId}
        onClose={() => setDetalleId(null)}
        canManage={canManage}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar trabajador?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.nombre_completo}" junto con sus documentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && delM.mutate({ data: { id: toDelete.id } })}
              disabled={delM.isPending}
            >
              {delM.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
