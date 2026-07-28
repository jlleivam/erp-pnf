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
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOCParaRecepcion, registrarRecepcion } from "@/lib/api/almacen.functions";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface Props {
  ocId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const ACCEPT = "image/*,application/pdf";

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
  const [sinRemision, setSinRemision] = useState(false);
  const [motivoSinRemision, setMotivoSinRemision] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  // Reset al cerrar
  useEffect(() => {
    if (!open) {
      setFolio("");
      setNotas("");
      setSinRemision(false);
      setMotivoSinRemision("");
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

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

      if (!sinRemision && !file) {
        throw new Error("Adjunta la foto de la remisión o marca 'Sin remisión'");
      }

      let evidenciaPath: string | null = null;
      if (!sinRemision && file) {
        setUploading(true);
        try {
          const oc = data!.oc as any;
          const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
          const path = `${oc.company_id ?? "c"}/${oc.obra_id}/${oc.id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("almacen-remisiones")
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) throw new Error(`Error al subir evidencia: ${upErr.message}`);
          evidenciaPath = path;
        } finally {
          setUploading(false);
        }
      }

      return regFn({
        data: {
          ocId,
          folioRemision: sinRemision ? null : (folio.trim() || null),
          fecha,
          notas: notas.trim() || null,
          sinRemision,
          motivoSinRemision: sinRemision ? (motivoSinRemision.trim() || null) : null,
          evidenciaPath,
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

  const busy = guardarMut.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                <Input
                  id="folio"
                  value={folio}
                  onChange={(e) => setFolio(e.target.value)}
                  maxLength={100}
                  disabled={sinRemision}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha de recepción</Label>
                <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>

            {/* Evidencia */}
            <div className="rounded-md border p-3 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sin-remision"
                  checked={sinRemision}
                  onCheckedChange={(v) => {
                    const val = !!v;
                    setSinRemision(val);
                    if (val) setFile(null);
                  }}
                />
                <Label htmlFor="sin-remision" className="cursor-pointer">
                  Sin remisión física
                </Label>
              </div>

              {sinRemision ? (
                <div className="space-y-1.5">
                  <Label htmlFor="motivo">Motivo (opcional)</Label>
                  <Textarea
                    id="motivo"
                    value={motivoSinRemision}
                    onChange={(e) => setMotivoSinRemision(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="Ej. Proveedor entregó sin documento…"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="evidencia">
                    Foto de la remisión <span className="text-destructive">*</span>
                  </Label>
                  {file ? (
                    <div className="flex items-start gap-3">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Evidencia"
                          className="h-24 w-24 object-cover rounded border"
                        />
                      ) : (
                        <div className="h-24 w-24 rounded border flex items-center justify-center text-xs text-muted-foreground bg-background">
                          PDF
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 px-2"
                          onClick={() => setFile(null)}
                        >
                          <X className="size-3.5 mr-1" /> Quitar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Input
                      id="evidencia"
                      type="file"
                      accept={ACCEPT}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setFile(f);
                      }}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Adjunta una foto (JPG/PNG) o PDF de la remisión física.
                  </p>
                </div>
              )}
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
          <Button onClick={() => guardarMut.mutate()} disabled={busy || !data}>
            {uploading ? "Subiendo…" : guardarMut.isPending ? "Guardando…" : "Registrar recepción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
