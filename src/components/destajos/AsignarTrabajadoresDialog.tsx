import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  asignarTrabajadores,
  listAsignacionesActivas,
} from "@/lib/api/destajos.functions";
import { listTrabajadores } from "@/lib/api/trabajadores.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search } from "lucide-react";

export function AsignarTrabajadoresDialog({
  destajoId,
  destajistaId,
  asignadosActuales,
  onClose,
  onSaved,
}: {
  destajoId: string;
  destajistaId?: string;
  asignadosActuales: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const fetchTrabs = useServerFn(listTrabajadores);
  const trabsQ = useQuery({
    queryKey: ["trabajadores-lista"],
    queryFn: () => fetchTrabs({ data: {} }),
  });
  const fetchAsign = useServerFn(listAsignacionesActivas);
  const asignQ = useQuery({
    queryKey: ["destajo-asignaciones-activas"],
    queryFn: () => fetchAsign({ data: {} }),
  });

  const initialSet = new Set(asignadosActuales);
  if (destajistaId) initialSet.add(destajistaId);
  const [selected, setSelected] = useState<Set<string>>(initialSet);

  const [filter, setFilter] = useState("");

  const trabajadores = (trabsQ.data ?? []) as Array<{
    id: string;
    nombre_completo: string;
    puesto: string | null;
    estatus_autorizacion: string;
  }>;
  const asignaciones = (asignQ.data ?? []) as Array<{
    trabajador_id: string;
    destajo_id: string;
    destajo_nombre: string;
  }>;

  const ocupadosEnOtro = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of asignaciones) {
      if (a.destajo_id !== destajoId) m.set(a.trabajador_id, a.destajo_nombre);
    }
    return m;
  }, [asignaciones, destajoId]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return trabajadores
      .filter((t) => t.estatus_autorizacion === "autorizado")
      .filter((t) => !f || t.nombre_completo.toLowerCase().includes(f));
  }, [trabajadores, filter]);

  const toggle = (id: string) => {
    if (id === destajistaId) return; // destajista no se puede desasignar
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };


  const save = useServerFn(asignarTrabajadores);
  const m = useMutation({
    mutationFn: save,
    onSuccess: () => {
      toast.success("Asignación actualizada");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Asignar trabajadores al destajo</DialogTitle>
          <DialogDescription>
            Los trabajadores asignados aparecen bloqueados en la nómina semanal de la
            obra. Un trabajador solo puede estar activo en un destajo a la vez.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar trabajador…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <Card className="max-h-80 overflow-y-auto divide-y">
          {trabsQ.isLoading || asignQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              Sin trabajadores.
            </p>
          ) : (
            filtered.map((t) => {
              const esDestajista = t.id === destajistaId;
              const enOtro = ocupadosEnOtro.get(t.id);
              const checked = selected.has(t.id) || esDestajista;
              const disabled = esDestajista || (!!enOtro && !checked);
              return (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 ${
                    disabled ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={() => toggle(t.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t.nombre_completo}</p>
                    <p className="text-xs text-muted-foreground">{t.puesto ?? "—"}</p>
                  </div>
                  {esDestajista && <Badge>Destajista</Badge>}
                  {!esDestajista && enOtro && (
                    <Badge variant="outline" title={`Asignado a: ${enOtro}`}>
                      En "{enOtro}"
                    </Badge>
                  )}
                </label>
              );
            })

          )}
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={m.isPending}
            onClick={() =>
              m.mutate({
                data: {
                  destajoId,
                  trabajadorIds: Array.from(selected),
                },
              })
            }
          >
            {m.isPending ? "Guardando…" : "Guardar asignación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
