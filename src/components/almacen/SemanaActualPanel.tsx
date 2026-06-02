import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate, formatMXN } from "@/lib/format";
import { getSemanaActual, actualizarUtilizado, cerrarSemana } from "@/lib/api/almacen.functions";

export function SemanaActualPanel({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(getSemanaActual);
  const actualizarFn = useServerFn(actualizarUtilizado);
  const cerrarFn = useServerFn(cerrarSemana);

  const { data, isLoading } = useQuery({
    queryKey: ["almacen", "semana-actual", obraId],
    queryFn: () => fn({ data: { obraId } }),
  });

  const [cerrarOpen, setCerrarOpen] = useState(false);

  const updateMut = useMutation({
    mutationFn: (input: { movimientoId: string; utilizado: number }) =>
      actualizarFn({ data: input }),
    onError: (e: any) => toast.error(e?.message ?? "Error al guardar"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["almacen", "semana-actual", obraId] });
    },
  });

  const cerrarMut = useMutation({
    mutationFn: (semanaId: string) => cerrarFn({ data: { semanaId } }),
    onSuccess: () => {
      toast.success("Semana cerrada");
      setCerrarOpen(false);
      qc.invalidateQueries({ queryKey: ["almacen", "semana-actual", obraId] });
      qc.invalidateQueries({ queryKey: ["almacen", "historial", obraId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al cerrar la semana"),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data) return null;

  const items = data.items;
  const totRecibido = items.reduce(
    (s: number, m: any) => s + Number(m.recibido) * Number(m.precio_unitario), 0,
  );
  const totUtilizado = items.reduce(
    (s: number, m: any) => s + Number(m.utilizado) * Number(m.precio_unitario), 0,
  );

  return (
    <div className="space-y-3">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">Semana</span>
            <Badge className="bg-emerald-100 text-emerald-800">Abierta</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(data.semana.semana_inicio)} – {formatDate(data.semana.semana_fin)}
          </p>
        </div>
        <Button onClick={() => setCerrarOpen(true)} disabled={items.length === 0}>
          <Lock className="size-4 mr-2" /> Cerrar semana
        </Button>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">PU</TableHead>
                <TableHead className="text-right">Inv. inicial</TableHead>
                <TableHead className="text-right">Recibido</TableHead>
                <TableHead className="text-right">Utilizado</TableHead>
                <TableHead className="text-right">Inv. final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m: any) => (
                <MovRow
                  key={m.id}
                  mov={m}
                  onSave={(val) => updateMut.mutate({ movimientoId: m.id, utilizado: val })}
                />
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Aún no hay material en el almacén esta semana. Registra recepciones desde la pestaña "Por recibir".
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {items.length > 0 && (
          <div className="border-t p-3 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Valor recibido: </span>
              <span className="font-medium">{formatMXN(totRecibido)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Valor utilizado: </span>
              <span className="font-medium">{formatMXN(totUtilizado)}</span>
            </div>
          </div>
        )}
      </Card>

      <AlertDialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar la semana</AlertDialogTitle>
            <AlertDialogDescription>
              Se marcará como cerrada y el inventario final de cada insumo será el inventario inicial de la siguiente semana. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cerrarMut.mutate(data.semana.id);
              }}
              disabled={cerrarMut.isPending}
            >
              {cerrarMut.isPending ? "Cerrando…" : "Cerrar semana"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MovRow({ mov, onSave }: { mov: any; onSave: (utilizado: number) => void }) {
  const [val, setVal] = useState<string>(String(Number(mov.utilizado)));
  useEffect(() => { setVal(String(Number(mov.utilizado))); }, [mov.utilizado]);
  const final = Number(mov.inv_inicial) + Number(mov.recibido) - (Number(val) || 0);
  const max = Number(mov.inv_inicial) + Number(mov.recibido);
  const overflow = Number(val) > max + 1e-6;

  return (
    <TableRow>
      <TableCell>{mov.insumo?.nombre ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{mov.proveedor || "—"}</TableCell>
      <TableCell className="text-muted-foreground">{mov.insumo?.unidad ?? "—"}</TableCell>
      <TableCell className="text-right">{formatMXN(Number(mov.precio_unitario))}</TableCell>
      <TableCell className="text-right">{Number(mov.inv_inicial)}</TableCell>
      <TableCell className="text-right">{Number(mov.recibido)}</TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="0.01"
          min={0}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            const n = Number(val);
            if (isNaN(n) || n < 0) { setVal(String(Number(mov.utilizado))); return; }
            if (n === Number(mov.utilizado)) return;
            onSave(n);
          }}
          className={`h-8 w-24 text-right ml-auto ${overflow ? "border-rose-500" : ""}`}
        />
      </TableCell>
      <TableCell className={`text-right font-medium ${final < 0 ? "text-rose-600" : ""}`}>
        {final}
      </TableCell>
    </TableRow>
  );
}
