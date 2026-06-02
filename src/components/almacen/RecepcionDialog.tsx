import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOCParaRecepcion, registrarRecepcion } from "@/lib/api/almacen.functions";

interface Props {
  ocId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function RecepcionDialog({ ocId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getOCParaRecepcion);
  const regFn = useServerFn(registrarRecepcion);

  const { data, isLoading } = useQuery({
    queryKey: ["almacen", "oc-recepcion", ocId],
    queryFn: () => getFn({ data: { ocId } }),
    enabled: open,
  });

  const [folio, setFolio] = useState("");
  const [fecha, setFecha] = useState(todayIso());
  const [notas, setNotas] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, string>>({});

  // Inicializar cantidades cuando llegan los datos
  useEffect(() => {
    if (!data) return;
    const items = (data.oc as any).paquete?.items ?? [];
    const next: Record<string, string> = {};
    for (const it of items) {
      const pendiente =
        Number(it.cantidad) - (Number(data.recibidoPorInsumo[it.insumo.id] ?? 0));
      next[it.insumo.id] = pendiente > 0 ? String(pendiente) : "0";
    }
    setCantidades(next);
  }, [data]);

  const items = useMemo(() => {
    if (!data) return [];
    const arr = (data.oc as any).paquete?.items ?? [];
    return arr.map((it: any) => {
      const recibido = Number(data.recibidoPorInsumo[it.insumo.id] ?? 0);
      const pendiente = Math.max(0, Number(it.cantidad) - recibido);
      return { ...it, recibido, pendiente };
    });
  }, [data]);

  const guardarMut = useMutation({
    mutationFn: async () => {
      const partidas: Array<any> = [];
      for (const it of items) {
        const n = Number(cantidades[it.insumo.id] ?? "0");
        if (n > 0) {
          if (n > it.pendiente + 1e-6) {
            throw new Error(`"${it.insumo.nombre}": cantidad excede lo pendiente`);
          }
          partidas.push({
            insumo_id: it.insumo.id,
            cantidad: n,
            precio_unitario: Number(it.precio_unitario),
          });
        }
      }
      if (partidas.length === 0) throw new Error("Captura al menos una cantidad recibida");
      return regFn({
        data: {
          ocId,
          folioRemision: folio.trim() || null,
          fecha,
          notas: notas.trim() || null,
          partidas,
        },
      });
    },
    onSuccess: () => {
      toast.success("Recepción registrada");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["almacen"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al registrar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Registrar recepción {data ? `· OC ${(data.oc as any).folio}` : ""}
          </DialogTitle>
          <DialogDescription>
            {data ? `Proveedor: ${(data.oc as any).proveedor?.razon_social ?? "—"}` : "Cargando…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="folio">Folio de remisión</Label>
                <Input id="folio" value={folio} onChange={(e) => setFolio(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha de recepción</Label>
                <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notas">Notas (opcional)</Label>
              <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={500} />
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Pedido</TableHead>
                    <TableHead className="text-right">Ya recibido</TableHead>
                    <TableHead className="text-right">Recibir ahora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it: any) => (
                    <TableRow key={it.insumo.id}>
                      <TableCell>{it.insumo.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">{it.insumo.unidad}</TableCell>
                      <TableCell className="text-right">{Number(it.cantidad)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{it.recibido}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={it.pendiente}
                          value={cantidades[it.insumo.id] ?? ""}
                          onChange={(e) =>
                            setCantidades((c) => ({ ...c, [it.insumo.id]: e.target.value }))
                          }
                          className="h-8 w-24 text-right ml-auto"
                          disabled={it.pendiente <= 0}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => guardarMut.mutate()} disabled={guardarMut.isPending || !data}>
            {guardarMut.isPending ? "Guardando…" : "Registrar recepción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
