import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, startOfDay } from "date-fns";
import { CalendarIcon, Plus, Trash2, Search, Check, Save, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
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
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { listInsumos, listCategorias, solicitarInsumo, listUnidades } from "@/lib/api/insumos.functions";
import { useEffectiveRoles, isDirector as checkDirector } from "@/stores/auth";
import {
  guardarBorradorRequisicion,
  enviarBorradorRequisicion,
  getBorradorRequisicion,
} from "@/lib/api/requisiciones.functions";


interface Props {
  obraId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borradorId?: string | null;
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

export function NuevaRequisicionSheet({ obraId, open, onOpenChange, borradorId }: Props) {
  const qc = useQueryClient();
  const fetchInsumos = useServerFn(listInsumos);
  const fetchCategorias = useServerFn(listCategorias);
  const guardarBorrador = useServerFn(guardarBorradorRequisicion);
  const enviarBorrador = useServerFn(enviarBorradorRequisicion);
  const fetchBorrador = useServerFn(getBorradorRequisicion);

  const insumosQ = useQuery({
    queryKey: ["insumos", "autorizado"],
    queryFn: () => fetchInsumos({ data: { estatus: "autorizado" } }),
    enabled: open,
  });
  const insumos = (insumosQ.data ?? []) as Array<{
    id: string; nombre: string; unidad: string;
    categoria?: { id: string; nombre: string } | null;
  }>;

  const categoriasQ = useQuery({
    queryKey: ["insumo-categorias"],
    queryFn: () => fetchCategorias(),
    enabled: open,
  });
  const categorias = (categoriasQ.data ?? []) as Array<{ id: string; nombre: string }>;


  const [bloques, setBloques] = useState<Bloque[]>([emptyBloque()]);
  const [notas, setNotas] = useState("");
  const [openFechaIdx, setOpenFechaIdx] = useState<number | null>(null);
  const [currentBorradorId, setCurrentBorradorId] = useState<string | null>(borradorId ?? null);

  // Reset y carga del borrador cuando abre
  useEffect(() => {
    if (!open) return;
    setCurrentBorradorId(borradorId ?? null);
    if (!borradorId) {
      setBloques([emptyBloque()]);
      setNotas("");
      return;
    }
    fetchBorrador({ data: { id: borradorId } })
      .then((r: any) => {
        setNotas(r.notas ?? "");
        const items = (r.items ?? []) as Array<any>;
        if (items.length === 0) {
          setBloques([emptyBloque()]);
        } else {
          setBloques(
            items.map((it) => ({
              insumo_id: it.insumo_id ?? "",
              cantidad: it.cantidad != null ? String(it.cantidad) : "",
              fecha_requerida: it.fecha_requerida ? parseISO(it.fecha_requerida) : undefined,
              nota: it.nota ?? "",
            })),
          );
        }
      })
      .catch((e: any) => toast.error(e?.message ?? "Error al cargar borrador"));
  }, [open, borradorId, fetchBorrador]);

  const resetForm = () => {
    setBloques([emptyBloque()]);
    setNotas("");
    setCurrentBorradorId(null);
  };

  const invalidateLists = () => {
    qc.invalidateQueries({ queryKey: ["requisiciones", obraId] });
  };

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
      // Si no hay borrador, primero creamos uno y luego lo enviamos
      let bid = currentBorradorId;
      if (!bid) {
        const created = await guardarBorrador({
          data: {
            obraId,
            notas: notas.trim() || null,
            insumos: items.map((it) => ({
              insumo_id: it.insumo_id,
              cantidad: it.cantidad,
              fecha_requerida: it.fecha_requerida,
              nota: it.nota,
            })),
          },
        });
        bid = (created as any).id as string;
      }
      return enviarBorrador({
        data: { borradorId: bid, notas: notas.trim() || null, insumos: items },
      });
    },
    onSuccess: (res: any) => {
      toast.success(`Requisición ${res.folio} enviada`);
      invalidateLists();
      resetForm();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al enviar"),
  });

  const guardar = useMutation({
    mutationFn: async () => {
      const items = bloques.map((b) => ({
        insumo_id: b.insumo_id || null,
        cantidad: b.cantidad !== "" ? Number(b.cantidad) : null,
        fecha_requerida: b.fecha_requerida ? format(b.fecha_requerida, "yyyy-MM-dd") : null,
        nota: b.nota?.trim() || null,
      }));
      const hasAny = items.some(
        (it) => it.insumo_id || (it.cantidad ?? 0) > 0 || it.fecha_requerida || it.nota,
      );
      if (!hasAny && !notas.trim()) {
        throw new Error("Agrega al menos un dato antes de guardar el borrador");
      }
      const res = await guardarBorrador({
        data: {
          borradorId: currentBorradorId ?? undefined,
          obraId,
          notas: notas.trim() || null,
          insumos: items,
        },
      });
      return res as { id: string };
    },
    onSuccess: (res) => {
      setCurrentBorradorId(res.id);
      toast.success("Borrador guardado");
      invalidateLists();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al guardar borrador"),
  });

  const updateBloque = (i: number, patch: Partial<Bloque>) =>
    setBloques((arr) => arr.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeBloque = (i: number) =>
    setBloques((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {currentBorradorId ? "Editar borrador de requisición" : "Nueva requisición"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 mt-4">
          {bloques.map((b, i) => {
            const insumoSel = insumos.find((x) => x.id === b.insumo_id);
            return (
              <div key={i} className="border rounded-lg p-2.5 space-y-2 relative text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Insumo {i + 1}
                  </span>
                  {bloques.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => removeBloque(i)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[11px]">Insumo</Label>
                  <InsumoPicker
                    insumos={insumos}
                    categorias={categorias}
                    value={b.insumo_id}
                    onChange={(v) => updateBloque(i, { insumo_id: v })}
                    disabledIds={bloques
                      .filter((_, idx) => idx !== i)
                      .map((x) => x.insumo_id)
                      .filter(Boolean)}
                  />
                </div>


                <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Cantidad</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={b.cantidad}
                      onChange={(e) => updateBloque(i, { cantidad: e.target.value })}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Unidad</Label>
                    <Input
                      className="h-8 text-xs"
                      value={insumoSel?.unidad ?? ""}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Fecha requerida</Label>
                    <Popover
                      open={openFechaIdx === i}
                      onOpenChange={(v) => setOpenFechaIdx(v ? i : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-8 px-2 justify-start text-left font-normal text-xs",
                            !b.fecha_requerida && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="size-3.5 mr-1.5" />
                          {b.fecha_requerida
                            ? format(b.fecha_requerida, "dd/MM/yyyy")
                            : "Selecciona"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={b.fecha_requerida}
                          onSelect={(d) => {
                            updateBloque(i, { fecha_requerida: d ?? undefined });
                            setOpenFechaIdx(null);
                          }}
                          initialFocus
                          startMonth={startOfDay(new Date())}
                          disabled={{ before: startOfDay(new Date()) }}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <Label className="text-[11px]">Nota (opcional)</Label>
                  <Textarea
                    rows={1}
                    className="min-h-[32px] text-xs resize-none"
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

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              variant="outline"
              className="w-full sm:w-auto sm:flex-1"
              disabled={guardar.isPending || mut.isPending}
              onClick={() => guardar.mutate()}
            >
              <Save className="size-4 mr-1" />
              {guardar.isPending ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button
              className="w-full sm:w-auto sm:flex-1"
              disabled={mut.isPending || guardar.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? "Enviando…" : "Enviar requisición"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type InsumoItem = {
  id: string;
  nombre: string;
  unidad: string;
  categoria?: { id: string; nombre: string } | null;
};

function InsumoPicker({
  insumos,
  categorias,
  value,
  onChange,
  disabledIds,
}: {
  insumos: InsumoItem[];
  categorias: Array<{ id: string; nombre: string }>;
  value: string;
  onChange: (id: string) => void;
  disabledIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [categoriaId, setCategoriaId] = useState<string>("all");

  const selected = insumos.find((x) => x.id === value);

  const filtered = useMemo(() => {
    const base =
      categoriaId === "all"
        ? insumos
        : categoriaId === "none"
          ? insumos.filter((i) => !i.categoria)
          : insumos.filter((i) => i.categoria?.id === categoriaId);
    return [...base].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base", numeric: true }),
    );
  }, [insumos, categoriaId]);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-8 flex-1 justify-start text-left font-normal text-xs px-2 truncate",
              !selected && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {selected ? selected.nombre : "Selecciona…"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
          <div className="p-2 border-b">
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Command
            filter={(value, search) => {
              const norm = (s: string) =>
                s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
              return norm(value).includes(norm(search)) ? 1 : 0;
            }}
          >
            <CommandInput autoFocus placeholder="Buscar insumo…" className="h-9 text-xs" />
            <CommandList className="max-h-64">
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {filtered.map((ins) => {
                  const isDisabled = disabledIds?.includes(ins.id) ?? false;
                  return (
                    <CommandItem
                      key={ins.id}
                      value={`${ins.nombre} ${ins.unidad} ${ins.categoria?.nombre ?? ""}`}
                      disabled={isDisabled}
                      onSelect={() => {
                        if (isDisabled) return;
                        onChange(ins.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "text-xs",
                        isDisabled && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-3.5",
                          value === ins.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">
                          {ins.nombre} <span className="text-muted-foreground">({ins.unidad})</span>
                        </div>
                        {ins.categoria?.nombre && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {ins.categoria.nombre}
                          </div>
                        )}
                      </div>
                      {isDisabled && (
                        <span className="ml-2 text-[10px] text-muted-foreground shrink-0">
                          Ya agregado
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        className="h-8 w-8 p-0 shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Buscar insumo"
      >
        <Search className="size-3.5" />
      </Button>
    </div>
  );
}

