import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, BarChart3, Boxes, Check, FileSpreadsheet, FolderTree, Pencil, Plus, Ruler, Search,
  Tag, Trash2, TrendingUp, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useEffectiveRoles, isDirector as checkDirector } from "@/stores/auth";
import {
  listInsumos, listCategorias, getMetricasInsumos, solicitarInsumo, editarInsumo,
  autorizarInsumo, rechazarInsumo, crearCategoria, editarCategoria, eliminarCategoria,
  getHistorialPrecios, listUnidades, crearUnidad, editarUnidad, eliminarUnidad,
} from "@/lib/api/insumos.functions";
import { ImportarInsumosDialog } from "./ImportarInsumosDialog";

type Unidad = string;

const BADGE_TONES = [
  "bg-blue-100 text-blue-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-purple-100 text-purple-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
];
function toneFor(id: string | null | undefined) {
  if (!id) return "bg-muted text-muted-foreground";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BADGE_TONES[h % BADGE_TONES.length];
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export function CatalogoInsumosModule() {
  const roles = useEffectiveRoles();
  const director = checkDirector(roles);
  const qc = useQueryClient();

  const [tab, setTab] = useState<"autorizado" | "pendiente">("autorizado");
  const [search, setSearch] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("all");
  const [unidad, setUnidad] = useState<string>("all");

  const [openSolicitar, setOpenSolicitar] = useState(false);
  const [openImportar, setOpenImportar] = useState(false);
  const [openCategorias, setOpenCategorias] = useState(false);
  const [editInsumo, setEditInsumo] = useState<any | null>(null);
  const [historialFor, setHistorialFor] = useState<any | null>(null);

  const listFn = useServerFn(listInsumos);
  const catsFn = useServerFn(listCategorias);
  const metFn = useServerFn(getMetricasInsumos);

  const filtros = {
    estatus: tab,
    categoriaId: categoriaId === "all" ? null : categoriaId,
    unidad: unidad === "all" ? undefined : (unidad as Unidad),
    search: search || undefined,
  };

  const insumosQ = useQuery({
    queryKey: ["insumos", filtros],
    queryFn: () => listFn({ data: filtros }),
  });
  const categoriasQ = useQuery({ queryKey: ["insumo-categorias"], queryFn: () => catsFn() });
  const metricasQ = useQuery({ queryKey: ["insumos-metricas"], queryFn: () => metFn() });

  const pendientesCount = metricasQ.data?.pendientes ?? 0;

  const autorizarMut = useMutation({
    mutationFn: useServerFn(autorizarInsumo),
    onSuccess: () => {
      toast.success("Insumo autorizado");
      qc.invalidateQueries({ queryKey: ["insumos"] });
      qc.invalidateQueries({ queryKey: ["insumos-metricas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const rechazarMut = useMutation({
    mutationFn: useServerFn(rechazarInsumo),
    onSuccess: () => {
      toast.success("Insumo rechazado");
      qc.invalidateQueries({ queryKey: ["insumos"] });
      qc.invalidateQueries({ queryKey: ["insumos-metricas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insumos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona los insumos disponibles para tus obras
          </p>
        </div>
        <div className="flex gap-2">
          {director && (
            <Button variant="outline" onClick={() => setOpenCategorias(true)}>
              <FolderTree /> Categorías
            </Button>
          )}
          {director && (
            <Button variant="outline" onClick={() => setOpenImportar(true)}>
              <FileSpreadsheet /> Importar Excel
            </Button>
          )}
          <Button onClick={() => setOpenSolicitar(true)}>
            <Plus /> Solicitar insumo
          </Button>
        </div>
      </header>

      {director && pendientesCount > 0 && (
        <Card className="border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-900">
              Tienes {pendientesCount} {pendientesCount === 1 ? "insumo pendiente" : "insumos pendientes"} de autorización
            </p>
            <p className="text-sm text-amber-800">Revisa la pestaña Pendientes para autorizar o rechazar.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setTab("pendiente")}>
            Revisar
          </Button>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre o código..."
                className="pl-8"
              />
            </div>
          </div>
          <div className="w-48">
            <Label className="text-xs text-muted-foreground">Categoría</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(categoriasQ.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Label className="text-xs text-muted-foreground">Unidad</Label>
            <Select value={unidad} onValueChange={setUnidad}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="autorizado">Autorizados</TabsTrigger>
            {director && (
              <TabsTrigger value="pendiente" className="gap-2">
                Pendientes
                {pendientesCount > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5">{pendientesCount}</Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="autorizado" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Último precio</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(insumosQ.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No hay insumos autorizados con esos filtros.
                  </TableCell></TableRow>
                )}
                {(insumosQ.data ?? []).map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.codigo ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {i.nombre}
                        {i.disponible_renta && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Renta</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="outline">{i.unidad}</Badge></TableCell>
                    <TableCell>
                      {i.categoria ? (
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneFor(i.categoria.id)}`}>
                          {i.categoria.nombre}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">Sin categoría</span>}
                    </TableCell>
                    <TableCell>
                      {i.ultimo_precio ? fmtMoney(i.ultimo_precio.precio) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>{i.ultimo_precio?.proveedor ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setHistorialFor(i)} title="Ver historial">
                        <BarChart3 />
                      </Button>
                      {director && (
                        <Button size="icon" variant="ghost" onClick={() => setEditInsumo(i)} title="Editar">
                          <Pencil />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {director && (
            <TabsContent value="pendiente" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Solicitado por</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(insumosQ.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Sin solicitudes pendientes.
                    </TableCell></TableRow>
                  )}
                  {(insumosQ.data ?? []).map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.nombre}</TableCell>
                      <TableCell><Badge variant="outline">{i.unidad}</Badge></TableCell>
                      <TableCell>
                        {i.categoria ? (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneFor(i.categoria.id)}`}>
                            {i.categoria.nombre}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">Sin categoría</span>}
                      </TableCell>
                      <TableCell>{i.solicitante?.nombre_completo ?? i.solicitante?.email ?? "—"}</TableCell>
                      <TableCell>{new Date(i.created_at).toLocaleDateString("es-MX")}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" onClick={() => autorizarMut.mutate({ data: { id: i.id } })}>
                          <Check /> Autorizar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rechazarMut.mutate({ data: { id: i.id } })}>
                          <X /> Rechazar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          )}
        </Tabs>
      </Card>

      <SolicitarDialog
        open={openSolicitar}
        onOpenChange={setOpenSolicitar}
        categorias={categoriasQ.data ?? []}
      />
      {director && (
        <ImportarInsumosDialog open={openImportar} onOpenChange={setOpenImportar} />
      )}
      {director && (
        <CategoriasDialog
          open={openCategorias}
          onOpenChange={setOpenCategorias}
          categorias={categoriasQ.data ?? []}
        />
      )}
      {editInsumo && (
        <EditarInsumoDialog
          insumo={editInsumo}
          categorias={categoriasQ.data ?? []}
          onClose={() => setEditInsumo(null)}
        />
      )}
      {historialFor && (
        <HistorialDialog insumo={historialFor} onClose={() => setHistorialFor(null)} />
      )}
    </div>
  );
}

function MetricCard({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <Card className={`p-4 ${accent ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-md p-2 ${accent ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function SolicitarDialog({
  open, onOpenChange, categorias,
}: { open: boolean; onOpenChange: (b: boolean) => void; categorias: any[] }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState<Unidad>("PZA");
  const [categoriaId, setCategoriaId] = useState<string>("none");

  const mut = useMutation({
    mutationFn: useServerFn(solicitarInsumo),
    onSuccess: () => {
      toast.success("Insumo solicitado. Pendiente de autorización.");
      qc.invalidateQueries({ queryKey: ["insumos"] });
      qc.invalidateQueries({ queryKey: ["insumos-metricas"] });
      setNombre(""); setUnidad("PZA"); setCategoriaId("none");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar insumo</DialogTitle>
          <DialogDescription>El Director revisará tu solicitud.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidad</Label>
              <Select value={unidad} onValueChange={(v) => setUnidad(v as Unidad)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!nombre.trim() || mut.isPending}
            onClick={() => mut.mutate({ data: {
              nombre: nombre.trim(), unidad,
              categoriaId: categoriaId === "none" ? null : categoriaId,
            } })}
          >
            Solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function derivarPrefijoUI(nombre: string): string {
  const clean = nombre.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (clean + "XXX").slice(0, 3);
}

function CategoriasDialog({
  open, onOpenChange, categorias,
}: { open: boolean; onOpenChange: (b: boolean) => void; categorias: any[] }) {
  const qc = useQueryClient();
  const [nueva, setNueva] = useState("");
  const [nuevoPrefijo, setNuevoPrefijo] = useState("");
  const [editing, setEditing] = useState<{ id: string; nombre: string; prefijo: string } | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["insumo-categorias"] });
    qc.invalidateQueries({ queryKey: ["insumos-metricas"] });
    qc.invalidateQueries({ queryKey: ["insumos"] });
  };

  const crearMut = useMutation({
    mutationFn: useServerFn(crearCategoria),
    onSuccess: () => { toast.success("Categoría creada"); setNueva(""); setNuevoPrefijo(""); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const editMut = useMutation({
    mutationFn: useServerFn(editarCategoria),
    onSuccess: () => { toast.success("Categoría actualizada"); setEditing(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: useServerFn(eliminarCategoria),
    onSuccess: () => { toast.success("Categoría eliminada"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const prefijoAuto = nueva.trim() ? derivarPrefijoUI(nueva.trim()) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorías de insumos</DialogTitle>
          <DialogDescription>
            El prefijo (3 caracteres) se usa para generar el código de los insumos, ej. <span className="font-mono">CEM-0001</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_100px_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Nombre</Label>
              <Input
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                placeholder="Nueva categoría..."
                maxLength={100}
              />
            </div>
            <div>
              <Label className="text-xs">Prefijo</Label>
              <Input
                value={nuevoPrefijo}
                onChange={(e) => setNuevoPrefijo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3))}
                placeholder={prefijoAuto || "AUTO"}
                maxLength={3}
                className="font-mono uppercase"
              />
            </div>
            <Button
              disabled={!nueva.trim() || crearMut.isPending}
              onClick={() => crearMut.mutate({ data: {
                nombre: nueva.trim(),
                prefijo: nuevoPrefijo.length === 3 ? nuevoPrefijo : undefined,
              } })}
            >
              <Plus /> Agregar
            </Button>
          </div>
          <div className="border rounded-md divide-y max-h-80 overflow-auto">
            {categorias.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">Sin categorías aún.</p>
            )}
            {categorias.map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-2">
                {editing && editing.id === c.id ? (
                  <>
                    <Input
                      value={editing.nombre}
                      onChange={(e) => setEditing((prev) => prev ? { ...prev, nombre: e.target.value } : prev)}
                      maxLength={100}
                      className="flex-1"
                    />
                    <Input
                      value={editing.prefijo}
                      onChange={(e) => setEditing((prev) => prev ? { ...prev, prefijo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) } : prev)}
                      maxLength={3}
                      className="w-20 font-mono uppercase"
                    />
                    <Button size="sm" onClick={() => editing && editMut.mutate({ data: {
                      id: editing.id,
                      nombre: editing.nombre.trim(),
                      prefijo: editing.prefijo.length === 3 ? editing.prefijo : undefined,
                    } })}>Guardar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{c.nombre}</span>
                    <Badge variant="outline" className="font-mono">{c.prefijo ?? "—"}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ id: c.id, nombre: c.nombre, prefijo: c.prefijo ?? "" })}>
                      <Pencil />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => {
                        if (confirm(`¿Eliminar "${c.nombre}"?`)) delMut.mutate({ data: { id: c.id } });
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditarInsumoDialog({
  insumo, categorias, onClose,
}: { insumo: any; categorias: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(insumo.nombre);
  const [codigo, setCodigo] = useState<string>(insumo.codigo ?? "");
  const [unidad, setUnidad] = useState<Unidad>(insumo.unidad);
  const [categoriaId, setCategoriaId] = useState<string>(insumo.categoria_id ?? "none");
  const [disponibleRenta, setDisponibleRenta] = useState<boolean>(!!insumo.disponible_renta);

  const codigoValido = !codigo || /^[A-Z0-9]{2,5}-\d{3,6}$/.test(codigo);

  const mut = useMutation({
    mutationFn: useServerFn(editarInsumo),
    onSuccess: () => {
      toast.success("Insumo actualizado");
      qc.invalidateQueries({ queryKey: ["insumos"] });
      qc.invalidateQueries({ queryKey: ["insumos-renta"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar insumo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <Label>Código</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                placeholder="CEM-0001"
                maxLength={12}
                className="font-mono uppercase"
              />
              {!codigoValido && (
                <p className="text-[11px] text-destructive mt-1">Formato: PREFIJO-NÚMERO (ej. CEM-0001)</p>
              )}
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidad</Label>
              <Select value={unidad} onValueChange={(v) => setUnidad(v as Unidad)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
            <Checkbox
              checked={disponibleRenta}
              onCheckedChange={(v) => setDisponibleRenta(v === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">Disponible para rentas</p>
              <p className="text-xs text-muted-foreground">
                Si está activo, el insumo podrá seleccionarse al crear una solicitud de renta en obra.
              </p>
            </div>
          </label>

          <p className="text-xs text-muted-foreground">
            El código se asigna automáticamente al crear el insumo. Solo se edita si necesitas corregirlo manualmente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!nombre.trim() || !codigoValido || mut.isPending}
            onClick={() => mut.mutate({ data: {
              id: insumo.id, nombre: nombre.trim(), unidad,
              categoriaId: categoriaId === "none" ? null : categoriaId,
              codigo: codigo || undefined,
              disponibleRenta,
            } })}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistorialDialog({ insumo, onClose }: { insumo: any; onClose: () => void }) {
  const fn = useServerFn(getHistorialPrecios);
  const q = useQuery({
    queryKey: ["insumo-historial", insumo.id],
    queryFn: () => fn({ data: { insumoId: insumo.id } }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de precios — {insumo.nombre}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Precio unitario</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Proveedor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                Sin historial. Se alimentará desde las órdenes de compra.
              </TableCell></TableRow>
            )}
            {(q.data ?? []).map((h: any) => (
              <TableRow key={h.id}>
                <TableCell>{new Date(h.fecha).toLocaleDateString("es-MX")}</TableCell>
                <TableCell>{fmtMoney(Number(h.precio_unitario))}</TableCell>
                <TableCell>{h.cantidad ?? "—"}</TableCell>
                <TableCell>{h.proveedor ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
