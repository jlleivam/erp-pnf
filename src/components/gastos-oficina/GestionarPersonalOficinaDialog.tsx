import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  listTrabajadoresDisponibles,
  listPersonalOficina,
  actualizarPersonalOficina,
} from "@/lib/api/gastos-oficina.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
};

type Row = {
  id: string;
  nombre_completo: string;
  puesto: string | null;
  esOficina: boolean;
  periodicidad: "semanal" | "quincenal" | "mensual" | "";
  sueldo: string;
};

export function GestionarPersonalOficinaDialog({ open, onOpenChange, onChanged }: Props) {
  const fetchTrab = useServerFn(listTrabajadoresDisponibles);
  const fetchOficina = useServerFn(listPersonalOficina);
  const actualizar = useServerFn(actualizarPersonalOficina);

  const trabQ = useQuery({
    queryKey: ["trabajadores-disponibles"],
    queryFn: () => fetchTrab(),
    enabled: open,
  });
  const oficinaQ = useQuery({
    queryKey: ["gastos-oficina", "personal"],
    queryFn: () => fetchOficina(),
    enabled: open,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!trabQ.data) return;
    const oficinaMap = new Map((oficinaQ.data ?? []).map((p) => [p.id, p]));
    setRows(
      trabQ.data.map((t) => {
        const o = oficinaMap.get(t.id);
        return {
          id: t.id,
          nombre_completo: t.nombre_completo,
          puesto: t.puesto,
          esOficina: t.es_personal_oficina,
          periodicidad: (o?.periodicidad_pago ?? "") as Row["periodicidad"],
          sueldo: o?.sueldo_periodo != null ? String(o.sueldo_periodo) : "",
        };
      })
    );
  }, [trabQ.data, oficinaQ.data]);

  const update = (idx: number, patch: Partial<Row>) => {
    setRows((curr) => curr.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const save = async (row: Row) => {
    setSaving(row.id);
    try {
      await actualizar({
        data: {
          trabajadorId: row.id,
          esPersonalOficina: row.esOficina,
          periodicidad: row.esOficina ? (row.periodicidad || null) as any : null,
          sueldoPeriodo: row.esOficina && row.sueldo ? Number(row.sueldo) : null,
        },
      });
      toast.success("Actualizado");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Personal de oficina</DialogTitle>
          <DialogDescription>
            Marca qué trabajadores pertenecen a la nómina fija de oficina y captura su sueldo por periodo.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead className="w-24">Oficina</TableHead>
                <TableHead className="w-36">Periodicidad</TableHead>
                <TableHead className="w-32">Sueldo periodo</TableHead>
                <TableHead className="w-24 text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.nombre_completo}</div>
                    <div className="text-xs text-muted-foreground">{r.puesto ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={r.esOficina} onCheckedChange={(v) => update(idx, { esOficina: v })} />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={r.periodicidad || undefined}
                      onValueChange={(v) => update(idx, { periodicidad: v as Row["periodicidad"] })}
                      disabled={!r.esOficina}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="quincenal">Quincenal</SelectItem>
                        <SelectItem value="mensual">Mensual</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={r.sueldo}
                      onChange={(e) => update(idx, { sueldo: e.target.value })}
                      disabled={!r.esOficina}
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => save(r)} disabled={saving === r.id}>
                      {saving === r.id ? "…" : "Guardar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
