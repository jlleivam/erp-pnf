import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { listInsumos } from "@/lib/api/insumos.functions";
import { crearRequisicion } from "@/lib/api/requisiciones.functions";

interface Props {
  obraId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Bloque {
  insumo_id: string;
  cantidad: string;
  fecha_requerida: Date | undefined;
  nota: string;
}

function emptyBloque(): Bloque {
  return { insumo_id: "", cantidad: "", fecha_requerida: undefined, nota: "" };
}

export function NuevaRequisicionSheet({ obraId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const fetchInsumos = useServerFn(listInsumos);
  const crear = useServerFn(crearRequisicion);

  const insumosQ = useQuery({
    queryKey: ["insumos", "autorizado"],
    queryFn: () => fetchInsumos({ data: { estatus: "autorizado" } }),
    enabled: open,
  });
  const insumos = (insumosQ.data ?? []) as Array<{ id: string; nombre: string; unidad: string }>;

  const [bloques, setBloques] = useState<Bloque[]>([emptyBloque()]);
  const [notas, setNotas] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const items = bloques.map((b) => ({
        insumo_id: b.insumo_id,
        cantidad: Number(b.cantidad),
        fecha_requerida: b.fecha_requerida ? format(b.fecha_requerida, "yyyy-MM-dd") : "",
        nota: b.nota?.trim() || null,
      }));
      for (const it of items) {
        if (!it.insumo_id) throw new Error("Selecciona un insumo en cada bloque");
        if (!(it.cantidad > 0)) throw new Error("Cantidad debe ser mayor a 0");
        if (!it.fecha_requerida) throw new Error("Fecha requerida obligatoria");
      }
      return crear({ data: { obraId, notas: notas.trim() || null, insumos: items } });
    },
    onSuccess: (res) => {
      toast.success(`Requisición ${res.folio} enviada`);
      qc.invalidateQueries({ queryKey: ["requisiciones", obraId] });
      setBloques([emptyBloque()]);
      setNotas("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al enviar"),
  });

  const updateBloque = (i: number, patch: Partial<Bloque>) =>
    setBloques((arr) => arr.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeBloque = (i: number) =>
    setBloques((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nueva requisición</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {bloques.map((b, i) => {
            const insumoSel = insumos.find((x) => x.id === b.insumo_id);
            return (
              <div key={i} className="border rounded-lg p-3 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Insumo {i + 1}
                  </span>
                  {bloques.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeBloque(i)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  <Label>Insumo</Label>
                  <Select
                    value={b.insumo_id}
                    onValueChange={(v) => updateBloque(i, { insumo_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {insumos.map((ins) => (
                        <SelectItem key={ins.id} value={ins.id}>
                          {ins.nombre} ({ins.unidad})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={b.cantidad}
                      onChange={(e) => updateBloque(i, { cantidad: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Unidad</Label>
                    <Input value={insumoSel?.unidad ?? ""} readOnly disabled />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Fecha requerida en obra</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !b.fecha_requerida && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="size-4 mr-2" />
                        {b.fecha_requerida
                          ? format(b.fecha_requerida, "dd/MM/yyyy")
                          : "Selecciona fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={b.fecha_requerida}
                        onSelect={(d) => updateBloque(i, { fecha_requerida: d ?? undefined })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <Label>Nota (opcional)</Label>
                  <Textarea
                    rows={2}
                    value={b.nota}
                    onChange={(e) => updateBloque(i, { nota: e.target.value })}
                  />
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setBloques((arr) => [...arr, emptyBloque()])}
          >
            <Plus className="size-4 mr-1" /> Agregar otro insumo
          </Button>

          <div className="space-y-1">
            <Label>Notas generales</Label>
            <Textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones para administración…"
            />
          </div>

          <Button
            className="w-full"
            disabled={mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "Enviando…" : "Enviar requisición"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
