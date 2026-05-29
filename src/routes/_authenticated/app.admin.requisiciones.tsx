import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listRequisicionesAsignadas } from "@/lib/api/requisiciones.functions";
import { RequisicionDetalleSheet } from "@/components/requisiciones/RequisicionDetalleSheet";
import { ESTATUS_META, type RequisicionEstatus } from "@/components/requisiciones/constants";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/admin/requisiciones")({
  component: AdminRequisicionesPage,
});

function AdminRequisicionesPage() {
  const [tab, setTab] = useState<"activas" | "historial">("activas");
  const [obraFilter, setObraFilter] = useState<string>("todas");
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const fetchList = useServerFn(listRequisicionesAsignadas);
  const activasQ = useQuery({
    queryKey: ["requisiciones", "asignadas", "activas"],
    queryFn: () => fetchList({ data: { soloActivas: true } }),
  });
  const historialQ = useQuery({
    queryKey: ["requisiciones", "asignadas", "historial"],
    queryFn: () => fetchList({ data: { soloActivas: false } }),
    enabled: tab === "historial",
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
          />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <RequisicionesTable
            rows={filtered}
            loading={loading}
            emptyText="Sin historial de requisiciones."
            onRowClick={setDetalleId}
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
    </div>
  );
}

function RequisicionesTable({
  rows, loading, emptyText, onRowClick,
}: {
  rows: any[];
  loading: boolean;
  emptyText: string;
  onRowClick: (id: string) => void;
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
              <TableHead>Estatus</TableHead>
              <TableHead className="hidden sm:table-cell">Enviada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const meta = ESTATUS_META[r.estatus as RequisicionEstatus];
              return (
                <TableRow
                  key={r.id}
                  onClick={() => onRowClick(r.id)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">{r.folio}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{r.obra?.nombre ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {r.solicitante ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right">{r.insumos_count}</TableCell>
                  <TableCell>
                    <Badge className={meta?.badge ?? ""} variant="secondary">
                      {meta?.label ?? r.estatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                    {r.enviada_at ? formatDate(r.enviada_at) : "—"}
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
