import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
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
import { listClientes, eliminarCliente } from "@/lib/api/clientes.functions";
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
};

export function CatalogoClientesModule({
  initialClienteId,
}: {
  initialClienteId?: string;
}) {
  const roles = useEffectiveRoles();
  const canEdit = roles.includes("director") || roles.includes("administrativo");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "moral" | "fisica">("todos");
  const [creating, setCreating] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(initialClienteId ?? null);
  const [editing, setEditing] = useState<ClienteListRow | null>(null);
  const [toDelete, setToDelete] = useState<ClienteListRow | null>(null);

  useEffect(() => {
    if (initialClienteId) setDetalleId(initialClienteId);
  }, [initialClienteId]);

  const fetchList = useServerFn(listClientes);
  const listQ = useQuery({
    queryKey: ["clientes", search, tipoFiltro],
    queryFn: () =>
      fetchList({
        data: {
          search: search || undefined,
          tipo_persona: tipoFiltro === "todos" ? undefined : tipoFiltro,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Clientes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Empresas y personas a las que facturas tus obras.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)} className="bg-[#0f1e3d] hover:bg-[#0f1e3d]/90">
            <Plus className="size-4 mr-1" /> Nuevo cliente
          </Button>
        )}
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

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RFC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as typeof tipoFiltro)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="moral">Persona moral</SelectItem>
            <SelectItem value="fisica">Persona física</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razón social</TableHead>
              <TableHead>RFC</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Alertas</TableHead>
              {canEdit && <TableHead className="w-32 text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6} className="text-sm text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6}>
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Users className="size-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Sin clientes aún</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Crea tu primer cliente para vincularlo a tus obras.
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

                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setDetalleId(c.id)}
                  >
                    <TableCell className="font-medium">{c.razon_social}</TableCell>
                    <TableCell className="font-mono text-xs">{c.rfc}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {c.tipo_persona === "moral" ? "Moral" : "Física"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.telefono ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.correo ?? "—"}
                    </TableCell>
                    <TableCell>
                      {worst === "vencido" ? (
                        <TooltipProvider>
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
                        </TooltipProvider>
                      ) : worst === "por_vencer" ? (
                        <TooltipProvider>
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
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(c)}
                          title="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setToDelete(c)}
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

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
        canEdit={canEdit}
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
    </div>
  );
}
