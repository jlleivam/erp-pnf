import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Eye, Plus, FileText, ShieldCheck, ChevronRight, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  listRequisiciones,
  eliminarBorradorRequisicion,
} from "@/lib/api/requisiciones.functions";
import { ESTATUS_META, type RequisicionEstatus } from "./constants";
import { NuevaRequisicionSheet } from "./NuevaRequisicionSheet";
import { CotizacionSheet, type CotizacionTab } from "./CotizacionSheet";
import { useEffectiveRoles } from "@/stores/auth";
import { usePermisos } from "@/hooks/usePermisos";
import { formatDate } from "@/lib/format";


interface Props { obraId: string }

export function RequisicionesModule({ obraId }: Props) {
  const roles = useEffectiveRoles();
  void roles;
  const { can } = usePermisos();
  const puedeCrear = can("requisiciones.crear");
  const puedeRevisar = can("requisiciones.aprobar") || can("requisiciones.rechazar");
  const puedeCotizar = can("cotizaciones.gestionar");
  const puedeCrearOC = can("oc.crear");
  const puedeGestionar = puedeCotizar || puedeCrearOC;
  const puedeVerOC = can("requisiciones.ver_oc") || can("oc.autorizar") || can("oc.cancelar");
  const usarVistaTabla = puedeGestionar || puedeVerOC;

  const [tab, setTab] = useState<"activas" | "historial">("activas");
  const [openNueva, setOpenNueva] = useState(false);
  const [borradorEnEdicion, setBorradorEnEdicion] = useState<string | null>(null);
  const [cotizacion, setCotizacion] = useState<{ id: string; tab: CotizacionTab; readOnly?: boolean } | null>(null);
  const abrirVisor = (id: string) => setCotizacion({ id, tab: "requisicion", readOnly: true });
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const qc = useQueryClient();
  const eliminarBorradorFn = useServerFn(eliminarBorradorRequisicion);
  const eliminarBorrador = useMutation({
    mutationFn: (id: string) => eliminarBorradorFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Borrador eliminado");
      qc.invalidateQueries({ queryKey: ["requisiciones", obraId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al eliminar"),
  });
  const abrirBorrador = (id: string) => {
    setBorradorEnEdicion(id);
    setOpenNueva(true);
  };
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
          <Button
            onClick={() => {
              setBorradorEnEdicion(null);
              setOpenNueva(true);
            }}
            className="shrink-0"
          >
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

          {usarVistaTabla && activas.length > 0 && (
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="py-1 text-xs">Folio</TableHead>
                    <TableHead className="hidden sm:table-cell py-1 text-xs">Solicitante</TableHead>
                    <TableHead className="hidden md:table-cell text-right py-1 text-xs"># insumos</TableHead>
                    <TableHead className="py-1 text-xs">Fecha más próxima</TableHead>
                    <TableHead className="py-1 text-xs">Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activas.map((r: any) => {
                    const meta = ESTATUS_META[r.estatus as RequisicionEstatus];
                    const items = r.items ?? [];
                    const fechas = items
                      .map((it: any) => it.fecha_requerida)
                      .filter(Boolean)
                      .map((d: string) => new Date(d).getTime());
                    const minF = fechas.length > 0 ? Math.min(...fechas) : null;
                    const urgent = minF !== null && Math.ceil((minF - Date.now()) / 86400000) <= 3;
                    const estatus = r.estatus as RequisicionEstatus;
                    const esBorrador = estatus === "borrador";
                    const handleRowClick = () => {
                      if (esBorrador) return abrirBorrador(r.id);
                      if ((estatus === "enviada" || estatus === "en_cotizacion") && puedeCotizar) {
                        return setCotizacion({ id: r.id, tab: "requisicion" });
                      }
                      if (puedeVerOC) return setCotizacion({ id: r.id, tab: "ocs" });
                      return abrirVisor(r.id);
                    };
                    return (
                      <TableRow key={r.id} className="hover:bg-muted/50 h-9 cursor-pointer" onClick={handleRowClick}>
                        <TableCell className="py-1 font-medium text-sm whitespace-nowrap">
                          {esBorrador ? "Borrador" : r.folio}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-1 text-sm text-muted-foreground whitespace-nowrap">
                          {r.solicitante?.nombre_completo ?? "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right py-1 text-sm">{items.length}</TableCell>
                        <TableCell className="py-1">
                          {minF === null ? (
                            <span className="text-muted-foreground text-sm">—</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm whitespace-nowrap">{formatDate(new Date(minF).toISOString())}</span>
                              {urgent && <Badge className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0 h-4">Urgente</Badge>}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-1">
                          <div className="flex items-center justify-between gap-2">
                            <Badge className={`${meta.badge} border-0 text-[10px] px-2 py-0 h-5`}>{meta.label}</Badge>
                            {esBorrador && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-destructive"
                                disabled={eliminarBorrador.isPending}
                                onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar este borrador?")) eliminarBorrador.mutate(r.id); }}
                                aria-label="Eliminar borrador"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}


          {!usarVistaTabla && activas.map((r: any) => {
            const meta = ESTATUS_META[r.estatus as RequisicionEstatus];
            const esBorrador = r.estatus === "borrador";
            const mostrarRevisar = puedeRevisar && r.estatus === "pendiente_autorizacion";
            const isExpanded = expandidos.has(r.id);
            const items = r.items ?? [];
            return (
              <Card
                key={r.id}
                className={`p-3 cursor-pointer hover:border-primary/40 transition-colors ${esBorrador ? "border-dashed" : ""}`}
                onClick={() => (esBorrador ? abrirBorrador(r.id) : abrirVisor(r.id))}
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
                      <span className="font-semibold text-foreground">
                        {esBorrador ? "Borrador" : r.folio}
                      </span>
                      <span className="text-muted-foreground"> · {formatDate(r.created_at)} · {items.length} insumos{r.solicitante?.nombre_completo ? ` · ${r.solicitante.nombre_completo}` : ""}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`${meta.badge} border-0 text-[10px] px-2 py-0.5`}>{meta.label}</Badge>
                    {esBorrador && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => { e.stopPropagation(); abrirBorrador(r.id); }}
                        >
                          <Pencil className="size-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive"
                          disabled={eliminarBorrador.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("¿Eliminar este borrador?")) eliminarBorrador.mutate(r.id);
                          }}
                          aria-label="Eliminar borrador"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
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
                          onClick={() => abrirVisor(r.id)}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Sin requisiciones
                    </TableCell>
                  </TableRow>
                )}
                {historial.map((r: any) => {
                  const meta = ESTATUS_META[r.estatus as RequisicionEstatus];
                  const handleRowClick = () => {
                    if (puedeVerOC) return setCotizacion({ id: r.id, tab: "ocs" });
                    if (puedeCotizar) return setCotizacion({ id: r.id, tab: "requisicion" });
                    return abrirVisor(r.id);
                  };
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={handleRowClick}>
                      <TableCell className="font-medium">{r.folio}</TableCell>
                      <TableCell>{formatDate(r.created_at)}</TableCell>
                      <TableCell className="text-center">{r.items?.length ?? 0}</TableCell>
                      <TableCell>
                        <Badge className={`${meta.badge} border-0`}>{meta.label}</Badge>
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
          onOpenChange={(o) => {
            setOpenNueva(o);
            if (!o) setBorradorEnEdicion(null);
          }}
          borradorId={borradorEnEdicion}
        />
      )}
      {cotizacion && (
        <CotizacionSheet
          requisicionId={cotizacion.id}
          initialTab={cotizacion.tab}
          readOnly={cotizacion.readOnly}
          open={!!cotizacion}
          onOpenChange={(o) => !o && setCotizacion(null)}
        />
      )}

    </div>
  );
}
