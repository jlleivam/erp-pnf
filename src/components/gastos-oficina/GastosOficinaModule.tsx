import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Receipt, Users, History, Check, X, Ban, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TruncatedCell } from "@/components/pagos/TruncatedCell";
import { formatMXN, formatDate } from "@/lib/format";
import { useEffectiveRoles } from "@/stores/auth";
import {
  listGastosOficina,
  aprobarGastoOficina,
  rechazarGastoOficina,
  cancelarGastoOficina,
  listPersonalOficina,
  type GastoOficinaRow,
  type GastoOficinaEstatus,
} from "@/lib/api/gastos-oficina.functions";
import { NuevoGastoOficinaDialog } from "./NuevoGastoOficinaDialog";
import { GestionarPersonalOficinaDialog } from "./GestionarPersonalOficinaDialog";
import { GenerarNominaOficinaDialog } from "./GenerarNominaOficinaDialog";
import { RechazarGastoDialog } from "./RechazarGastoDialog";

const TIPO_LABEL: Record<string, string> = {
  nomina_oficina: "Nómina oficina",
  servicio: "Servicio",
  papeleria: "Papelería",
  otro: "Otro",
};

const ESTATUS_BADGE: Record<GastoOficinaEstatus, string> = {
  pendiente_aprobacion: "bg-amber-100 text-amber-800",
  aprobada: "bg-sky-100 text-sky-800",
  rechazada: "bg-rose-100 text-rose-800",
  pagada: "bg-emerald-100 text-emerald-800",
  cancelada: "bg-slate-200 text-slate-700",
};

const ESTATUS_LABEL: Record<GastoOficinaEstatus, string> = {
  pendiente_aprobacion: "Pendiente",
  aprobada: "Aprobada · por pagar",
  rechazada: "Rechazada",
  pagada: "Pagada",
  cancelada: "Cancelada",
};

