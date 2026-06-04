import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getObraConfiguracion,
  actualizarObra,
  actualizarObraTeam,
  actualizarObraComisiones,
  listCompanyUsers,
} from "@/lib/api/obras.functions";
import { listClientes } from "@/lib/api/clientes.functions";
import { listUnidadesNegocio } from "@/lib/api/unidades-negocio.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore, useEffectiveIsDirector } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Check } from "lucide-react";

type RolObra = "director" | "residente" | "auxiliar" | "administrativo" | "supervisor";
type TeamRow = { user_id: string; role: RolObra };
type ComisionRow = {
  user_id: string;
  porcentaje: number;
  base_calculo: "monto_contratado" | "monto_cobrado";
};

const ROLES_OBRA: { value: RolObra; label: string }[] = [
  { value: "residente", label: "Residente" },
  { value: "auxiliar", label: "Auxiliar" },
  { value: "administrativo", label: "Administrativo" },
  { value: "supervisor", label: "Supervisor" },
];

export const Route = createFileRoute("/_authenticated/app/obras/$obraId/configuracion")({
  component: ConfiguracionObra,
});

function ConfiguracionObra() {
  const { obraId } = Route.useParams();
  const navigate = useNavigate();
  const director = useEffectiveIsDirector();

  useEffect(() => {
    if (!director) {
      navigate({ to: "/app/obras/$obraId", params: { obraId } });
    }
  }, [director, navigate, obraId]);

  const fetchCfg = useServerFn(getObraConfiguracion);
  const cfg = useQuery({
    queryKey: ["obra-configuracion", obraId],
    queryFn: () => fetchCfg({ data: { obraId } }),
    enabled: director,
  });

  if (!director) return null;
  if (cfg.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (cfg.error || !cfg.data)
    return <p className="text-sm text-destructive">No se pudo cargar la configuración.</p>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración de la obra</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edita los datos generales, presupuesto, equipo y comisiones.
        </p>
      </div>

      <Tabs defaultValue="datos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="datos">Datos generales</TabsTrigger>
          <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
        </TabsList>

        <TabsContent value="datos">
          <DatosTab obraId={obraId} initial={cfg.data.obra} />
        </TabsContent>
        <TabsContent value="presupuesto">
          <PresupuestoTab obraId={obraId} initial={cfg.data.obra} />
        </TabsContent>
        <TabsContent value="equipo">
          <EquipoTab obraId={obraId} initial={cfg.data.team as TeamRow[]} />
        </TabsContent>
        <TabsContent value="comisiones">
          <ComisionesTab obraId={obraId} initial={cfg.data.comisiones as ComisionRow[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Datos generales
// ============================================================

type ObraData = {
  id: string;
  nombre: string;
  unidad_negocio_id: string | null;
  cliente_id: string | null;
  numero_contrato: string | null;
  ubicacion: string | null;
  fecha_inicio: string | null;
  fecha_terminacion: string | null;
  presupuesto_url: string | null;
  monto_contratado: number | null;
};

function DatosTab({ obraId, initial }: { obraId: string; initial: ObraData }) {
  const qc = useQueryClient();
  const update = useServerFn(actualizarObra);
  const fetchClientes = useServerFn(listClientes);
  const fetchUnidades = useServerFn(listUnidadesNegocio);

  const clientesQ = useQuery({ queryKey: ["clientes"], queryFn: () => fetchClientes({ data: {} }) });
  const unidadesQ = useQuery({ queryKey: ["unidades-negocio"], queryFn: () => fetchUnidades() });

  const [nombre, setNombre] = useState(initial.nombre);
  const [unidadNegocioId, setUnidadNegocioId] = useState(initial.unidad_negocio_id ?? "");
  const [clienteId, setClienteId] = useState(initial.cliente_id ?? "");
  const [numeroContrato, setNumeroContrato] = useState(initial.numero_contrato ?? "");
  const [ubicacion, setUbicacion] = useState(initial.ubicacion ?? "");
  const [fechaInicio, setFechaInicio] = useState(initial.fecha_inicio ?? "");
  const [fechaTerm, setFechaTerm] = useState(initial.fecha_terminacion ?? "");
  const [montoContratado, setMontoContratado] = useState<string>(
    initial.monto_contratado != null ? String(initial.monto_contratado) : ""
  );

  const m = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Datos actualizados");
      qc.invalidateQueries({ queryKey: ["obra-configuracion", obraId] });
      qc.invalidateQueries({ queryKey: ["obra-dashboard", obraId] });
      qc.invalidateQueries({ queryKey: ["obras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!nombre.trim()) return toast.error("Nombre requerido");
    if (!unidadNegocioId) return toast.error("Selecciona unidad de negocio");
    m.mutate({
      data: {
        obraId,
        nombre: nombre.trim(),
        unidad_negocio_id: unidadNegocioId,
        cliente_id: clienteId || null,
        numero_contrato: numeroContrato.trim() || null,
        ubicacion: ubicacion.trim() || null,
        fecha_inicio: fechaInicio || null,
        fecha_terminacion: fechaTerm || null,
        monto_contratado: montoContratado === "" ? null : Number(montoContratado),
      },
    });
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <Label htmlFor="nombre">Nombre de la obra *</Label>
        <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div>
        <Label>Unidad de negocio *</Label>
        <Select value={unidadNegocioId} onValueChange={setUnidadNegocioId}>
          <SelectTrigger><SelectValue placeholder="Selecciona unidad" /></SelectTrigger>
          <SelectContent>
            {(unidadesQ.data ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Cliente</Label>
        <Select value={clienteId} onValueChange={setClienteId}>
          <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
          <SelectContent>
            {(clientesQ.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.razon_social} <span className="text-muted-foreground">· {c.rfc}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contrato">Número de contrato</Label>
          <Input id="contrato" value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ubic">Ubicación</Label>
          <Input id="ubic" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="fi">Fecha de inicio</Label>
          <Input id="fi" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ft">Fecha de terminación</Label>
          <Input id="ft" type="date" value={fechaTerm} onChange={(e) => setFechaTerm(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="monto">Monto contratado (MXN)</Label>
          <Input
            id="monto"
            type="number"
            min={0}
            step="0.01"
            value={montoContratado}
            onChange={(e) => setMontoContratado(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={m.isPending}>
          {m.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </Card>
  );
}

// ============================================================
// Presupuesto (archivo)
// ============================================================

function PresupuestoTab({ obraId, initial }: { obraId: string; initial: ObraData }) {
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const update = useServerFn(actualizarObra);
  const [uploading, setUploading] = useState(false);
  const [presupuestoUrl, setPresupuestoUrl] = useState<string | null>(initial.presupuesto_url);

  const m = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Presupuesto actualizado");
      qc.invalidateQueries({ queryKey: ["obra-configuracion", obraId] });
      qc.invalidateQueries({ queryKey: ["obra-dashboard", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = async (file: File) => {
    if (!profile?.company_id) return;
    setUploading(true);
    try {
      const path = `${profile.company_id}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("presupuestos").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (error) throw error;
      setPresupuestoUrl(path);
      // Persist new path
      m.mutate({
        data: {
          obraId,
          nombre: initial.nombre,
          unidad_negocio_id: initial.unidad_negocio_id ?? "",
          cliente_id: initial.cliente_id,
          numero_contrato: initial.numero_contrato,
          ubicacion: initial.ubicacion,
          fecha_inicio: initial.fecha_inicio,
          fecha_terminacion: initial.fecha_terminacion,
          monto_contratado: initial.monto_contratado,
          presupuesto_url: path,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <Label>Presupuesto (.xlsx)</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Sube un archivo nuevo para reemplazar el actual.
        </p>
      </div>
      {presupuestoUrl && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Check className="size-3 text-primary" /> Archivo actual cargado
        </p>
      )}
      <Input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }}
        disabled={uploading || m.isPending}
      />
    </Card>
  );
}

// ============================================================
// Equipo
// ============================================================

function EquipoTab({ obraId, initial }: { obraId: string; initial: TeamRow[] }) {
  const qc = useQueryClient();
  const update = useServerFn(actualizarObraTeam);
  const fetchUsers = useServerFn(listCompanyUsers);
  const usersQ = useQuery({ queryKey: ["company-users"], queryFn: () => fetchUsers() });

  const [team, setTeam] = useState<TeamRow[]>(initial);

  const m = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Equipo actualizado");
      qc.invalidateQueries({ queryKey: ["obra-configuracion", obraId] });
      qc.invalidateQueries({ queryKey: ["obra-dashboard", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    const limpio = team.filter((t) => !!t.user_id);
    if (limpio.length !== team.length) return toast.error("Selecciona usuario en cada fila");
    const rs = new Set(limpio.map((t) => t.role));
    if (!rs.has("residente") || !rs.has("administrativo") || !rs.has("supervisor")) {
      return toast.error("Mínimo Residente, Administrativo y Supervisor");
    }
    m.mutate({ data: { obraId, team: limpio } });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Equipo asignado</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Mínimo un Residente, un Administrativo y un Supervisor.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTeam([...team, { user_id: "", role: "residente" }])}
        >
          <Plus className="size-3.5 mr-1" /> Agregar
        </Button>
      </div>

      <div className="space-y-2">
        {team.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <Select
              value={row.user_id}
              onValueChange={(v) => {
                const next = [...team];
                next[idx] = { ...next[idx], user_id: v };
                setTeam(next);
              }}
            >
              <SelectTrigger className="flex-1"><SelectValue placeholder="Usuario" /></SelectTrigger>
              <SelectContent>
                {(usersQ.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre_completo || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={row.role}
              onValueChange={(v) => {
                const next = [...team];
                next[idx] = { ...next[idx], role: v as RolObra };
                setTeam(next);
              }}
            >
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES_OBRA.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTeam(team.filter((_, i) => i !== idx))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={m.isPending}>
          {m.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </Card>
  );
}

// ============================================================
// Comisiones
// ============================================================

function ComisionesTab({ obraId, initial }: { obraId: string; initial: ComisionRow[] }) {
  const qc = useQueryClient();
  const update = useServerFn(actualizarObraComisiones);
  const fetchUsers = useServerFn(listCompanyUsers);
  const usersQ = useQuery({ queryKey: ["company-users"], queryFn: () => fetchUsers() });

  const [comisiones, setComisiones] = useState<ComisionRow[]>(initial);

  const m = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Comisiones actualizadas");
      qc.invalidateQueries({ queryKey: ["obra-configuracion", obraId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    const limpio = comisiones.filter((c) => !!c.user_id);
    if (limpio.length !== comisiones.length) return toast.error("Selecciona usuario en cada fila");
    m.mutate({ data: { obraId, comisiones: limpio } });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Label>Comisiones</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setComisiones([
              ...comisiones,
              { user_id: "", porcentaje: 0, base_calculo: "monto_contratado" },
            ])
          }
        >
          <Plus className="size-3.5 mr-1" /> Agregar
        </Button>
      </div>

      <div className="space-y-2">
        {comisiones.map((row, idx) => (
          <div key={idx} className="flex gap-2 items-center flex-wrap">
            <Select
              value={row.user_id}
              onValueChange={(v) => {
                const next = [...comisiones];
                next[idx] = { ...next[idx], user_id: v };
                setComisiones(next);
              }}
            >
              <SelectTrigger className="flex-1 min-w-[160px]">
                <SelectValue placeholder="Usuario" />
              </SelectTrigger>
              <SelectContent>
                {(usersQ.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre_completo || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              className="w-24"
              value={row.porcentaje}
              onChange={(e) => {
                const next = [...comisiones];
                next[idx] = { ...next[idx], porcentaje: Number(e.target.value) };
                setComisiones(next);
              }}
            />
            <span className="text-xs text-muted-foreground">%</span>
            <Select
              value={row.base_calculo}
              onValueChange={(v) => {
                const next = [...comisiones];
                next[idx] = { ...next[idx], base_calculo: v as ComisionRow["base_calculo"] };
                setComisiones(next);
              }}
            >
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monto_contratado">Monto contratado</SelectItem>
                <SelectItem value="monto_cobrado">Monto cobrado</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setComisiones(comisiones.filter((_, i) => i !== idx))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={m.isPending}>
          {m.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </Card>
  );
}
