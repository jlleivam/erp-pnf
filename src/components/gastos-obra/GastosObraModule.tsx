import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Check, X, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatMXN, formatDate } from "@/lib/format";
import { usePermisos } from "@/hooks/usePermisos";
import {
  listGastosObra, autorizarGastoObra, rechazarGastoObra, cancelarGastoObra,
} from "@/lib/api/gastos-obra.functions";
import { GastoObraFormSheet } from "./GastoObraFormSheet";

const BUCKET = "gastos-obra-comprobantes";

type Estatus = "borrador" | "solicitado" | "autorizado" | "rechazado" | "cancelado" | "pagado";

const ESTATUS_LABEL: Record<Estatus, string> = {
  borrador: "Borrador",
  solicitado: "Por autorizar",
  autorizado: "Autorizado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  pagado: "Pagado",
};
const ESTATUS_VARIANT: Record<Estatus, "default" | "secondary" | "destructive" | "outline"> = {
  borrador: "secondary",
  solicitado: "outline",
  autorizado: "default",
  rechazado: "destructive",
  cancelado: "secondary",
  pagado: "default",
};

export function GastosObraModule({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const { can } = usePermisos();
  const puedeCrear = can("gastos_obra.crear");
  const puedeAutorizar = can("gastos_obra.autorizar");

  const fetchList = useServerFn(listGastosObra);
  const autorizarFn = useServerFn(autorizarGastoObra);
  const rechazarFn = useServerFn(rechazarGastoObra);
  const cancelarFn = useServerFn(cancelarGastoObra);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [rechazoId, setRechazoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [cancelarId, setCancelarId] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["gastos-obra", obraId],
    queryFn: () => fetchList({ data: { obraId } }),
  });
  const gastos = (listQ.data ?? []) as any[];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["gastos-obra"] });
    qc.invalidateQueries({ queryKey: ["cxp"] });
    qc.invalidateQueries({ queryKey: ["almacen"] });
  };

  const autorizarM = useMutation({
    mutationFn: (id: string) => autorizarFn({ data: { id } }),
    onSuccess: () => { toast.success("Gasto autorizado y enviado a cuentas por pagar"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo autorizar"),
  });
  const rechazarM = useMutation({
    mutationFn: () => rechazarFn({ data: { id: rechazoId!, motivo: motivo.trim() } }),
    onSuccess: () => {
      toast.success("Gasto rechazado");
      setRechazoId(null); setMotivo(""); refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo rechazar"),
  });
  const cancelarM = useMutation({
    mutationFn: () => cancelarFn({ data: { id: cancelarId! } }),
    onSuccess: () => { toast.success("Gasto cancelado"); setCancelarId(null); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo cancelar"),
  });

  async function verComprobante(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error("No se pudo generar el enlace");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Gastos de obra</h2>
          <p className="text-sm text-muted-foreground">
            Pagos directos a proveedores que no pasaron por requisición. El supervisor autoriza y
            el administrativo paga.
          </p>
        </div>
        {puedeCrear && (
          <Button onClick={() => { setEditId(null); setSheetOpen(true); }}>
            <Plus className="size-4" /> Nuevo gasto
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Folio</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Proveedor</th>
                <th className="px-3 py-2 text-left">Concepto</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Comprobante</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-left">Estatus</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    {listQ.isLoading ? "Cargando..." : "Sin gastos registrados"}
                  </td>
                </tr>
              )}
              {gastos.map((g) => (
                <tr key={g.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{g.folio}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(g.fecha)}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate" title={g.proveedor?.razon_social ?? ""}>
                    {g.proveedor?.razon_social ?? "—"}
                  </td>
                  <td className="px-3 py-2 max-w-[220px] truncate" title={g.concepto}>
                    {g.concepto}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {g.tipo === "material" ? "Material" : "Servicio"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {g.comprobante_path ? (
                      <Button
                        variant="ghost" size="sm" className="h-7 px-2"
                        onClick={() => verComprobante(g.comprobante_path)}
                      >
                        <Eye className="size-3.5" />
                        {g.tipo_comprobante === "factura" ? "Factura" : "Nota"}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">Sin comprobante</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatMXN(Number(g.monto_total))}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Badge variant={ESTATUS_VARIANT[g.estatus as Estatus]}>
                      {ESTATUS_LABEL[g.estatus as Estatus]}
                    </Badge>
                    {g.estatus === "rechazado" && g.motivo_rechazo && (
                      <p className="text-xs text-muted-foreground max-w-[180px] truncate" title={g.motivo_rechazo}>
                        {g.motivo_rechazo}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      {puedeCrear && ["borrador", "rechazado"].includes(g.estatus) && (
                        <Button
                          size="sm" variant="outline" className="h-7 px-2"
                          onClick={() => { setEditId(g.id); setSheetOpen(true); }}
                        >
                          <Pencil className="size-3.5" /> Editar
                        </Button>
                      )}
                      {puedeAutorizar && g.estatus === "solicitado" && (
                        <>
                          <Button
                            size="sm" className="h-7 px-2"
                            disabled={autorizarM.isPending}
                            onClick={() => autorizarM.mutate(g.id)}
                          >
                            <Check className="size-3.5" /> Autorizar
                          </Button>
                          <Button
                            size="sm" variant="outline" className="h-7 px-2"
                            onClick={() => { setRechazoId(g.id); setMotivo(""); }}
                          >
                            <X className="size-3.5" /> Rechazar
                          </Button>
                        </>
                      )}
                      {puedeCrear && ["borrador", "solicitado", "rechazado"].includes(g.estatus) && (
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2"
                          onClick={() => setCancelarId(g.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <GastoObraFormSheet
        obraId={obraId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        gastoId={editId}
      />

      <AlertDialog open={!!rechazoId} onOpenChange={(o) => !o && setRechazoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar gasto</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo del rechazo para que el residente pueda corregirlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo del rechazo"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <AlertDialogAction
              disabled={motivo.trim().length < 3 || rechazarM.isPending}
              onClick={(e) => { e.preventDefault(); rechazarM.mutate(); }}
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelarId} onOpenChange={(o) => !o && setCancelarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              El gasto quedará cancelado y no se enviará a cuentas por pagar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); cancelarM.mutate(); }}
            >
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
