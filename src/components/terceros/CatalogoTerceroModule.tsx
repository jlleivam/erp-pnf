import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
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
  autorizarTercero,
  eliminarTercero,
  listTerceros,
  rechazarTercero,
} from "@/lib/api/terceros.functions";
import { useEffectiveRoles } from "@/stores/auth";
import { estadoVencimiento, type EstadoDoc } from "@/lib/format";
import { TerceroFormDialog } from "./TerceroFormDialog";
import { TerceroDetalle } from "./TerceroDetalle";
import { TruncatedCell } from "@/components/pagos/TruncatedCell";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CATEGORIA_BADGE,
  CATEGORIA_LABEL,
  type TerceroCategoria,
  type TerceroDocTipo,
  type TerceroDocumento,
  type TerceroListRow,
  type TipoPersona,
} from "./constants";

type DocStatus = "al_dia" | "por_vencer" | "vencido";

function computeDocStatus(
  docs: TerceroDocumento[],
  categoria: TerceroCategoria,
): DocStatus {
  const required: TerceroDocTipo[] = ["constancia_fiscal", "opinion_sat"];
  if (categoria === "contratista" || categoria === "ambos") {
    required.push("repse");
  }

  let worst: EstadoDoc = "ok";
  for (const tipo of required) {
    const d = docs.find((x) => x.tipo === tipo);
    if (!d) return "vencido";
    const e = estadoVencimiento(d.fecha_vencimiento, d.url);
    if (e === "vencido" || e === "sin_documento") return "vencido";
    if (e === "por_vencer" && worst === "ok") worst = "por_vencer";
  }
  return worst === "por_vencer" ? "por_vencer" : "al_dia";
}

const STATUS_BADGE: Record<DocStatus, { label: string; cls: string }> = {
  al_dia: {
    label: "Al día",
    cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  },
  por_vencer: {
    label: "Por vencer",
    cls: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  },
  vencido: {
    label: "Vencido o faltante",
    cls: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  },
};

