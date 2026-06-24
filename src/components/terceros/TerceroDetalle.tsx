import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Pencil } from "lucide-react";
import { getTercero, getEstadoCuentaProveedor, type EstadoCuentaMovimiento } from "@/lib/api/terceros.functions";
import { formatMXN } from "@/lib/format";
import { formatDate } from "@/lib/format";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DocumentoTerceroUploader } from "./DocumentoTerceroUploader";
import {
  TerceroFormDialog,
  type TerceroFormInitial,
} from "./TerceroFormDialog";
import {
  CATEGORIA_BADGE,
  CATEGORIA_LABEL,
  DOC_CON_VENCIMIENTO,
  DOC_LABEL,
  type Tercero,
  type TerceroDocTipo,
  type TerceroDocumento,
} from "./constants";

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

function findDoc(docs: TerceroDocumento[], tipo: TerceroDocTipo) {
  return docs.find((d) => d.tipo === tipo) ?? null;
}

export function TerceroDetalle({
  terceroId,
  open,
  onClose,
  canEdit,
}: {
  terceroId: string | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  const fetchOne = useServerFn(getTercero);
  const q = useQuery({
    queryKey: ["tercero", terceroId],
    queryFn: () => fetchOne({ data: { id: terceroId! } }),
    enabled: !!terceroId && open,
  });

  const [editing, setEditing] = useState(false);

  const t = q.data?.tercero as Tercero | undefined;
  const docs = (q.data?.documentos ?? []) as TerceroDocumento[];

  const esProveedor = t?.categoria === "proveedor" || t?.categoria === "ambos";
  const esContratista = t?.categoria === "contratista" || t?.categoria === "ambos";

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
                  {t?.razon_social ?? (q.isLoading ? "Cargando…" : "Proveedor / Contratista")}
                </SheetTitle>
                <SheetDescription>
                  {t && (
                    <span className="flex items-center gap-2 flex-wrap">
                      <Badge className={CATEGORIA_BADGE[t.categoria]}>
                        {CATEGORIA_LABEL[t.categoria]}
                      </Badge>
                      <Badge variant="secondary">
                        {t.tipo_persona === "moral" ? "Moral" : "Física"}
                      </Badge>
                      <span className="font-mono text-xs">{t.rfc}</span>
                    </span>
                  )}
                </SheetDescription>
              </div>
              {canEdit && t && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-4 mr-1" /> Editar
                </Button>
              )}
            </div>
          </SheetHeader>

          {q.isLoading && (
            <div className="mt-8 text-sm text-muted-foreground">Cargando ficha…</div>
          )}
          {q.error && (
            <div className="mt-8 text-sm text-rose-600">
              {(q.error as Error).message}
            </div>
          )}

          {t && (
            <Tabs defaultValue="general" className="mt-6">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="comercial">Comercial</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="contratista">Contratista</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
              </TabsList>

              {/* ============ GENERAL ============ */}
              <TabsContent value="general" className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field
                    label="Tipo de persona"
                    value={t.tipo_persona === "moral" ? "Moral" : "Física"}
                  />
                  <Field label="RFC" value={<span className="font-mono">{t.rfc}</span>} />
                  <Field
                    label={t.tipo_persona === "moral" ? "Razón social" : "Nombre completo"}
                    value={t.razon_social}
                  />
                  {t.tipo_persona === "fisica" && (
                    <Field
                      label="CURP"
                      value={
                        t.curp ? <span className="font-mono">{t.curp}</span> : null
                      }
                    />
                  )}
                  <Field label="Régimen fiscal" value={t.regimen_fiscal} />
                  <Field label="Dirección fiscal" value={t.direccion_fiscal} />
                  <Field label="Teléfono" value={t.telefono} />
                  <Field label="Correo" value={t.correo} />
                  {t.tipo_persona === "moral" && (
                    <>
                      <Field label="Contacto principal" value={t.contacto_nombre} />
                      <Field
                        label="Teléfono del contacto"
                        value={t.contacto_telefono}
                      />
                    </>
                  )}
                  <Field
                    label="Categoría"
                    value={
                      <Badge className={CATEGORIA_BADGE[t.categoria]}>
                        {CATEGORIA_LABEL[t.categoria]}
                      </Badge>
                    }
                  />
                  {esProveedor && (
                    <Field
                      label="Categoría de productos/servicios"
                      value={t.categoria_productos}
                    />
                  )}
                </div>
              </TabsContent>

              {/* ============ COMERCIAL ============ */}
              <TabsContent value="comercial" className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field
                    label="Días de crédito"
                    value={t.dias_credito != null ? `${t.dias_credito} días` : null}
                  />
                  <Field
                    label="Crédito disponible"
                    value={
                      t.credito_disponible != null
                        ? formatMXN(Number(t.credito_disponible))
                        : null
                    }
                  />
                  <Field
                    label="Requiere factura"
                    value={t.requiere_factura ? "Sí" : "No"}
                  />
                  <Field
                    label="Retención IVA"
                    value={
                      t.retencion_iva
                        ? `Sí · ${t.retencion_iva_pct ?? "—"}%`
                        : "No"
                    }
                  />
                  <Field
                    label="Retención ISR"
                    value={
                      t.retencion_isr
                        ? `Sí · ${t.retencion_isr_pct ?? "—"}%`
                        : "No"
                    }
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-3">Datos bancarios</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label="Banco" value={t.banco} />
                    <Field
                      label="CLABE"
                      value={
                        t.clabe ? <span className="font-mono">{t.clabe}</span> : null
                      }
                    />
                    <Field label="Beneficiario" value={t.beneficiario} />
                  </div>
                </div>
              </TabsContent>

              {/* ============ DOCUMENTOS ============ */}
              <TabsContent value="documentos" className="mt-6 space-y-4">
                {(["constancia_fiscal", "opinion_sat", "domicilio_fiscal"] as TerceroDocTipo[]).map(
                  (tipo) => {
                    const d = findDoc(docs, tipo);
                    return (
                      <DocumentoTerceroUploader
                        key={tipo}
                        terceroId={t.id}
                        companyId={t.company_id}
                        tipo={tipo}
                        titulo={DOC_LABEL[tipo]}
                        url={d?.url ?? null}
                        vencimiento={d?.fecha_vencimiento ?? null}
                        canEdit={canEdit}
                        conVencimiento={DOC_CON_VENCIMIENTO[tipo]}
                      />
                    );
                  },
                )}
                {esContratista && (
                  <DocumentoTerceroUploader
                    terceroId={t.id}
                    companyId={t.company_id}
                    tipo="repse"
                    titulo={DOC_LABEL.repse}
                    url={findDoc(docs, "repse")?.url ?? null}
                    vencimiento={findDoc(docs, "repse")?.fecha_vencimiento ?? null}
                    canEdit={canEdit}
                    conVencimiento
                  />
                )}
              </TabsContent>

              {/* ============ CONTRATISTA ============ */}
              <TabsContent value="contratista" className="mt-6 space-y-4">
                {!esContratista && (
                  <Alert>
                    <Info className="size-4" />
                    <AlertDescription>
                      Este proveedor / contratista no tiene la categoría Contratista activa. Edita la
                      ficha para activarla y capturar la información de contratos.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field label="Tipo de trabajos" value={t.tipo_trabajos} />
                  <Field
                    label="Fondo de garantía"
                    value={
                      t.fondo_garantia
                        ? `Sí · ${t.fondo_garantia_pct ?? "—"}%`
                        : "No"
                    }
                  />
                  <Field
                    label="Retención IVA en contrato"
                    value={
                      t.retencion_iva
                        ? `Sí · ${t.retencion_iva_pct ?? "—"}%`
                        : "No"
                    }
                  />
                  <Field
                    label="Retención ISR en contrato"
                    value={
                      t.retencion_isr
                        ? `Sí · ${t.retencion_isr_pct ?? "—"}%`
                        : "No"
                    }
                  />
                </div>
              </TabsContent>

              {/* ============ HISTORIAL ============ */}
              <TabsContent value="historial" className="mt-6 space-y-4">
                {esProveedor && tercero && (
                  <EstadoCuentaProveedor terceroId={tercero.id} />
                )}
                {esProveedor && (
                  <Card className="p-4 space-y-2">
                    <h4 className="text-sm font-medium">Historial de precios por insumo</h4>
                    <p className="text-sm text-muted-foreground">
                      Se alimenta automáticamente desde órdenes de compra.
                    </p>
                  </Card>
                )}
                {esContratista && (
                  <Card className="p-4 space-y-2">
                    <h4 className="text-sm font-medium">Contratos</h4>
                    <p className="text-sm text-muted-foreground">
                      Se alimenta automáticamente desde subcontratos.
                    </p>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {t && editing && (
        <TerceroFormDialog
          open
          onClose={() => setEditing(false)}
          initial={t as TerceroFormInitial}
          onSaved={() => setEditing(false)}
        />
      )}
    </>
  );
}
