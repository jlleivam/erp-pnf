import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Download, FileText, ClipboardEdit, Send, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  getSolicitudesRequisicion,
  crearSolicitud,
  eliminarSolicitud,
  marcarSCEnviada,
  descartarSolicitud,
  getDatosPDF,
} from "@/lib/api/solicitudes-cotizacion.functions";
import { generarPDFSolicitudCotizacion, calcularTotalSC, formatMXN } from "@/lib/pdf/solicitud-cotizacion-pdf";
import { CapturarRespuestaDialog } from "./CapturarRespuestaDialog";

const SC_BADGE: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  enviada: { label: "Enviada", className: "bg-amber-100 text-amber-800" },
  recibida: { label: "Recibida", className: "bg-emerald-100 text-emerald-800" },
  descartada: { label: "Descartada", className: "bg-rose-100 text-rose-700" },
};

interface Props {
  requisicionId: string;
  reqItems: any[];
  proveedores: any[];
  solicitudes: any[];
}

export function SolicitudesTab({ requisicionId, reqItems, proveedores, solicitudes }: Props) {
  const qc = useQueryClient();
  const eliminarFn = useServerFn(eliminarSolicitud);
  const enviarFn = useServerFn(marcarSCEnviada);
  const descartarFn = useServerFn(descartarSolicitud);
  const pdfFn = useServerFn(getDatosPDF);

  const [showForm, setShowForm] = useState(false);
  const [capturando, setCapturando] = useState<any | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["solicitudes", requisicionId] });

  const handlePDF = async (solicitudId: string, marcarTambien: boolean) => {
    try {
      const data = await pdfFn({ data: { solicitudId } });
      generarPDFSolicitudCotizacion(data as any);
      if (marcarTambien) {
        await enviarFn({ data: { solicitudId } });
        toast.success("Solicitud marcada como enviada");
      }
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar PDF");
    }
  };

  const handleEliminar = async (solicitudId: string) => {
    try {
      await eliminarFn({ data: { solicitudId } });
      toast.success("Solicitud eliminada");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  const handleDescartar = async (solicitudId: string) => {
    try {
      await descartarFn({ data: { solicitudId } });
      toast.success("Solicitud descartada");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 bg-muted/40 border-dashed">
        <p className="text-sm">
          Crea una solicitud por cada proveedor al que quieras pedir precio. Descarga el PDF y envíalo por correo o WhatsApp; cuando recibas su respuesta, captura los precios para compararlos.
        </p>
      </Card>

      {solicitudes.length === 0 && !showForm && (
        <Card className="p-8 text-center border-dashed">
          <FileText className="size-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Aún no hay solicitudes de cotización</p>
        </Card>
      )}

      {solicitudes.map((sc) => {
        const meta = SC_BADGE[sc.estatus];
        const total = calcularTotalSC(sc.items ?? []);
        return (
          <Card key={sc.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{sc.folio}</p>
                  <Badge className={meta?.className}>{meta?.label}</Badge>
                  {sc.estatus === "recibida" && (
                    <span className="text-sm font-semibold tabular-nums">{formatMXN(total)}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{sc.proveedor?.razon_social ?? "—"}</p>
                {sc.enviada_at && sc.estatus !== "borrador" && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enviada · {formatDate(sc.enviada_at)}
                    {sc.recibida_at && ` · Recibida ${formatDate(sc.recibida_at)}`}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {(sc.items ?? []).length} insumo{(sc.items ?? []).length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => handlePDF(sc.id, sc.estatus === "borrador")}>
                <Download className="size-4 mr-1" />
                {sc.estatus === "borrador" ? "Descargar y marcar enviada" : "Descargar PDF"}
              </Button>
              {(sc.estatus === "enviada" || sc.estatus === "recibida") && (
                <Button size="sm" onClick={() => setCapturando(sc)}>
                  <ClipboardEdit className="size-4 mr-1" />
                  {sc.estatus === "recibida" ? "Editar respuesta" : "Capturar respuesta"}
                </Button>
              )}
              {sc.estatus === "borrador" && (
                <Button size="sm" variant="ghost" onClick={() => handleEliminar(sc.id)}>
                  <Trash2 className="size-4 mr-1" />
                  Eliminar
                </Button>
              )}
              {(sc.estatus === "enviada" || sc.estatus === "recibida") && (
                <Button size="sm" variant="ghost" onClick={() => handleDescartar(sc.id)}>
                  <XCircle className="size-4 mr-1" />
                  Descartar
                </Button>
              )}
              {sc.estatus === "descartada" && (
                <Button size="sm" variant="ghost" onClick={() => handleEliminar(sc.id)}>
                  <Trash2 className="size-4 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>
          </Card>
        );
      })}

      {showForm ? (
        <NuevaSolicitudForm
          requisicionId={requisicionId}
          reqItems={reqItems}
          proveedores={proveedores}
          onClose={() => setShowForm(false)}
        />
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="size-4 mr-1" /> Nueva solicitud de cotización
        </Button>
      )}

      {capturando && (
        <CapturarRespuestaDialog
          solicitud={capturando}
          open={!!capturando}
          onOpenChange={(o) => !o && setCapturando(null)}
          requisicionId={requisicionId}
        />
      )}
    </div>
  );
}

function NuevaSolicitudForm({
  requisicionId, reqItems, proveedores, onClose,
}: {
  requisicionId: string;
  reqItems: any[];
  proveedores: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const crearFn = useServerFn(crearSolicitud);
  const pdfFn = useServerFn(getDatosPDF);

  const [proveedorId, setProveedorId] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [seleccion, setSeleccion] = useState<Record<string, { incluido: boolean; cantidad: number }>>(
    () => Object.fromEntries(
      reqItems.map((it: any) => [it.insumo.id, { incluido: true, cantidad: Number(it.cantidad) }])
    )
  );

  const incluidos = Object.entries(seleccion).filter(([, v]) => v.incluido && v.cantidad > 0);

  const mut = useMutation({
    mutationFn: async (opts: { descargarPDF: boolean }) => {
      if (!proveedorId) throw new Error("Selecciona un proveedor");
      if (incluidos.length === 0) throw new Error("Selecciona al menos un insumo");
      const created = await crearFn({
        data: {
          requisicionId,
          proveedorId,
          notas: notas || null,
          insumos: incluidos.map(([insumo_id, v]) => ({ insumo_id, cantidad: v.cantidad })),
        },
      });
      if (opts.descargarPDF) {
        const data = await pdfFn({ data: { solicitudId: (created as any).id } });
        generarPDFSolicitudCotizacion(data as any);
      }
      return created;
    },
    onSuccess: () => {
      toast.success("Solicitud creada");
      qc.invalidateQueries({ queryKey: ["solicitudes", requisicionId] });
      qc.invalidateQueries({ queryKey: ["requisiciones"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  return (
    <Card className="p-4 space-y-3 border-primary/40">
      <h3 className="font-semibold">Nueva solicitud</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Proveedor</label>
          <Select value={proveedorId} onValueChange={setProveedorId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona proveedor" />
            </SelectTrigger>
            <SelectContent>
              {proveedores.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.razon_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Insumos a cotizar ({incluidos.length} de {reqItems.length})</label>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Insumo</TableHead>
                <TableHead className="text-right">Cantidad req.</TableHead>
                <TableHead className="w-32">Cantidad a pedir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reqItems.map((it: any) => {
                const id = it.insumo.id;
                const row = seleccion[id];
                return (
                  <TableRow key={id}>
                    <TableCell>
                      <Checkbox
                        checked={row.incluido}
                        onCheckedChange={(v) =>
                          setSeleccion((s) => ({ ...s, [id]: { ...s[id], incluido: !!v } }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-sm">{it.insumo.nombre}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {Number(it.cantidad)} {it.insumo.unidad}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!row.incluido}
                        value={row.cantidad || ""}
                        onChange={(e) =>
                          setSeleccion((s) => ({
                            ...s,
                            [id]: { ...s[id], cantidad: Number(e.target.value) || 0 },
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Notas para el proveedor (opcional)</label>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Tiempo de entrega esperado, condiciones especiales, etc."
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => mut.mutate({ descargarPDF: false })} disabled={mut.isPending}>
          Guardar solicitud
        </Button>
      </div>
    </Card>
  );
}
