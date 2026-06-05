import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Eye, Plus, FileText, ShieldCheck, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listRequisiciones } from "@/lib/api/requisiciones.functions";
import { ESTATUS_META, type RequisicionEstatus } from "./constants";
import { NuevaRequisicionSheet } from "./NuevaRequisicionSheet";
import { RequisicionDetalleSheet } from "./RequisicionDetalleSheet";
import { CotizacionSheet, type CotizacionTab } from "./CotizacionSheet";
import { useEffectiveRoles, isDirector } from "@/stores/auth";
import { formatDate } from "@/lib/format";


interface Props { obraId: string }

export function RequisicionesModule({ obraId }: Props) {
  const roles = useEffectiveRoles();
  const puedeCrear = isDirector(roles) || roles.some((r) =>
    ["pm", "auxiliar", "administrativo", "residente"].includes(r as string)
  );
  const isSupervisor = isDirector(roles) || roles.includes("supervisor");

  const [tab, setTab] = useState<"activas" | "historial">("activas");
  const [openNueva, setOpenNueva] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [cotizacion, setCotizacion] = useState<{ id: string; tab: CotizacionTab } | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const formatDateShort = (d: string | Date | null | undefined) => {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    if (isNaN(date.getTime())) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };


  const fetchList = useServerFn(listRequisiciones);
  const activasQ = useQuery({
    queryKey: ["requisiciones", obraId, "activas"],
    queryFn: () => fetchList({ data: { obraId, soloActivas: true } }),
  });
  const historialQ = useQuery({
    queryKey: ["requisiciones", obraId, "historial"],
    queryFn: () => fetchList({ data: { obraId, soloActivas: false } }),
    enabled: tab === "historial",
  });

  const activas = useMemo(() => activasQ.data ?? [], [activasQ.data]);
  const historial = useMemo(() => historialQ.data ?? [], [historialQ.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Requisiciones</h1>
          <p className="text-sm text-muted-foreground">Material solicitado para esta obra</p>
        </div>
        {puedeCrear && (
          <Button onClick={() => setOpenNueva(true)} className="shrink-0">
            <Plus className="size-4 mr-1" /> Nueva
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="activas">Activas</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="activas" className="space-y-3 mt-4">
          {activasQ.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!activasQ.isLoading && activas.length === 0 && (
            <Card className="p-8 text-center">
              <FileText className="size-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Sin requisiciones activas</p>
            </Card>
          )}
          {activas.map((r: any) => {
            const meta = ESTATUS_META[r.estatus as RequisicionEstatus];
            const mostrarRevisar = isSupervisor && r.estatus === "pendiente_autorizacion";
            const isExpanded = expandidos.has(r.id);
            const items = r.items ?? [];
            return (
              <Card
                key={r.id}
                className="p-3 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setDetalleId(r.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <button
                      type="button"
                      className="shrink-0 p-0.5 -ml-0.5 rounded hover:bg-muted text-muted-foreground"
                      onClick={(e) => { e.stopPropagation(); toggleExpand(r.id); }}
                      aria-label={isExpanded ? "Colapsar" : "Expandir"}
                    >
                      {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                    <p className="text-sm min-w-0 truncate">
                      <span className="font-semibold text-foreground">{r.folio}</span>
                      <span className="text-muted-foreground"> · {formatDate(r.created_at)} · {items.length} insumos{r.solicitante?.nombre_completo ? ` · ${r.solicitante.nombre_completo}` : ""}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`${meta.badge} border-0 text-[10px] px-2 py-0.5`}>{meta.label}</Badge>
                    {mostrarRevisar && (
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCotizacion({ id: r.id, tab: "comparativa" });
                        }}
                      >
                        <ShieldCheck className="size-3.5 mr-1" />
                        Revisar
                      </Button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-2 pl-6 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1.5">
                      {items.slice(0, 6).map((it: any) => (
                        <span
                          key={it.id}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-muted text-foreground cursor-pointer"
                          onClick={() => setDetalleId(r.id)}
                        >
                          <strong>{Number(it.cantidad)}</strong> {it.insumo?.unidad}
                          <span className="text-muted-foreground">·</span>
                          <span className="truncate max-w-[140px]">{it.insumo?.nombre}</span>
                          {it.fecha_requerida && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground whitespace-nowrap">{formatDateShort(it.fecha_requerida)}</span>
                            </>
                          )}
                        </span>
                      ))}
                      {items.length > 6 && (
                        <span className="text-xs text-muted-foreground self-center">+{items.length - 6} más</span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-center"># insumos</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Sin requisiciones
                    </TableCell>
                  </TableRow>
                )}
                {historial.map((r: any) => {
                  const meta = ESTATUS_META[r.estatus as RequisicionEstatus];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.folio}</TableCell>
                      <TableCell>{formatDate(r.created_at)}</TableCell>
                      <TableCell className="text-center">{r.items?.length ?? 0}</TableCell>
                      <TableCell>
                        <Badge className={`${meta.badge} border-0`}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setDetalleId(r.id)}>
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {openNueva && (
        <NuevaRequisicionSheet
          obraId={obraId}
          open={openNueva}
          onOpenChange={setOpenNueva}
        />
      )}
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
