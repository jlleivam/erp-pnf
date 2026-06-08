import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listRequisicionesAsignadas, getRequisicion } from "@/lib/api/requisiciones.functions";
import { RequisicionDetalleSheet } from "@/components/requisiciones/RequisicionDetalleSheet";
import { CotizacionSheet, type CotizacionTab } from "@/components/requisiciones/CotizacionSheet";
import { ESTATUS_META, type RequisicionEstatus } from "@/components/requisiciones/constants";
import { formatDate } from "@/lib/format";
import { useEffectiveRoles, useEffectiveIsDirector } from "@/stores/auth";

export const Route = createFileRoute("/_authenticated/app/admin/requisiciones")({
  component: AdminRequisicionesPage,
});

function AdminRequisicionesPage() {
  const roles = useEffectiveRoles();
  const director = useEffectiveIsDirector();
  const allowed = director || roles.includes("administrativo");

  const [tab, setTab] = useState<"activas" | "historial">("activas");
  const [obraFilter, setObraFilter] = useState<string>("todas");
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [cotizacion, setCotizacion] = useState<{ id: string; tab: CotizacionTab } | null>(null);

  const fetchList = useServerFn(listRequisicionesAsignadas);
  const fetchOne = useServerFn(getRequisicion);
  const activasQ = useQuery({
    queryKey: ["requisiciones", "asignadas", "activas"],
    queryFn: () => fetchList({ data: { soloActivas: true } }),
    enabled: allowed,
  });
  const historialQ = useQuery({
    queryKey: ["requisiciones", "asignadas", "historial"],
    queryFn: () => fetchList({ data: { soloActivas: false } }),
    enabled: allowed && tab === "historial",
  });

  const rows = tab === "activas" ? activasQ.data ?? [] : historialQ.data ?? [];
  const loading = tab === "activas" ? activasQ.isLoading : historialQ.isLoading;

  const obras = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows as any[]) {
      if (r.obra?.id) seen.set(r.obra.id, r.obra.nombre);
    }
    return Array.from(seen.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [rows]);

  const filtered = useMemo(() => {
    if (obraFilter === "todas") return rows;
    return (rows as any[]).filter((r) => r.obra?.id === obraFilter);
  }, [rows, obraFilter]);

  if (!allowed) {
    return (
      <p className="text-sm text-destructive">
        No tienes permisos para ver requisiciones administrativas con la vista actual.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Requisiciones</h1>
        <p className="text-sm text-muted-foreground">De tus obras asignadas</p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "activas" | "historial")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <TabsList className="grid grid-cols-2 w-full sm:w-auto">
            <TabsTrigger value="activas">Activas</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          {obras.length > 1 && (
            <Select value={obraFilter} onValueChange={setObraFilter}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Filtrar por obra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las obras</SelectItem>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="activas" className="mt-4">
          <RequisicionesTable
            rows={filtered}
            loading={loading}
            emptyText="Sin requisiciones activas en tus obras."
            onRowClick={setDetalleId}
            onAction={(r, t) => setCotizacion({ id: r.id, tab: t })}
            fetchDetalle={fetchOne}
          />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <RequisicionesTable
            rows={filtered}
            loading={loading}
            emptyText="Sin historial de requisiciones."
            onRowClick={setDetalleId}
            onAction={(r, t) => setCotizacion({ id: r.id, tab: t })}
            fetchDetalle={fetchOne}
          />
        </TabsContent>
      </Tabs>

      {detalleId && (
        <RequisicionDetalleSheet
          id={detalleId}
          open={!!detalleId}
          onOpenChange={(o) => !o && setDetalleId(null)}
        />
      )}
      {cotizacion && (
        <CotizacionSheet
          requisicionId={cotizacion.id}
          initialTab={cotizacion.tab}
          open={!!cotizacion}
          onOpenChange={(o) => !o && setCotizacion(null)}
        />
      )}
    </div>
  );
}

function FechaProximaCell({ rowId, fetchDetalle }: { rowId: string; fetchDetalle: any }) {
  const q = useQuery({
    queryKey: ["requisicion-fechas", rowId],
    queryFn: () => fetchDetalle({ data: { id: rowId } }),
    staleTime: 60_000,
  });
  const items = (q.data as any)?.items ?? [];
  const fechas = items
    .map((it: any) => it.fecha_requerida)
    .filter(Boolean)
    .map((d: string) => new Date(d).getTime());
  if (fechas.length === 0) return <span className="text-muted-foreground text-sm">—</span>;
  const min = Math.min(...fechas);
  const diff = Math.ceil((min - Date.now()) / (1000 * 60 * 60 * 24));
  const urgent = diff <= 3;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm whitespace-nowrap">{formatDate(new Date(min).toISOString())}</span>
      {urgent && <Badge className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0 h-4">Urgente</Badge>}
    </div>
  );
}

function AccionCell({ row, onAction }: {
  row: any;
  onAction: (r: any, t: CotizacionTab) => void;
}) {
  const estatus = row.estatus as RequisicionEstatus;
  if (estatus === "enviada") {
    return <Button size="sm" className="h-6 px-2 text-xs" onClick={() => onAction(row, "requisicion")}>Cotizar</Button>;
  }
  if (estatus === "en_cotizacion") {
    return <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => onAction(row, "requisicion")}>Continuar</Button>;
  }
  if (["pendiente_autorizacion", "oc_generada", "completada"].includes(estatus)) {
    return <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => onAction(row, "ocs")}>Ver OCs</Button>;
  }
  return null;
}

function RequisicionesTable({
  rows, loading, emptyText, onRowClick, onAction, fetchDetalle,
}: {
  rows: any[];
  loading: boolean;
  emptyText: string;
  onRowClick: (id: string) => void;
  onAction: (r: any, t: CotizacionTab) => void;
  fetchDetalle: any;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center border-dashed">
        <FileText className="size-8 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-8">
              <TableHead className="py-1 text-xs">Folio</TableHead>
              <TableHead className="py-1 text-xs">Obra</TableHead>
              <TableHead className="hidden sm:table-cell py-1 text-xs">Solicitante</TableHead>
              <TableHead className="hidden md:table-cell text-right py-1 text-xs">Insumos</TableHead>
              <TableHead className="py-1 text-xs">Fecha más próxima</TableHead>
              <TableHead className="py-1 text-xs">Estatus</TableHead>
              <TableHead className="text-right py-1 text-xs">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const meta = ESTATUS_META[r.estatus as RequisicionEstatus];
              return (
                <TableRow key={r.id} className="hover:bg-muted/50 h-9">
                  <TableCell className="py-1 font-medium text-sm cursor-pointer whitespace-nowrap" onClick={() => onRowClick(r.id)}>
                    {r.folio}
                  </TableCell>
                  <TableCell className="py-1 max-w-[160px] truncate text-sm">{r.obra?.nombre ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell py-1 text-sm text-muted-foreground whitespace-nowrap">
                    {r.solicitante ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right py-1 text-sm">{r.insumos_count}</TableCell>
                  <TableCell className="py-1">
                    <FechaProximaCell rowId={r.id} fetchDetalle={fetchDetalle} />
                  </TableCell>
                  <TableCell className="py-1">
                    <Badge className={`${meta?.badge ?? ""} text-[10px] px-2 py-0 h-5`} variant="secondary">
                      {meta?.label ?? r.estatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-1">
                    <AccionCell row={r} onAction={onAction} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
