import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getReembolsoCajaChica,
  revisarGastoReembolso,
  cerrarRevisionReembolso,
  rechazarReembolsoCajaChica,
  reclasificarComprobanteGasto,
} from "@/lib/api/caja-chica.functions";
import { useEffectiveIsDirector, useEffectiveRoles } from "@/stores/auth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Check, X, Send, Eye, FileText, Ban } from "lucide-react";
import { toast } from "sonner";
import { formatMXN, formatDate } from "@/lib/format";
import { montoGastoObra } from "@/lib/api/caja-chica.functions";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "caja-chica-evidencias";

const ESTATUS_VARIANT: Record<string, "default"|"secondary"|"destructive"|"outline"> = {
  borrador: "outline", solicitado: "secondary", aprobado: "default",
  rechazado: "destructive", reembolsado: "secondary",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reembolsoId: string | null;
  onChanged: () => void;
};

export function RevisarReembolsoSheet({ open, onOpenChange, reembolsoId, onChanged }: Props) {
  const director = useEffectiveIsDirector();
  const roles = useEffectiveRoles();
  const isSupervisor = roles.includes("supervisor");
  const canReview = director || isSupervisor;

  const qc = useQueryClient();
  const fetchOne = useServerFn(getReembolsoCajaChica);
  const dataQ = useQuery({
    queryKey: ["caja-chica-reembolso", reembolsoId],
    queryFn: () => fetchOne({ data: { id: reembolsoId! } }),
    enabled: open && !!reembolsoId,
  });

  const revisar = useServerFn(revisarGastoReembolso);
  const cerrar = useServerFn(cerrarRevisionReembolso);
  const rechazar = useServerFn(rechazarReembolsoCajaChica);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["caja-chica-reembolso", reembolsoId] });
    onChanged();
  }

  const revisarM = useMutation({
    mutationFn: revisar,
    onSuccess: (_data, vars: any) => {
      const decision = vars?.data?.decision;
      toast.success(decision === "aprobado" ? "Gasto aprobado" : "Gasto rechazado");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });
  const cerrarM = useMutation({
    mutationFn: cerrar,
    onSuccess: () => { toast.success("Enviado al administrativo"); invalidate(); onOpenChange(false); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });
  const rechazarM = useMutation({
    mutationFn: rechazar,
    onSuccess: () => { toast.success("Reembolso rechazado"); invalidate(); onOpenChange(false); },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  const [rechazoMotivoPorGasto, setRechazoMotivoPorGasto] = useState<Record<string, string>>({});
  const [rechazoTodo, setRechazoTodo] = useState("");

  async function verEvidencia(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error("No se pudo generar enlace");
    window.open(data.signedUrl, "_blank");
  }

  const reemb: any = (dataQ.data as any)?.reembolso;
  const gastos: any[] = (dataQ.data as any)?.gastos ?? [];

  const canClose = reemb && canReview && ["solicitado", "en_revision"].includes(reemb.estatus);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{reemb?.folio ?? "Reembolso"}</SheetTitle>
          {reemb && (
            <SheetDescription>
              Semana {formatDate(reemb.semana_inicio)} — {formatDate(reemb.semana_fin)}<br />
              Residente: {reemb.residente_nombre ?? "—"}
            </SheetDescription>
          )}
        </SheetHeader>

        {dataQ.isLoading && <p className="text-sm text-muted-foreground mt-4">Cargando…</p>}

        {reemb && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="border rounded p-2">
                <div className="text-muted-foreground text-xs">Solicitado</div>
                <div className="font-semibold">{formatMXN(Number(reemb.monto_solicitado))}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-muted-foreground text-xs">Aprobado</div>
                <div className="font-semibold">{formatMXN(Number(reemb.monto_aprobado))}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-muted-foreground text-xs">Repuesto</div>
                <div className="font-semibold">
                  {reemb.monto_reembolsado != null
                    ? formatMXN(Number(reemb.monto_reembolsado))
                    : "—"}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {gastos.map((g) => (
                <div key={g.id} className="border rounded p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{g.concepto}</span>
                        <Badge variant={ESTATUS_VARIANT[g.estatus]}>{g.estatus}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(g.fecha)} · {g.tipo_comprobante}
                      </div>
                      {g.descripcion && (
                        <div className="text-sm text-muted-foreground mt-1">{g.descripcion}</div>
                      )}
                      {g.motivo_rechazo && (
                        <div className="text-xs text-destructive mt-1">
                          {g.motivo_rechazo}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatMXN(Number(g.monto))}</div>
                      {g.tipo_comprobante === "factura" && (
                        <div className="text-[11px] text-muted-foreground">
                          Obra: {formatMXN(montoGastoObra(Number(g.monto), g.tipo_comprobante))}
                        </div>
                      )}
                    </div>
                  </div>

                  {g.evidencia_url && (
                    <Button size="sm" variant="outline" onClick={() => verEvidencia(g.evidencia_url)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Ver evidencia
                    </Button>
                  )}
                  {!g.evidencia_url && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> Sin evidencia
                    </div>
                  )}

                  {canReview && ["solicitado", "aprobado", "rechazado"].includes(g.estatus) && (() => {
                    const pendingId = (revisarM.variables as any)?.data?.gastoId;
                    const isPending = revisarM.isPending && pendingId === g.id;
                    const showAprobar = g.estatus !== "aprobado";
                    const showRechazar = g.estatus !== "rechazado";
                    return (
                      <div className="flex flex-wrap gap-2 items-end">
                        {showRechazar && (
                          <div className="flex-1 min-w-[200px]">
                            <Label className="text-xs">Motivo (si rechaza)</Label>
                            <Input
                              value={rechazoMotivoPorGasto[g.id] ?? ""}
                              onChange={(e) =>
                                setRechazoMotivoPorGasto((s) => ({ ...s, [g.id]: e.target.value }))
                              }
                              placeholder="Describe el motivo"
                              disabled={isPending}
                            />
                          </div>
                        )}
                        {showAprobar && (
                          <Button
                            size="sm" variant="default" disabled={isPending}
                            onClick={() => revisarM.mutate({
                              data: { gastoId: g.id, decision: "aprobado" },
                            })}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            {isPending ? "Guardando…" : "Aprobar"}
                          </Button>
                        )}
                        {showRechazar && (
                          <Button
                            size="sm" variant="destructive" disabled={isPending}
                            onClick={() => {
                              const motivo = rechazoMotivoPorGasto[g.id]?.trim();
                              if (!motivo) return toast.error("Motivo de rechazo requerido");
                              revisarM.mutate({
                                data: { gastoId: g.id, decision: "rechazado", motivo },
                              });
                            }}
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            {isPending ? "Guardando…" : "Rechazar"}
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            {canClose && (
              <div className="border-t pt-4 space-y-3">
                <Button className="w-full" onClick={() => cerrarM.mutate({ data: { id: reemb.id } })}>
                  <Send className="w-4 h-4 mr-1" /> Enviar al administrativo
                </Button>
                <div className="space-y-2">
                  <Label className="text-xs">Rechazar reembolso completo</Label>
                  <Textarea
                    rows={2} value={rechazoTodo}
                    onChange={(e) => setRechazoTodo(e.target.value)}
                    placeholder="Motivo de rechazo…"
                  />
                  <Button
                    variant="outline" className="w-full"
                    onClick={() => {
                      if (rechazoTodo.trim().length < 3) return toast.error("Motivo requerido");
                      rechazarM.mutate({ data: { id: reemb.id, motivo: rechazoTodo.trim() } });
                    }}
                  >
                    <Ban className="w-4 h-4 mr-1" /> Rechazar todo
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