export function GastosOficinaModule() {
  const roles = useEffectiveRoles();
  const canApprove = roles.includes("director") || roles.includes("administrativo");
  const qc = useQueryClient();
  const [tab, setTab] = useState("solicitudes");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [nominaOpen, setNominaOpen] = useState(false);
  const [rechazarTarget, setRechazarTarget] = useState<GastoOficinaRow | null>(null);

  const fetchSolicitudes = useServerFn(listGastosOficina);
  const fetchHistorico = useServerFn(listGastosOficina);
  const fetchPersonal = useServerFn(listPersonalOficina);
  const aprobar = useServerFn(aprobarGastoOficina);
  const cancelar = useServerFn(cancelarGastoOficina);

  const solicitudesQ = useQuery({
    queryKey: ["gastos-oficina", "activas"],
    queryFn: () => fetchSolicitudes({ data: { estatus: ["pendiente_aprobacion", "aprobada"] } }),
  });

  const historicoQ = useQuery({
    queryKey: ["gastos-oficina", "historico"],
    queryFn: () => fetchHistorico({ data: { estatus: ["pagada", "rechazada", "cancelada"] } }),
    enabled: tab === "historico",
  });

  const personalQ = useQuery({
    queryKey: ["gastos-oficina", "personal"],
    queryFn: () => fetchPersonal(),
    enabled: tab === "personal",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["gastos-oficina"] });
    qc.invalidateQueries({ queryKey: ["saldos-proveedores"] });
  };

  const handleAprobar = async (id: string) => {
    try {
      await aprobar({ data: { id } });
      toast.success("Gasto aprobado y cuenta por pagar creada");
      invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Error al aprobar");
    }
  };

  const handleCancelar = async (id: string) => {
    if (!confirm("¿Cancelar esta solicitud?")) return;
    try {
      await cancelar({ data: { id } });
      toast.success("Solicitud cancelada");
      invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Error al cancelar");
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gastos de oficina</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Nómina fija de personal administrativo y gastos operativos (servicios, papelería, etc.)
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setNuevoOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nuevo gasto
            </Button>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="solicitudes">
              <Receipt className="h-4 w-4 mr-1" /> Solicitudes
            </TabsTrigger>
            <TabsTrigger value="personal">
              <Users className="h-4 w-4 mr-1" /> Personal de oficina
            </TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-4 w-4 mr-1" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* SOLICITUDES */}
          <TabsContent value="solicitudes" className="space-y-3">
            <Card className="overflow-hidden">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Folio</TableHead>
                    <TableHead className="w-28">Fecha</TableHead>
                    <TableHead className="w-32">Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="w-48">Beneficiario</TableHead>
                    <TableHead className="w-32 text-right">Monto</TableHead>
                    <TableHead className="w-40">Estatus</TableHead>
                    <TableHead className="w-44 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitudesQ.isLoading && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                  )}
                  {!solicitudesQ.isLoading && (solicitudesQ.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sin solicitudes activas</TableCell></TableRow>
                  )}
                  {(solicitudesQ.data ?? []).map((r) => {
                    const beneficiario = r.beneficiario_nombre ?? r.proveedor_nombre ?? "—";
                    const esPropia = false; // sin chequeo; cancelación abierta a admin
                    return (
                      <TableRow key={r.id}>
                        <TableCell><TruncatedCell>{r.folio}</TruncatedCell></TableCell>
                        <TableCell><TruncatedCell>{formatDate(r.fecha_gasto)}</TruncatedCell></TableCell>
                        <TableCell><TruncatedCell>{TIPO_LABEL[r.tipo]}</TruncatedCell></TableCell>
                        <TableCell><TruncatedCell title={r.notas ? `${r.concepto} — ${r.notas}` : r.concepto}>{r.concepto}</TruncatedCell></TableCell>
                        <TableCell><TruncatedCell>{beneficiario}</TruncatedCell></TableCell>
                        <TableCell className="text-right tabular-nums"><TruncatedCell className="text-right">{formatMXN(r.monto)}</TruncatedCell></TableCell>
                        <TableCell>
                          <Badge className={ESTATUS_BADGE[r.estatus]} variant="secondary">
                            {ESTATUS_LABEL[r.estatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {r.estatus === "pendiente_aprobacion" && canApprove && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleAprobar(r.id)} title="Aprobar">
                                  <Check className="h-4 w-4 text-emerald-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setRechazarTarget(r)} title="Rechazar">
                                  <X className="h-4 w-4 text-rose-600" />
                                </Button>
                              </>
                            )}
                            {r.estatus === "pendiente_aprobacion" && (
                              <Button size="sm" variant="ghost" onClick={() => handleCancelar(r.id)} title="Cancelar">
                                <Ban className="h-4 w-4 text-slate-500" />
                              </Button>
                            )}
                            {r.estatus === "aprobada" && (
                              <span className="text-xs text-muted-foreground">→ Cuentas por pagar</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
            <p className="text-xs text-muted-foreground">
              Al aprobar, el gasto pasa a <strong>Cuentas por pagar</strong> y desde ahí se registra el pago.
            </p>
          </TabsContent>

          {/* PERSONAL */}
          <TabsContent value="personal" className="space-y-3">
            <div className="flex flex-wrap justify-end gap-2">
              {canApprove && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setPersonalOpen(true)}>
                    <Users className="h-4 w-4 mr-1" /> Gestionar personal
                  </Button>
                  <Button size="sm" onClick={() => setNominaOpen(true)}>
                    <CalendarPlus className="h-4 w-4 mr-1" /> Generar nómina del periodo
                  </Button>
                </>
              )}
            </div>
            <Card className="overflow-hidden">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-44">Puesto</TableHead>
                    <TableHead className="w-40 text-right">Sueldo semanal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personalQ.isLoading && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                  )}
                  {!personalQ.isLoading && (personalQ.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">
                      Aún no hay personal de oficina. Usa "Gestionar personal" para marcarlos.
                    </TableCell></TableRow>
                  )}
                  {(personalQ.data ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell><TruncatedCell>{p.nombre_completo}</TruncatedCell></TableCell>
                      <TableCell><TruncatedCell>{p.puesto ?? "—"}</TruncatedCell></TableCell>
                      <TableCell className="text-right tabular-nums">
                        <TruncatedCell className="text-right">
                          {p.sueldo_periodo != null ? formatMXN(p.sueldo_periodo) : "—"}
                        </TruncatedCell>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* HISTÓRICO */}
          <TabsContent value="historico" className="space-y-3">
            <Card className="overflow-hidden">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Folio</TableHead>
                    <TableHead className="w-28">Fecha</TableHead>
                    <TableHead className="w-32">Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="w-48">Beneficiario</TableHead>
                    <TableHead className="w-32 text-right">Monto</TableHead>
                    <TableHead className="w-32">Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoQ.isLoading && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                  )}
                  {!historicoQ.isLoading && (historicoQ.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin movimientos</TableCell></TableRow>
                  )}
                  {(historicoQ.data ?? []).map((r) => {
                    const beneficiario = r.beneficiario_nombre ?? r.proveedor_nombre ?? "—";
                    return (
                      <TableRow key={r.id}>
                        <TableCell><TruncatedCell>{r.folio}</TruncatedCell></TableCell>
                        <TableCell><TruncatedCell>{formatDate(r.fecha_gasto)}</TruncatedCell></TableCell>
                        <TableCell><TruncatedCell>{TIPO_LABEL[r.tipo]}</TruncatedCell></TableCell>
                        <TableCell>
                          <TruncatedCell title={r.motivo_rechazo ? `${r.concepto} — Rechazo: ${r.motivo_rechazo}` : r.concepto}>
                            {r.concepto}
                          </TruncatedCell>
                        </TableCell>
                        <TableCell><TruncatedCell>{beneficiario}</TruncatedCell></TableCell>
                        <TableCell className="text-right tabular-nums">
                          <TruncatedCell className="text-right">{formatMXN(r.monto)}</TruncatedCell>
                        </TableCell>
                        <TableCell>
                          <Badge className={ESTATUS_BADGE[r.estatus]} variant="secondary">
                            {ESTATUS_LABEL[r.estatus]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        <NuevoGastoOficinaDialog open={nuevoOpen} onOpenChange={setNuevoOpen} onCreated={invalidate} />
        <GestionarPersonalOficinaDialog open={personalOpen} onOpenChange={setPersonalOpen} onChanged={invalidate} />
        <GenerarNominaOficinaDialog open={nominaOpen} onOpenChange={setNominaOpen} onGenerated={invalidate} />
        <RechazarGastoDialog
          gasto={rechazarTarget}
          onOpenChange={(o: boolean) => { if (!o) setRechazarTarget(null); }}
          onDone={invalidate}
        />
      </div>
    </TooltipProvider>
  );
}
