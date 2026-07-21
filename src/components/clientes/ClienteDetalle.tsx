import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil } from "lucide-react";
import { getCliente } from "@/lib/api/clientes.functions";
import { formatMXN, formatDate } from "@/lib/format";
import { DocumentoUploader } from "./DocumentoUploader";
import { ClienteFormDialog, type ClienteFormInitial } from "./ClienteFormDialog";

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
      <div className="mt-1 text-sm">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

export function ClienteDetalle({
  clienteId,
  open,
  onClose,
  canEdit,
}: {
  clienteId: string | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  const fetchCliente = useServerFn(getCliente);
  const q = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: () => fetchCliente({ data: { id: clienteId! } }),
    enabled: !!clienteId && open,
  });

  const [editing, setEditing] = useState(false);

  const cliente = q.data?.cliente;
  const obras = q.data?.obras ?? [];
  const total = q.data?.monto_total_contratado ?? 0;

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
                  {cliente?.razon_social ?? (q.isLoading ? "Cargando…" : "Cliente")}
                </SheetTitle>
                <SheetDescription>
                  {cliente && (
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {cliente.tipo_persona === "moral" ? "Persona moral" : "Persona física"}
                      </Badge>
                      <span className="font-mono text-xs">{cliente.rfc}</span>
                    </span>
                  )}
                </SheetDescription>
              </div>
              {canEdit && cliente && (
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

          {cliente && (
            <Tabs defaultValue="generales" className="mt-6">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="generales">Generales</TabsTrigger>
                <TabsTrigger value="comercial">Comercial</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="obras">Obras</TabsTrigger>
              </TabsList>

              {/* ============ DATOS GENERALES ============ */}
              <TabsContent value="generales" className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field
                    label="Tipo de persona"
                    value={cliente.tipo_persona === "moral" ? "Moral" : "Física"}
                  />
                  <Field label="RFC" value={<span className="font-mono">{cliente.rfc}</span>} />
                  <Field
                    label={cliente.tipo_persona === "moral" ? "Razón social" : "Nombre completo"}
                    value={cliente.razon_social}
                  />
                  {cliente.tipo_persona === "fisica" && (
                    <Field
                      label="CURP"
                      value={cliente.curp ? <span className="font-mono">{cliente.curp}</span> : null}
                    />
                  )}
                  <Field label="Régimen fiscal" value={cliente.regimen_fiscal} />
                  <Field
                    label="Dirección fiscal"
                    value={
                      [
                        [cliente.calle, cliente.numero_exterior && `#${cliente.numero_exterior}`, cliente.numero_interior && `Int. ${cliente.numero_interior}`]
                          .filter(Boolean)
                          .join(" "),
                        cliente.colonia,
                        cliente.municipio,
                        cliente.estado,
                        cliente.codigo_postal && `C.P. ${cliente.codigo_postal}`,
                      ]
                        .filter((s) => s && String(s).trim().length > 0)
                        .join(", ") || null
                    }
                  />

                  <Field label="Teléfono" value={cliente.telefono} />
                  <Field label="Correo" value={cliente.correo} />
                  {cliente.tipo_persona === "moral" && (
                    <>
                      <Field label="Contacto principal" value={cliente.contacto_nombre} />
                      <Field label="Teléfono del contacto" value={cliente.contacto_telefono} />
                    </>
                  )}
                </div>
              </TabsContent>

              {/* ============ COMERCIAL ============ */}
              <TabsContent value="comercial" className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <Field
                    label="Condiciones de pago"
                    value={
                      cliente.condiciones_pago != null
                        ? `${cliente.condiciones_pago} días`
                        : null
                    }
                  />
                  <Field
                    label="Límite de crédito"
                    value={
                      cliente.limite_credito != null
                        ? formatMXN(Number(cliente.limite_credito))
                        : null
                    }
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-3">Datos bancarios</h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <Field label="Banco" value={cliente.banco} />
                    <Field
                      label="CLABE"
                      value={cliente.clabe ? <span className="font-mono">{cliente.clabe}</span> : null}
                    />
                    <Field label="Beneficiario" value={cliente.beneficiario} />
                  </div>
                </div>
              </TabsContent>

              {/* ============ DOCUMENTOS ============ */}
              <TabsContent value="documentos" className="mt-6 space-y-4">
                <DocumentoUploader
                  clienteId={cliente.id}
                  companyId={cliente.company_id}
                  tipo="constancia"
                  titulo="Constancia de Situación Fiscal"
                  url={cliente.constancia_fiscal_url}
                  vencimiento={cliente.constancia_fiscal_vencimiento}
                  canEdit={canEdit}
                />
                <DocumentoUploader
                  clienteId={cliente.id}
                  companyId={cliente.company_id}
                  tipo="opinion"
                  titulo="Opinión de cumplimiento SAT"
                  url={cliente.opinion_sat_url}
                  vencimiento={cliente.opinion_sat_vencimiento}
                  canEdit={canEdit}
                />
              </TabsContent>

              {/* ============ OBRAS ============ */}
              <TabsContent value="obras" className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Monto total contratado
                    </div>
                    <div className="text-2xl font-semibold mt-1">{formatMXN(total)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {obras.length} obra{obras.length === 1 ? "" : "s"}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Saldo pendiente
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-2xl font-semibold mt-1 text-muted-foreground cursor-help">
                            —
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Disponible cuando el módulo de cobranza esté activo
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Card>
                </div>

                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Obra</TableHead>
                        <TableHead>Contrato</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {obras.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            Sin obras vinculadas.
                          </TableCell>
                        </TableRow>
                      ) : (
                        obras.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">
                              <Link
                                to="/app/obras/$obraId"
                                params={{ obraId: o.id }}
                                className="hover:underline"
                              >
                                {o.nombre}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {o.numero_contrato ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(o.fecha_inicio)}
                            </TableCell>
                            <TableCell className="text-right">
                              {o.monto_contratado != null
                                ? formatMXN(Number(o.monto_contratado))
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {cliente && editing && (
        <ClienteFormDialog
          open
          onClose={() => setEditing(false)}
          initial={cliente as ClienteFormInitial}
          onSaved={() => setEditing(false)}
        />
      )}
    </>
  );
}
