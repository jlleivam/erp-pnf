import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listTareasObra,
  actualizarTareaEstatus,
  eliminarTarea,
  type TareaEstatus,
} from "@/lib/api/tareas.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { NuevaTareaDialog } from "./NuevaTareaDialog";
import { useAuthStore } from "@/stores/auth";

const ESTATUS_LABEL: Record<TareaEstatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  cancelada: "Cancelada",
};
const ESTATUS_VARIANT: Record<TareaEstatus, "default" | "secondary" | "outline" | "destructive"> = {
  pendiente: "outline",
  en_progreso: "default",
  completada: "secondary",
  cancelada: "destructive",
};

export function TareasModule({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.userId);
  const fetchTareas = useServerFn(listTareasObra);
  const actualizar = useServerFn(actualizarTareaEstatus);
  const eliminar = useServerFn(eliminarTarea);

  const [openNueva, setOpenNueva] = useState(false);
  const [filtroEstatus, setFiltroEstatus] = useState<"todas" | TareaEstatus>("todas");
  const [filtroAsignado, setFiltroAsignado] = useState<"todos" | "mias">("todas" as "todas" === "todas" ? "todos" : "todos");

  const { data: tareas, isLoading } = useQuery({
    queryKey: ["tareas-obra", obraId],
    queryFn: () => fetchTareas({ data: { obraId } }),
  });

  const mEstatus = useMutation({
    mutationFn: (vars: { id: string; estatus: TareaEstatus }) => actualizar({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tareas-obra", obraId] });
      qc.invalidateQueries({ queryKey: ["mis-tareas-obra", obraId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => eliminar({ data: { id } }),
    onSuccess: () => {
      toast.success("Tarea eliminada");
      qc.invalidateQueries({ queryKey: ["tareas-obra", obraId] });
      qc.invalidateQueries({ queryKey: ["mis-tareas-obra", obraId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const filtradas = (tareas ?? []).filter((t) => {
    if (filtroEstatus !== "todas" && t.estatus !== filtroEstatus) return false;
    if (filtroAsignado === "mias" && t.asignado_a !== userId) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tareas</h1>
          <p className="text-sm text-muted-foreground">Gestión de pendientes de la obra</p>
        </div>
        <Button onClick={() => setOpenNueva(true)}>
          <Plus className="size-4" /> Nueva tarea
        </Button>
      </header>

      <Card className="p-4">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Select value={filtroEstatus} onValueChange={(v) => setFiltroEstatus(v as typeof filtroEstatus)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los estatus</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="en_progreso">En progreso</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroAsignado} onValueChange={(v) => setFiltroAsignado(v as typeof filtroAsignado)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los asignados</SelectItem>
              <SelectItem value="mias">Solo mías</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin tareas que mostrar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Asignado</TableHead>
                <TableHead>Fecha límite</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((t) => {
                const done = t.estatus === "completada";
                const canDelete = t.creado_por === userId;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Checkbox
                        checked={done}
                        onCheckedChange={(v) =>
                          mEstatus.mutate({ id: t.id, estatus: v ? "completada" : "pendiente" })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className={done ? "line-through text-muted-foreground" : ""}>
                        <p className="font-medium">{t.titulo}</p>
                        {t.descripcion && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {t.descripcion}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{t.asignado_nombre ?? "—"}</TableCell>
                    <TableCell className="text-sm">{formatDate(t.fecha_limite)}</TableCell>
                    <TableCell>
                      <Badge variant={ESTATUS_VARIANT[t.estatus]}>{ESTATUS_LABEL[t.estatus]}</Badge>
                    </TableCell>
                    <TableCell>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => mDelete.mutate(t.id)}
                          disabled={mDelete.isPending}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <NuevaTareaDialog
        obraId={obraId}
        open={openNueva}
        onOpenChange={setOpenNueva}
        defaultAsignado={userId ?? undefined}
      />
    </div>
  );
}
