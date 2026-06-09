import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useEffectiveRoles } from "@/stores/auth";
import {
  PUESTOS,
  PUESTO_LABEL,
  mascararCurp,
  type TrabajadorPuesto,
} from "./imss";
import { TrabajadorFormDialog } from "./TrabajadorFormDialog";
import { TrabajadorDetalle } from "./TrabajadorDetalle";

type Row = {
  id: string;
  nombre_completo: string;
  curp: string | null;
  nss: string | null;
  puesto: TrabajadorPuesto | null;
  imss_estatus: "alta_activa" | "sin_alta" | "en_tramite" | "baja";
  estatus_autorizacion: "autorizado" | "pendiente";
  fecha_ingreso: string | null;
  documentos_estado: "al_dia" | "por_vencer" | "vencido_o_faltante";
};

const IMSS_DOT: Record<Row["imss_estatus"], string> = {
  alta_activa: "bg-emerald-500",
  sin_alta: "bg-rose-500",
  en_tramite: "bg-amber-500",
  baja: "bg-muted-foreground",
};
const IMSS_SHORT: Record<Row["imss_estatus"], string> = {
  alta_activa: "Alta",
  sin_alta: "Sin alta",
  en_tramite: "Trámite",
  baja: "Baja",
};
const DOCS_DOT: Record<Row["documentos_estado"], string> = {
  al_dia: "bg-emerald-500",
  por_vencer: "bg-amber-500",
  vencido_o_faltante: "bg-rose-500",
};
const DOCS_SHORT: Record<Row["documentos_estado"], string> = {
  al_dia: "Al día",
  por_vencer: "Por vencer",
  vencido_o_faltante: "Vencido",
};

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  return (
    <div className="size-8 rounded-full bg-[#0f1e3d] text-white grid place-items-center text-[11px] font-medium shrink-0">
      {initials || "?"}
    </div>
  );
}

export function CatalogoTrabajadoresModule() {
  const roles = useEffectiveRoles();
  const canManage = roles.includes("director") || roles.includes("administrativo");
  const canRequest =
    canManage || roles.includes("residente") || roles.includes("auxiliar");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [imssFiltro, setImssFiltro] = useState<"todos" | Row["imss_estatus"]>("todos");
  const [puestoFiltro, setPuestoFiltro] = useState<TrabajadorPuesto | "todos">("todos");
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
    <div className="space-y-3">
      {/* Header compacto */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Trabajadores</h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>{stats.total} en total</span>
            <span>·</span>
            <span className="text-emerald-700">{stats.altaActiva} alta activa</span>
            {stats.sinAlta > 0 && (
              <>
                <span>·</span>
                <button
                  onClick={() => setImssFiltro("sin_alta")}
                  className="inline-flex items-center gap-1 text-rose-700 hover:underline"
                >
                  <AlertTriangle className="size-3" />
                  {stats.sinAlta} sin IMSS
                </button>
              </>
            )}
            {stats.pendientes > 0 && (
              <>
                <span>·</span>
                <span className="text-amber-700">{stats.pendientes} por autorizar</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="h-8">
                <TabsTrigger value="todos" className="text-xs h-6 px-2">Todos</TabsTrigger>
                <TabsTrigger value="pendientes" className="text-xs h-6 px-2">
                  Pendientes
                  {stats.pendientes > 0 && (
                    <Badge className="ml-1.5 h-4 px-1 bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                      {stats.pendientes}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {canRequest && (
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="bg-[#0f1e3d] hover:bg-[#0f1e3d]/90 h-8"
            >
              <Plus className="size-3.5 mr-1" />
              {canManage ? "Nuevo" : "Solicitar alta"}
            </Button>
          )}
        </div>
      </div>

      {/* Filtros delgados */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre, CURP o NSS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={imssFiltro} onValueChange={(v) => setImssFiltro(v as typeof imssFiltro)}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los IMSS</SelectItem>
            <SelectItem value="alta_activa">Alta activa</SelectItem>
            <SelectItem value="sin_alta">Sin alta</SelectItem>
            <SelectItem value="en_tramite">En trámite</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={puestoFiltro}
          onValueChange={(v) => setPuestoFiltro(v as TrabajadorPuesto | "todos")}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los puestos</SelectItem>
            {PUESTOS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista protagonista */}
      <Card className="overflow-hidden">
        {/* Header de columnas */}
        <div className="hidden sm:grid grid-cols-[1fr_110px_90px_90px_90px_40px] gap-3 px-3 py-2 border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <div>Trabajador</div>
          <div className="hidden md:block">Puesto</div>
          <div>IMSS</div>
          <div className="hidden lg:block">Docs</div>
          <div>Estatus</div>
          <div></div>
        </div>

        {listQ.isLoading ? (
          <div className="px-3 py-6 text-sm text-muted-foreground">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="size-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Sin trabajadores</p>
            <p className="text-xs text-muted-foreground mt-1">
              {canRequest
                ? "Da de alta el primer trabajador para empezar."
                : "Aún no hay trabajadores registrados."}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li
                key={r.id}
                onClick={() => setDetalleId(r.id)}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_110px_90px_90px_90px_40px] gap-3 items-center px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
              >
                {/* Trabajador */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={r.nombre_completo} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate leading-tight">
                      {r.nombre_completo}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate leading-tight">
                      <span className="md:hidden">
                        {r.puesto ? PUESTO_LABEL[r.puesto] : "Sin puesto"} ·{" "}
                      </span>
                      <span className="font-mono">{mascararCurp(r.curp)}</span>
                    </div>
                  </div>
                </div>

                {/* Puesto (md+) */}
                <div className="hidden md:block text-xs text-foreground/80 truncate">
                  {r.puesto ? PUESTO_LABEL[r.puesto] : "—"}
                </div>

                {/* IMSS (sm+) */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs whitespace-nowrap">
                  <span className={`size-1.5 rounded-full ${IMSS_DOT[r.imss_estatus]}`} />
                  {IMSS_SHORT[r.imss_estatus]}
                </div>

                {/* Docs (lg+) */}
                <div className="hidden lg:flex items-center gap-1.5 text-xs whitespace-nowrap">
                  <span
                    className={`size-1.5 rounded-full ${DOCS_DOT[r.documentos_estado]}`}
                  />
                  {DOCS_SHORT[r.documentos_estado]}
                </div>

                {/* Estatus (sm+) */}
                <div className="hidden sm:block">
                  {r.estatus_autorizacion === "autorizado" ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Autorizado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      Pendiente
                    </span>
                  )}
                </div>

                {/* Acciones */}
                <div
                  className="flex items-center justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {canManage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {r.estatus_autorizacion === "pendiente" && (
                          <DropdownMenuItem
                            onClick={() => autM.mutate({ data: { id: r.id } })}
                            disabled={autM.isPending}
                            className="text-emerald-700"
                          >
                            <CheckCircle2 className="size-4 mr-2" />
                            Autorizar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setEditing(r)}>
                          <Pencil className="size-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setToDelete(r)}
                          className="text-rose-700"
                        >
                          <Trash2 className="size-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div className="sm:hidden flex items-center gap-1.5">
                      <span
                        className={`size-1.5 rounded-full ${IMSS_DOT[r.imss_estatus]}`}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {IMSS_SHORT[r.imss_estatus]}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(creating || editing) && (
        <TrabajadorFormDialog
          open
          canManage={canManage}
          initial={editing ?? null}
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