export function CatalogoTerceroModule() {
  const roles = useEffectiveRoles();
  const canManage = roles.includes("director") || roles.includes("administrativo");
  const canRequest =
    canManage ||
    roles.includes("residente") ||
    roles.includes("auxiliar") ||
    roles.includes("supervisor");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [catFiltro, setCatFiltro] = useState<TerceroCategoria | "todos">("todos");
  const [personaFiltro, setPersonaFiltro] = useState<TipoPersona | "todos">("todos");
  const [docFiltro, setDocFiltro] = useState<DocStatus | "todos">("todos");
  const [tab, setTab] = useState<"todos" | "pendientes">("todos");
  const [creating, setCreating] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TerceroListRow | null>(null);
  const [toDelete, setToDelete] = useState<TerceroListRow | null>(null);
  const [toReject, setToReject] = useState<TerceroListRow | null>(null);

  const search_ = useSearch({ from: "/_authenticated/app/catalogos/proveedores" });
  useEffect(() => {
    if (search_.tab === "pendientes") setTab("pendientes");
    if (search_.id) setDetalleId(search_.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search_.tab, search_.id]);

  const fetchList = useServerFn(listTerceros);
  const listQ = useQuery({
    queryKey: ["terceros", search, catFiltro, personaFiltro, tab],
    queryFn: () =>
      fetchList({
        data: {
          search: search || undefined,
          categoria: catFiltro === "todos" ? undefined : catFiltro,
          tipo_persona: personaFiltro === "todos" ? undefined : personaFiltro,
          solo_pendientes: tab === "pendientes" ? true : undefined,
        },
      }),
  });

  const eliminar = useServerFn(eliminarTercero);
  const delM = useMutation({
    mutationFn: eliminar,
    onSuccess: () => {
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["terceros"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autorizar = useServerFn(autorizarTercero);
  const autM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => {
      toast.success("Registro autorizado");
      qc.invalidateQueries({ queryKey: ["terceros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rechazar = useServerFn(rechazarTercero);
  const rejM = useMutation({
    mutationFn: rechazar,
    onSuccess: () => {
      toast.success("Solicitud rechazada");
      qc.invalidateQueries({ queryKey: ["terceros"] });
      setToReject(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows: TerceroListRow[] = (listQ.data ?? []) as unknown as TerceroListRow[];

  const rowsWithStatus = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        _status: computeDocStatus(r.documentos ?? [], r.categoria),
      })),
    [rows],
  );

  const filtered = useMemo(
    () =>
      docFiltro === "todos"
        ? rowsWithStatus
        : rowsWithStatus.filter((r) => r._status === docFiltro),
    [rowsWithStatus, docFiltro],
  );

  const pendientesCount = useMemo(
    () => rows.filter((r) => r.estatus_autorizacion === "pendiente").length,
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Proveedores y Contratistas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Proveedores y contratistas que te suministran materiales o ejecutan trabajos contratados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="h-8">
                <TabsTrigger value="todos" className="text-xs h-6 px-2">Todos</TabsTrigger>
                <TabsTrigger value="pendientes" className="text-xs h-6 px-2">
                  Pendientes
                  {pendientesCount > 0 && (
                    <Badge className="ml-1.5 h-4 px-1 bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                      {pendientesCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {canRequest && (
            <Button
              onClick={() => setCreating(true)}
              className="bg-[#0f1e3d] hover:bg-[#0f1e3d]/90 h-8"
              size="sm"
            >
              <Plus className="size-3.5 mr-1" />
              {canManage ? "Nuevo" : "Solicitar alta"}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3 flex flex-wrap sm:flex-nowrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RFC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select
          value={catFiltro}
          onValueChange={(v) => setCatFiltro(v as typeof catFiltro)}
        >
          <SelectTrigger className="w-36 h-8 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las categorías</SelectItem>
            <SelectItem value="proveedor">Proveedor</SelectItem>
            <SelectItem value="contratista">Contratista</SelectItem>
            <SelectItem value="ambos">Ambos</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={personaFiltro}
          onValueChange={(v) => setPersonaFiltro(v as typeof personaFiltro)}
        >
          <SelectTrigger className="w-36 h-8 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas las personas</SelectItem>
            <SelectItem value="moral">Persona moral</SelectItem>
            <SelectItem value="fisica">Persona física</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={docFiltro}
          onValueChange={(v) => setDocFiltro(v as typeof docFiltro)}
        >
          <SelectTrigger className="w-40 h-8 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los documentos</SelectItem>
            <SelectItem value="al_dia">Al día</SelectItem>
            <SelectItem value="por_vencer">Por vencer</SelectItem>
            <SelectItem value="vencido">Vencido o faltante</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <TooltipProvider delayDuration={200}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Nombre</TableHead>
              <TableHead className="whitespace-nowrap">RFC</TableHead>
              <TableHead className="whitespace-nowrap">Tipo</TableHead>
              <TableHead className="whitespace-nowrap">Categoría</TableHead>
              <TableHead className="whitespace-nowrap text-right">Días crédito</TableHead>
              <TableHead className="whitespace-nowrap">Documentos</TableHead>
              <TableHead className="whitespace-nowrap">Estatus</TableHead>
              {(canManage || canRequest) && <TableHead className="whitespace-nowrap w-auto text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-sm text-muted-foreground"
                >
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Building2 className="size-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Sin registros</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tab === "pendientes"
                        ? "No hay solicitudes pendientes de autorización."
                        : "Crea tu primer proveedor o contratista para empezar."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const s = STATUS_BADGE[r._status];
                const shortLabel = r._status === "vencido" ? "Faltante" : s.label;
                const isPending = r.estatus_autorizacion === "pendiente";
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => setDetalleId(r.id)}
                  >
                    <TableCell className="font-medium max-w-0">
                      <TruncatedCell>
                        {r.nombre_comercial
                          ? `${r.nombre_comercial} · ${r.razon_social}`
                          : r.razon_social}
                      </TruncatedCell>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{r.rfc}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary">
                        {r.tipo_persona === "moral" ? "Moral" : "Física"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge className={CATEGORIA_BADGE[r.categoria]}>
                        {CATEGORIA_LABEL[r.categoria]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground">
                      {r.dias_credito != null ? `${r.dias_credito} d` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge className={s.cls} title={s.label}>{shortLabel}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
                          <span className="size-1.5 rounded-full bg-amber-500" />
                          Pendiente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Autorizado
                        </span>
                      )}
                    </TableCell>
                    {(canManage || canRequest) && (
                      <TableCell
                        className="whitespace-nowrap w-auto text-right"
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
                              {isPending && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => autM.mutate({ data: { id: r.id } })}
                                    disabled={autM.isPending}
                                    className="text-emerald-700"
                                  >
                                    <CheckCircle2 className="size-4 mr-2" />
                                    Autorizar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setToReject(r)}
                                    className="text-rose-700"
                                  >
                                    <XCircle className="size-4 mr-2" />
                                    Rechazar
                                  </DropdownMenuItem>
                                </>
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
                        ) : null}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </TooltipProvider>
      </Card>

      {(creating || editing) && (
        <TerceroFormDialog
          open
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initial={(editing as any) ?? null}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <TerceroDetalle
        terceroId={detalleId}
        open={!!detalleId}
        onClose={() => setDetalleId(null)}
        canEdit={canManage}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor o contratista?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.razon_social}". Si tiene órdenes de compra o
              contratos vinculados, la eliminación será bloqueada.
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

      <AlertDialog open={!!toReject} onOpenChange={(o) => !o && setToReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la solicitud de alta de "{toReject?.razon_social}" y se
              notificará a quien la creó.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toReject && rejM.mutate({ data: { id: toReject.id } })}
              disabled={rejM.isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {rejM.isPending ? "Rechazando…" : "Rechazar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
