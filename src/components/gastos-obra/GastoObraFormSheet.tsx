import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Upload, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { listTerceros } from "@/lib/api/terceros.functions";
import { listInsumos } from "@/lib/api/insumos.functions";
import { guardarGastoObra, getGastoObra } from "@/lib/api/gastos-obra.functions";
import { formatMXN } from "@/lib/format";

const BUCKET = "gastos-obra-comprobantes";

interface Props {
  obraId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gastoId?: string | null;
}

interface Partida {
  insumo_id: string;
  cantidad: string;
  precio_unitario: string;
}

function emptyPartida(): Partida {
  return { insumo_id: "", cantidad: "", precio_unitario: "" };
}

export function GastoObraFormSheet({ obraId, open, onOpenChange, gastoId }: Props) {
  const qc = useQueryClient();
  const fetchTerceros = useServerFn(listTerceros);
  const fetchInsumos = useServerFn(listInsumos);
  const guardar = useServerFn(guardarGastoObra);
  const fetchGasto = useServerFn(getGastoObra);

  const [tipo, setTipo] = useState<"servicio" | "material">("servicio");
  const [proveedorId, setProveedorId] = useState("");
  const [provOpen, setProvOpen] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [tipoComprobante, setTipoComprobante] = useState<"factura" | "nota" | "ninguno">("factura");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [partidas, setPartidas] = useState<Partida[]>([emptyPartida()]);
  const [file, setFile] = useState<File | null>(null);
  const [comprobantePath, setComprobantePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const tercerosQ = useQuery({
    queryKey: ["terceros", "proveedores"],
    queryFn: () => fetchTerceros({ data: {} }),
    enabled: open,
  });
  const proveedores = ((tercerosQ.data ?? []) as any[]).filter(
    (t) => t.categoria === "proveedor" || t.categoria === "ambos",
  );

  const insumosQ = useQuery({
    queryKey: ["insumos", "autorizado"],
    queryFn: () => fetchInsumos({ data: { estatus: "autorizado" } }),
    enabled: open && tipo === "material",
  });
  const insumos = (insumosQ.data ?? []) as Array<{ id: string; nombre: string; unidad: string }>;

  const gastoQ = useQuery({
    queryKey: ["gasto-obra", gastoId],
    queryFn: () => fetchGasto({ data: { id: gastoId! } }),
    enabled: open && !!gastoId,
  });

  useEffect(() => {
    if (!open) return;
    if (!gastoId) {
      setTipo("servicio"); setProveedorId(""); setConcepto("");
      setTipoComprobante("factura"); setFecha(new Date().toISOString().slice(0, 10));
      setMonto(""); setNotas(""); setPartidas([emptyPartida()]);
      setFile(null); setComprobantePath(null);
      return;
    }
    const d: any = gastoQ.data;
    if (!d?.gasto) return;
    setTipo(d.gasto.tipo);
    setProveedorId(d.gasto.proveedor_id ?? "");
    setConcepto(d.gasto.concepto ?? "");
    setTipoComprobante(d.gasto.tipo_comprobante);
    setFecha(d.gasto.fecha);
    setMonto(String(d.gasto.monto_total ?? ""));
    setNotas(d.gasto.notas ?? "");
    setComprobantePath(d.gasto.comprobante_path ?? null);
    setPartidas(
      (d.partidas ?? []).length > 0
        ? d.partidas.map((p: any) => ({
            insumo_id: p.insumo_id,
            cantidad: String(p.cantidad),
            precio_unitario: String(p.precio_unitario),
          }))
        : [emptyPartida()],
    );
  }, [open, gastoId, gastoQ.data]);

  const totalPartidas = useMemo(
    () =>
      partidas.reduce(
        (s, p) => s + (Number(p.cantidad) || 0) * (Number(p.precio_unitario) || 0),
        0,
      ),
    [partidas],
  );

  useEffect(() => {
    if (tipo === "material") setMonto(totalPartidas ? totalPartidas.toFixed(2) : "");
  }, [tipo, totalPartidas]);

  const guardarM = useMutation({
    mutationFn: async (enviar: boolean) => {
      if (!proveedorId) throw new Error("Selecciona el proveedor");
      if (concepto.trim().length < 3) throw new Error("Describe el concepto del gasto");
      const montoNum = Number(monto);
      if (!montoNum || montoNum <= 0) throw new Error("Captura un monto válido");
      if (tipo === "material" && partidas.every((p) => !p.insumo_id)) {
        throw new Error("Agrega al menos un insumo");
      }

      let path = comprobantePath;
      if (file) {
        setUploading(true);
        try {
          const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
          path = `${obraId}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
          if (error) throw new Error(`Error al subir comprobante: ${error.message}`);
        } finally {
          setUploading(false);
        }
      }
      if (tipoComprobante !== "ninguno" && !path) {
        throw new Error("Sube el archivo del comprobante");
      }

      return guardar({
        data: {
          id: gastoId ?? null,
          obraId,
          tipo,
          proveedorId,
          concepto: concepto.trim(),
          tipoComprobante,
          comprobantePath: path,
          fecha,
          montoTotal: montoNum,
          notas: notas.trim() || null,
          partidas:
            tipo === "material"
              ? partidas
                  .filter((p) => p.insumo_id && Number(p.cantidad) > 0)
                  .map((p) => ({
                    insumo_id: p.insumo_id,
                    cantidad: Number(p.cantidad),
                    precio_unitario: Number(p.precio_unitario) || 0,
                  }))
              : [],
          enviar,
        },
      });
    },
    onSuccess: (_r, enviar) => {
      toast.success(enviar ? "Gasto enviado a autorización" : "Borrador guardado");
      qc.invalidateQueries({ queryKey: ["gastos-obra"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar"),
  });

  const proveedorLabel =
    proveedores.find((p) => p.id === proveedorId)?.razon_social ?? "Selecciona proveedor";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{gastoId ? "Editar gasto de obra" : "Nuevo gasto de obra"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo de gasto *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="servicio">Servicio (gasto directo)</SelectItem>
                  <SelectItem value="material">Material (entra a almacén)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Proveedor *</Label>
            <Popover open={provOpen} onOpenChange={setProvOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  {proveedorLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <Command>
                  <CommandInput placeholder="Buscar por razón social o nombre comercial..." />
                  <CommandList>
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandGroup>
                      {proveedores.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.razon_social} ${p.nombre_comercial ?? ""}`}
                          onSelect={() => { setProveedorId(p.id); setProvOpen(false); }}
                        >
                          <div>
                            <p className="text-sm">{p.razon_social}</p>
                            {p.nombre_comercial && (
                              <p className="text-xs text-muted-foreground">{p.nombre_comercial}</p>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Concepto *</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Visita de topografía / Viaje de arena"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Comprobante *</Label>
              <Select value={tipoComprobante} onValueChange={(v) => setTipoComprobante(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="factura">Factura</SelectItem>
                  <SelectItem value="nota">Nota</SelectItem>
                  <SelectItem value="ninguno">Sin comprobante</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {tipoComprobante === "factura"
                  ? "Se pagará desde una cuenta bancaria."
                  : "Se pagará en efectivo desde la caja fuerte."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Monto total *</Label>
              <Input
                type="number" step="0.01" min="0" value={monto}
                disabled={tipo === "material"}
                onChange={(e) => setMonto(e.target.value)}
              />
              {tipo === "material" && (
                <p className="text-xs text-muted-foreground">
                  Calculado de las partidas: {formatMXN(totalPartidas)}
                </p>
              )}
            </div>
          </div>

          {tipoComprobante !== "ninguno" && (
            <div className="space-y-1.5">
              <Label>Archivo del comprobante *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {comprobantePath && !file && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="size-3" /> cargado
                  </span>
                )}
              </div>
            </div>
          )}

          {tipo === "material" && (
            <Card className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Insumos que entran al almacén</p>
                <Button
                  size="sm" variant="outline"
                  onClick={() => setPartidas((p) => [...p, emptyPartida()])}
                >
                  <Plus className="size-4" /> Agregar
                </Button>
              </div>
              {partidas.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <Select
                      value={p.insumo_id}
                      onValueChange={(v) =>
                        setPartidas((arr) => arr.map((x, j) => (j === i ? { ...x, insumo_id: v } : x)))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Insumo" /></SelectTrigger>
                      <SelectContent>
                        {insumos.map((ins) => (
                          <SelectItem key={ins.id} value={ins.id}>
                            {ins.nombre} ({ins.unidad})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number" step="0.001" min="0" placeholder="Cant."
                      value={p.cantidad}
                      onChange={(e) =>
                        setPartidas((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number" step="0.01" min="0" placeholder="P. unit."
                      value={p.precio_unitario}
                      onChange={(e) =>
                        setPartidas((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, precio_unitario: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => setPartidas((arr) => arr.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={guardarM.isPending || uploading}
              onClick={() => guardarM.mutate(false)}
            >
              Guardar borrador
            </Button>
            <Button
              disabled={guardarM.isPending || uploading}
              onClick={() => guardarM.mutate(true)}
            >
              <Upload className="size-4" /> Enviar a autorización
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
