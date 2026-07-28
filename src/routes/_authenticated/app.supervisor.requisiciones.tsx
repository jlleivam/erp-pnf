import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText, ShieldCheck } from "lucide-react";
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
import { listRequisicionesAsignadas } from "@/lib/api/requisiciones.functions";
import { CotizacionSheet, type CotizacionTab } from "@/components/requisiciones/CotizacionSheet";
import { ESTATUS_META, type RequisicionEstatus } from "@/components/requisiciones/constants";
import { formatDate } from "@/lib/format";
import { usePermisos } from "@/hooks/usePermisos";

export const Route = createFileRoute("/_authenticated/app/supervisor/requisiciones")({
  component: SupervisorRequisicionesPage,
});

function SupervisorRequisicionesPage() {
  const { can } = usePermisos();
  const allowed = can("requisiciones.aprobar") || can("requisiciones.rechazar");

  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes");
  const [obraFilter, setObraFilter] = useState<string>("todas");
  const [cotizacion, setCotizacion] = useState<{ id: string; tab: CotizacionTab } | null>(null);

  const fetchList = useServerFn(listRequisicionesAsignadas);

  const allQ = useQuery({
    queryKey: ["requisiciones", "supervisor", "all"],
    queryFn: () => fetchList({ data: {} }),
    enabled: allowed,
  });

  const rows = (allQ.data ?? []) as any[];

  const pendientes = useMemo(
    () => rows.filter((r) => r.estatus === "pendiente_autorizacion"),
    [rows],
  );
  const historial = useMemo(
    () => rows.filter((r) => r.estatus !== "pendiente_autorizacion"),
    [rows],
  );

  const visibles = tab === "pendientes" ? pendientes : historial;

  const obras = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of visibles) {
      if (r.obra?.id) seen.set(r.obra.id, r.obra.nombre);
    }
    return Array.from(seen.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [visibles]);

  const filtered = useMemo(() => {
    if (obraFilter === "todas") return visibles;
    return visibles.filter((r) => r.obra?.id === obraFilter);
  }, [visibles, obraFilter]);

  if (!allowed) {
    return (
      <p className="text-sm text-destructive">
        No tienes permisos para ver esta vista de supervisión.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="size-6" /> Supervisión de requisiciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Revisa y autoriza las órdenes de compra de tus obras.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "pendientes" | "historial")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <TabsList className="grid grid-cols-2 w-full sm:w-auto">
            <TabsTrigger value="pendientes">
              Por autorizar{pendientes.length > 0 ? ` (${pendientes.length})` : ""}
            </TabsTrigger>
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

        <TabsContent value="pendientes" className="mt-4">
          <RequisicionesTable
            rows={filtered}
            loading={allQ.isLoading}
            emptyText="No hay requisiciones esperando autorización."
            onRevisar={(id) => setCotizacion({ id, tab: "comparativa" })}
            primaryLabel="Revisar y autorizar"
          />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <RequisicionesTable
            rows={filtered}
            loading={allQ.isLoading}
            emptyText="Sin historial de requisiciones supervisadas."
            onRevisar={(id) => setCotizacion({ id, tab: "comparativa" })}
            primaryLabel="Ver"
          />
        </TabsContent>
      </Tabs>

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

function RequisicionesTable({
  rows, loading, emptyText, onRevisar, primaryLabel,
}: {
  rows: any[];
  loading: boolean;
  emptyText: string;
  onRevisar: (id: string) => void;
  primaryLabel: string;
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
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead className="hidden sm:table-cell">Solicitante</TableHead>
              <TableHead className="hidden md:table-cell text-right">Insumos</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const meta = ESTATUS_META[r.estatus as RequisicionEstatus];
              return (
                <TableRow key={r.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{r.folio}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{r.obra?.nombre ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {r.solicitante ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right">{r.insumos_count}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {r.created_at ? formatDate(r.created_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={meta?.badge ?? ""} variant="secondary">
                      {meta?.label ?? r.estatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => onRevisar(r.id)}>
                      {primaryLabel}
                    </Button>
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
