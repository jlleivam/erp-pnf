import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Pencil } from "lucide-react";
import {
  autorizarTrabajador,
  getTrabajador,
} from "@/lib/api/trabajadores.functions";
import { formatDate, formatMXN } from "@/lib/format";
import {
  DocumentoTrabajadorUploader,
  type DocTipo,
} from "./DocumentoTrabajadorUploader";
import {
  TrabajadorFormDialog,
  type TrabajadorFormInitial,
} from "./TrabajadorFormDialog";
import { IMSS_BADGE, IMSS_LABEL, PUESTO_LABEL } from "./imss";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

const TIPO_CONTRATO_LABEL: Record<string, string> = {
  eventual_urbano: "Eventual urbano",
  eventual_campo: "Eventual campo",
  permanente: "Permanente",
};

export function TrabajadorDetalle({
  trabajadorId,
  open,
  onClose,
  canManage,
}: {
  trabajadorId: string | null;
  open: boolean;
  onClose: () => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const fetchTrabajador = useServerFn(getTrabajador);
  const q = useQuery({
    queryKey: ["trabajador", trabajadorId],
    queryFn: () => fetchTrabajador({ data: { id: trabajadorId! } }),
    enabled: !!trabajadorId && open,
  });

  const [editing, setEditing] = useState(false);

  const autorizar = useServerFn(autorizarTrabajador);
  const autorizarM = useMutation({
    mutationFn: autorizar,
    onSuccess: () => {
      toast.success("Trabajador registrado");
      qc.invalidateQueries({ queryKey: ["trabajador", trabajadorId] });
      qc.invalidateQueries({ queryKey: ["trabajadores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const t = q.data?.trabajador;
  const docs = q.data?.documentos ?? [];
  const docByTipo = new Map<DocTipo, { url: string; fecha_vencimiento: string | null }>();
  for (const d of docs) {
    docByTipo.set(d.tipo as DocTipo, {
      url: d.url,
      fecha_vencimiento: d.fecha_vencimiento,
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto"
        >
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate">
                  {t?.nombre_completo ?? (q.isLoading ? "Cargando…" : "Trabajador")}
                </SheetTitle>
                <SheetDescription>
                  {t && (
                    <span className="flex items-center gap-2 flex-wrap">
                      {t.puesto && <Badge variant="secondary">{PUESTO_LABEL[t.puesto as keyof typeof PUESTO_LABEL] ?? t.puesto}</Badge>}
                      <Badge className={IMSS_BADGE[t.imss_estatus]} variant="secondary">
                        {IMSS_LABEL[t.imss_estatus]}
                      </Badge>
                      {t.estatus_autorizacion === "pendiente" && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          Pendiente de autorización
                        </Badge>
                      )}
                    </span>
                  )}
                </SheetDescription>
              </div>
              <div className="flex gap-2">
                {canManage && t?.estatus_autorizacion === "pendiente" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => autorizarM.mutate({ data: { id: t.id } })}
                    disabled={autorizarM.isPending}
                  >
                    <CheckCircle2 className="size-4 mr-1" /> Autorizar
                  </Button>
                )}
                {canManage && t && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil className="size-4 mr-1" /> Editar
                  </Button>
                )}
              </div>
            </div>
          </SheetHeader>

          {q.isLoading && (
            <div className="mt-8 text-sm text-muted-foreground">Cargando ficha…</div>
          )}
          {q.error && (
            <div className="mt-8 text-sm text-rose-600">{(q.error as Error).message}</div>
          )}

          {t && (
            <Tabs defaultValue="general" className="mt-6">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="imss">IMSS</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="asignacion">Asignación</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-6 space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-3">Datos personales</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label="Nombre completo" value={t.nombre_completo} />
                    <Field label="Fecha de nacimiento" value={formatDate(t.fecha_nacimiento)} />
                    <Field
                      label="Sexo"
                      value={
                        t.sexo === "masculino"
                          ? "Masculino"
                          : t.sexo === "femenino"
                            ? "Femenino"
                            : null
                      }
                    />
                    <Field label="Estado civil" value={t.estado_civil} />
                    <Field
                      label="CURP"
                      value={t.curp ? <span className="font-mono">{t.curp}</span> : null}
                    />
                    <Field
                      label="RFC"
                      value={t.rfc ? <span className="font-mono">{t.rfc}</span> : null}
                    />
                    <Field label="Teléfono" value={t.telefono} />
                    <Field label="Correo" value={t.correo} />
                    <Field label="Dirección" value={t.direccion} />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-3">Datos laborales</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label="Puesto" value={t.puesto ? (PUESTO_LABEL[t.puesto as keyof typeof PUESTO_LABEL] ?? t.puesto) : null} />
                    <Field
                      label="Sueldo diario"
                      value={t.sueldo_diario != null ? formatMXN(Number(t.sueldo_diario)) : null}
                    />
                    <Field
                      label="Tipo de contrato"
                      value={t.tipo_contrato ? TIPO_CONTRATO_LABEL[t.tipo_contrato] : null}
                    />
                    <Field label="Fecha de ingreso" value={formatDate(t.fecha_ingreso)} />
                    <Field label="Fecha de baja" value={formatDate(t.fecha_baja)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="imss" className="mt-6 space-y-4">
                <Card className="p-5">
                  <div className="flex items-center gap-3">
                    <Badge className={IMSS_BADGE[t.imss_estatus]} variant="secondary">
                      {IMSS_LABEL[t.imss_estatus]}
                    </Badge>
                    <div className="text-sm text-muted-foreground">Estatus actual</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-5">
                    <Field
                      label="NSS"
                      value={
                        t.imss_nss || t.nss ? (
                          <span className="font-mono">{t.imss_nss ?? t.nss}</span>
                        ) : null
                      }
                    />
                    <Field label="Fecha de alta" value={formatDate(t.imss_fecha_alta)} />
                    <Field
                      label="Salario base de cotización"
                      value={t.imss_sbc != null ? formatMXN(Number(t.imss_sbc)) : null}
                    />
                    <Field label="Tipo de trabajador" value={t.imss_tipo_trabajador} />
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="documentos" className="mt-6 space-y-4">
                <DocumentoTrabajadorUploader
                  trabajadorId={t.id}
                  companyId={t.company_id}
                  tipo="ine"
                  titulo="INE"
                  url={docByTipo.get("ine")?.url ?? null}
                  vencimiento={docByTipo.get("ine")?.fecha_vencimiento ?? null}
                  canEdit={canManage}
                  conVencimiento
                />
                <DocumentoTrabajadorUploader
                  trabajadorId={t.id}
                  companyId={t.company_id}
                  tipo="curp"
                  titulo="CURP"
                  url={docByTipo.get("curp")?.url ?? null}
                  vencimiento={null}
                  canEdit={canManage}
                />
                <DocumentoTrabajadorUploader
                  trabajadorId={t.id}
                  companyId={t.company_id}
                  tipo="domicilio"
                  titulo="Comprobante de domicilio"
                  url={docByTipo.get("domicilio")?.url ?? null}
                  vencimiento={null}
                  canEdit={canManage}
                />
                <DocumentoTrabajadorUploader
                  trabajadorId={t.id}
                  companyId={t.company_id}
                  tipo="contrato"
                  titulo="Contrato firmado"
                  url={docByTipo.get("contrato")?.url ?? null}
                  vencimiento={null}
                  canEdit={canManage}
                />
              </TabsContent>

              <TabsContent value="asignacion" className="mt-6">
                <Card className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Disponible cuando los módulos de Nómina y Destajos estén activos.
                  </p>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {t && editing && (
        <TrabajadorFormDialog
          open
          onClose={() => setEditing(false)}
          initial={t as TrabajadorFormInitial}
          canManage={canManage}
        />
      )}
    </>
  );
}
