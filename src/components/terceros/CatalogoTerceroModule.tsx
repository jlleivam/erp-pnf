import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
  eliminarTercero,
  listTerceros,
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
    if (!d) return "vencido"; // falta
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
  const canEdit = roles.includes("director") || roles.includes("administrativo");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [catFiltro, setCatFiltro] = useState<TerceroCategoria | "todos">("todos");
  const [personaFiltro, setPersonaFiltro] = useState<TipoPersona | "todos">("todos");
  const [docFiltro, setDocFiltro] = useState<DocStatus | "todos">("todos");
  const [creating, setCreating] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TerceroListRow | null>(null);
  const [toDelete, setToDelete] = useState<TerceroListRow | null>(null);

  const fetchList = useServerFn(listTerceros);
  const listQ = useQuery({
    queryKey: ["terceros", search, catFiltro, personaFiltro],
    queryFn: () =>
      fetchList({
        data: {
          search: search || undefined,
          categoria: catFiltro === "todos" ? undefined : catFiltro,
          tipo_persona: personaFiltro === "todos" ? undefined : personaFiltro,
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


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Proveedores y Contratistas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Proveedores y contratistas que te suministran materiales o ejecutan trabajos contratados.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-[#0f1e3d] hover:bg-[#0f1e3d]/90"
          >
            <Plus className="size-4 mr-1" /> Nuevo
          </Button>
        )}
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
              {canEdit && <TableHead className="whitespace-nowrap w-auto text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 7 : 6}
                  className="text-sm text-muted-foreground"
                >
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 7 : 6}>
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Building2 className="size-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Sin registros aún</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Crea tu primer proveedor o contratista para empezar.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const s = STATUS_BADGE[r._status];
                const shortLabel = r._status === "vencido" ? "Faltante" : s.label;
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
                    {canEdit && (
                      <TableCell
                        className="whitespace-nowrap w-auto text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
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
        canEdit={canEdit}
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
    </div>
  );
}
