import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  autorizarCliente,
  eliminarCliente,
  listClientes,
  rechazarCliente,
} from "@/lib/api/clientes.functions";
import { useEffectiveRoles } from "@/stores/auth";
import { estadoVencimiento } from "@/lib/format";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { ClienteDetalle } from "@/components/clientes/ClienteDetalle";
import { TruncatedCell } from "@/components/pagos/TruncatedCell";

type ClienteListRow = {
  id: string;
  razon_social: string;
  rfc: string;
  tipo_persona: "moral" | "fisica";
  telefono: string | null;
  correo: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datos_contacto: any;
  constancia_fiscal_url: string | null;
  constancia_fiscal_vencimiento: string | null;
  opinion_sat_url: string | null;
  opinion_sat_vencimiento: string | null;
  estatus_autorizacion?: "autorizado" | "pendiente";
  creado_por?: string | null;
};

export function CatalogoClientesModule({
  initialClienteId,
}: {
  initialClienteId?: string;
}) {
  const roles = useEffectiveRoles();
  const canManage = roles.includes("director") || roles.includes("administrativo");
  const canRequest =
    canManage ||
    roles.includes("residente") ||
    roles.includes("auxiliar") ||
    roles.includes("supervisor");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "moral" | "fisica">("todos");
  const [tab, setTab] = useState<"todos" | "pendientes">("todos");
  const [creating, setCreating] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(initialClienteId ?? null);
  const [editing, setEditing] = useState<ClienteListRow | null>(null);
  const [toDelete, setToDelete] = useState<ClienteListRow | null>(null);
  const [toReject, setToReject] = useState<ClienteListRow | null>(null);

  const search_ = useSearch({ from: "/_authenticated/app/catalogos/clientes" });
  useEffect(() => {
    if (initialClienteId) setDetalleId(initialClienteId);
  }, [initialClienteId]);
  useEffect(() => {
    if (search_.tab === "pendientes") setTab("pendientes");
    if (search_.id) setDetalleId(search_.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search_.tab, search_.id]);

  const fetchList = useServerFn(listClientes);
  const listQ = useQuery({
    queryKey: ["clientes", search, tipoFiltro, tab],
    queryFn: () =>
      fetchList({
        data: {
          search: search || undefined,
          tipo_persona: tipoFiltro === "todos" ? undefined : tipoFiltro,
          solo_pendientes: tab === "pendientes" ? true : undefined,
        },
      }),
  });

  const eliminar = useServerFn(eliminarCliente);
  const delM = useMutation({
    mutationFn: eliminar,
    onSuccess: () => {
      toast.success("Cliente eliminado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autorizar = useServerFn(autorizarCliente);
  const autM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => {
      toast.success("Cliente autorizado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rechazar = useServerFn(rechazarCliente);
  const rejM = useMutation({
    mutationFn: rechazar,
    onSuccess: () => {
      toast.success("Solicitud rechazada");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setToReject(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows: ClienteListRow[] = (listQ.data ?? []) as ClienteListRow[];

  const conAlertas = useMemo(
    () =>
      rows.filter((r) => {
        const a = estadoVencimiento(r.constancia_fiscal_vencimiento, r.constancia_fiscal_url);
        const b = estadoVencimiento(r.opinion_sat_vencimiento, r.opinion_sat_url);
        return a === "vencido" || b === "vencido" || a === "por_vencer" || b === "por_vencer";
      }).length,
    [rows],
  );

  const pendientesCount = useMemo(
    () => rows.filter((r) => r.estatus_autorizacion === "pendiente").length,
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Clientes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Empresas y personas a las que facturas tus obras.
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
              {canManage ? "Nuevo cliente" : "Solicitar alta"}
            </Button>
          )}
        </div>
      </div>

      {conAlertas > 0 && (
        <Card className="bg-amber-50 border-amber-200 p-4 flex items-center gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900">
            <strong>{conAlertas}</strong> cliente{conAlertas === 1 ? "" : "s"} con documentos
            vencidos o próximos a vencer. Revísalos para mantener tus operaciones al día.
          </p>
        </Card>
      )}

      <Card className="p-3 flex flex-col sm:flex-row sm:flex-nowrap items-stretch sm:items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RFC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as typeof tipoFiltro)}>
          <SelectTrigger className="w-36 h-8 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="moral">Persona moral</SelectItem>
            <SelectItem value="fisica">Persona física</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <TooltipProvider>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Nombre</TableHead>
              <TableHead className="whitespace-nowrap">RFC</TableHead>
              <TableHead className="whitespace-nowrap">Tipo</TableHead>
              <TableHead className="whitespace-nowrap">Teléfono</TableHead>
              <TableHead className="whitespace-nowrap">Correo</TableHead>
              <TableHead className="whitespace-nowrap">Alertas</TableHead>
              <TableHead className="whitespace-nowrap">Estatus</TableHead>
              {(canManage || canRequest) && (
                <TableHead className="w-32 text-right whitespace-nowrap">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Users className="size-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Sin clientes</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tab === "pendientes"
                        ? "No hay solicitudes pendientes de autorización."
                        : "Crea tu primer cliente para vincularlo a tus obras."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => {
                const ec = estadoVencimiento(
                  c.constancia_fiscal_vencimiento,
                  c.constancia_fiscal_url,
                );
                const eo = estadoVencimiento(c.opinion_sat_vencimiento, c.opinion_sat_url);
                const worst =
                  ec === "vencido" || eo === "vencido"
                    ? "vencido"
                    : ec === "por_vencer" || eo === "por_vencer"
                      ? "por_vencer"
                      : null;
                const isPending = c.estatus_autorizacion === "pendiente";

                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setDetalleId(c.id)}
                  >
                    <TableCell className="font-medium whitespace-nowrap max-w-[240px]">
                      <TruncatedCell>{c.razon_social}</TruncatedCell>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{c.rfc}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary">
                        {c.tipo_persona === "moral" ? "Moral" : "Física"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap max-w-[160px]">
                      <TruncatedCell>{c.telefono ?? "—"}</TruncatedCell>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap max-w-[200px]">
                      <TruncatedCell>{c.correo ?? "—"}</TruncatedCell>
                    </TableCell>
                    <TableCell>
                      {worst === "vencido" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">
                              Vencido
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {ec === "vencido" && "Constancia fiscal vencida"}
                            {ec === "vencido" && eo === "vencido" && " · "}
                            {eo === "vencido" && "Opinión SAT vencida"}
                          </TooltipContent>
                        </Tooltip>
                      ) : worst === "por_vencer" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                              Por vencer
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {ec === "por_vencer" && "Constancia próxima a vencer"}
                            {ec === "por_vencer" && eo === "por_vencer" && " · "}
                            {eo === "por_vencer" && "Opinión SAT próxima a vencer"}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
                        className="text-right"
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
                                    onClick={() => autM.mutate({ data: { id: c.id } })}
                                    disabled={autM.isPending}
                                    className="text-emerald-700"
                                  >
                                    <CheckCircle2 className="size-4 mr-2" />
                                    Autorizar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setToReject(c)}
                                    className="text-rose-700"
                                  >
                                    <XCircle className="size-4 mr-2" />
                                    Rechazar
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem onClick={() => setEditing(c)}>
                                <Pencil className="size-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setToDelete(c)}
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
      </Card>
      </TooltipProvider>

      {(creating || editing) && (
        <ClienteFormDialog
          open
          initial={editing ?? null}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ClienteDetalle
        clienteId={detalleId}
        open={!!detalleId}
        onClose={() => setDetalleId(null)}
        canEdit={canManage}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.razon_social}". Si tiene obras vinculadas, la
              eliminación será bloqueada.
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
