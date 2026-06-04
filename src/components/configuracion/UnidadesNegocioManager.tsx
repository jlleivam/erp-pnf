import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listUnidadesNegocio,
  crearUnidadNegocio,
  editarUnidadNegocio,
  eliminarUnidadNegocio,
} from "@/lib/api/unidades-negocio.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

export function UnidadesNegocioManager() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listUnidadesNegocio);
  const createFn = useServerFn(crearUnidadNegocio);
  const editFn = useServerFn(editarUnidadNegocio);
  const delFn = useServerFn(eliminarUnidadNegocio);

  const list = useQuery({ queryKey: ["unidades-negocio"], queryFn: () => fetchList() });

  const [nuevo, setNuevo] = useState("");
  const [editing, setEditing] = useState<{ id: string; nombre: string } | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["unidades-negocio"] });

  const create = useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      setNuevo("");
      toast.success("Unidad creada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = useMutation({
    mutationFn: editFn,
    onSuccess: () => {
      setEditing(null);
      toast.success("Unidad actualizada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: delFn,
    onSuccess: () => {
      toast.success("Unidad eliminada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Las unidades de negocio se usan al crear obras (ej: Residencial, Comercial, Industrial).
      </p>

      <div className="flex gap-2">
        <Input
          placeholder="Nueva unidad…"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nuevo.trim()) {
              e.preventDefault();
              create.mutate({ data: { nombre: nuevo.trim() } });
            }
          }}
        />
        <Button
          type="button"
          onClick={() => create.mutate({ data: { nombre: nuevo.trim() } })}
          disabled={!nuevo.trim() || create.isPending}
        >
          <Plus className="size-4 mr-1" /> Agregar
        </Button>
      </div>

      <div className="border rounded-md divide-y">
        {list.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
        ) : (list.data ?? []).length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aún no hay unidades.</p>
        ) : (
          (list.data ?? []).map((u) => (
            <div key={u.id} className="flex items-center gap-2 px-3 py-2">
              {editing?.id === u.id ? (
                <>
                  <Input
                    value={editing.nombre}
                    onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      edit.mutate({ data: { id: editing.id, nombre: editing.nombre.trim() } })
                    }
                    disabled={!editing.nombre.trim() || edit.isPending}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{u.nombre}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditing({ id: u.id, nombre: u.nombre })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`¿Eliminar "${u.nombre}"?`)) {
                        remove.mutate({ data: { id: u.id } });
                      }
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
