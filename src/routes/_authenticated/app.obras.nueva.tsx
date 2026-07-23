import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { crearObra, listCompanyUsers } from "@/lib/api/obras.functions";
import { listClientes, crearCliente } from "@/lib/api/clientes.functions";
import { listUnidadesNegocio } from "@/lib/api/unidades-negocio.functions";
import { useEffectiveIsDirector } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Trash2, Plus, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/obras/nueva")({
  component: NuevaObra,
});

const ROLES_OBRA = [
  { value: "residente", label: "Residente" },
  { value: "auxiliar", label: "Auxiliar" },
  { value: "administrativo", label: "Administrativo" },
  { value: "supervisor", label: "Supervisor" },
] as const;

type RolObra = "director" | "residente" | "auxiliar" | "administrativo" | "supervisor";
type TeamRow = { user_id: string; role: RolObra };
type ComisionRow = { user_id: string; porcentaje: number; base_calculo: "monto_contratado" | "monto_cobrado" | "utilidad" };

function NuevaObra() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const director = useEffectiveIsDirector();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [nombre, setNombre] = useState("");
  const [unidadNegocioId, setUnidadNegocioId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>("");
  const [numeroContrato, setNumeroContrato] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaTerm, setFechaTerm] = useState("");

  // Step 2 (Equipo)
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [comisiones, setComisiones] = useState<ComisionRow[]>([]);
  const [teamError, setTeamError] = useState<string | null>(null);

  const teamValido = team.length > 0 && team.every((t) => !!t.user_id);
  const comisionesValidas = comisiones.every((c) => !!c.user_id);
  const puedeCrear = teamValido && comisionesValidas;

  const fetchClientes = useServerFn(listClientes);
  const fetchUsers = useServerFn(listCompanyUsers);
  const fetchUnidades = useServerFn(listUnidadesNegocio);
  const createObraFn = useServerFn(crearObra);

  const clientesQ = useQuery({ queryKey: ["clientes"], queryFn: () => fetchClientes({ data: {} }) });
  const usersQ = useQuery({ queryKey: ["company-users"], queryFn: () => fetchUsers() });
  const unidadesQ = useQuery({ queryKey: ["unidades-negocio"], queryFn: () => fetchUnidades() });

  const createObraM = useMutation({
    mutationFn: createObraFn,
    onSuccess: ({ obraId }) => {
      toast.success("Obra creada");
      qc.invalidateQueries({ queryKey: ["obras"] });
      navigate({ to: "/app/obras/$obraId", params: { obraId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const goStep1 = () => {
    if (!nombre.trim()) return toast.error("Nombre requerido");
    if (!unidadNegocioId) return toast.error("Selecciona una unidad de negocio");
    if (!clienteId) return toast.error("Selecciona un cliente");
    setStep(2);
  };


  const handleSubmit = () => {
    const teamLimpio = team.filter((t) => !!t.user_id);
    const comisionesLimpias = comisiones.filter((c) => !!c.user_id);

    if (teamLimpio.length !== team.length || comisionesLimpias.length !== comisiones.length) {
      setTeamError("Selecciona un usuario para cada miembro del equipo");
      return;
    }
    setTeamError(null);

    const rs = new Set(teamLimpio.map((t) => t.role));
    if (!rs.has("residente") || !rs.has("administrativo") || !rs.has("supervisor")) {
      return toast.error("Se requiere mínimo Residente, Administrativo y Supervisor");
    }
    createObraM.mutate({
      data: {
        nombre: nombre.trim(),
        unidad_negocio_id: unidadNegocioId,
        cliente_id: clienteId || null,
        numero_contrato: numeroContrato.trim() || undefined,
        ubicacion: ubicacion.trim() || undefined,
        fecha_inicio: fechaInicio || undefined,
        fecha_terminacion: fechaTerm || undefined,
        team: teamLimpio,
        comisiones: comisionesLimpias,
      },
    });
  };


  if (!director) {
    return <p className="text-sm text-destructive">Solo el Director puede crear obras.</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva obra</h1>
        <p className="text-sm text-muted-foreground mt-1">Crea una obra en 2 pasos.</p>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <Card className="p-6 space-y-4">
          <div>
            <Label htmlFor="nombre">Nombre de la obra *</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Unidad de negocio *</Label>
            {unidadesQ.isLoading ? (
              <p className="text-xs text-muted-foreground mt-1">Cargando…</p>
            ) : (unidadesQ.data ?? []).length === 0 ? (
              <Alert className="mt-2">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  Aún no hay unidades de negocio.{" "}
                  <Link to="/app/configuracion" className="underline font-medium">
                    Crea la primera en Configuración
                  </Link>
                  .
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={unidadNegocioId} onValueChange={setUnidadNegocioId}>
                <SelectTrigger><SelectValue placeholder="Selecciona unidad" /></SelectTrigger>
                <SelectContent>
                  {(unidadesQ.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <ClienteSelector
            value={clienteId}
            onChange={setClienteId}
            clientes={clientesQ.data ?? []}
            onCreated={(c) => {
              qc.invalidateQueries({ queryKey: ["clientes"] });
              setClienteId(c.id);
            }}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contrato">Número de contrato</Label>
              <Input id="contrato" value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ubic">Ubicación de la obra</Label>
              <Input
                id="ubic"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Dirección o link de Google Maps"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Puedes pegar un enlace de Google Maps; aparecerá clickeable en las órdenes de compra a proveedores.
              </p>
            </div>
            <div>
              <Label htmlFor="fi">Fecha de inicio</Label>
              <Input id="fi" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ft">Fecha de terminación</Label>
              <Input id="ft" type="date" value={fechaTerm} onChange={(e) => setFechaTerm(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-between">

            <Button variant="ghost" onClick={() => navigate({ to: "/app" })}>Cancelar</Button>
            <Button onClick={goStep1}>Continuar</Button>
          </div>
        </Card>
      )}

      {step === 2 && (

        <Card className="p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Equipo asignado *</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTeam([...team, { user_id: "", role: "residente" }])}
              >
                <Plus className="size-3.5 mr-1" /> Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Mínimo un Residente, un Administrativo y un Supervisor.
            </p>
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
            {teamError && <p className="text-xs text-destructive mt-2">{teamError}</p>}
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-3">
              <Label>Comisiones (opcional)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setComisiones([...comisiones, { user_id: "", porcentaje: 0, base_calculo: "utilidad" }])
                }
              >
                <Plus className="size-3.5 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-2">
              {comisiones.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select
                    value={row.user_id}
                    onValueChange={(v) => {
                      const next = [...comisiones];
                      next[idx] = { ...next[idx], user_id: v };
                      setComisiones(next);
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
                      <SelectItem value="utilidad">Utilidad</SelectItem>
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
          </div>

          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => navigate({ to: "/app" })} disabled={createObraM.isPending}>Cancelar</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={createObraM.isPending}>Atrás</Button>
              <Button onClick={handleSubmit} disabled={createObraM.isPending || !puedeCrear}>
                {createObraM.isPending ? "Creando…" : "Crear obra"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: 1 | 2 }) {
  const items = [
    { n: 1, label: "Datos generales" },
    { n: 2, label: "Equipo" },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it, idx) => (
        <div key={it.n} className="flex items-center gap-2 flex-1">
          <div
            className={`size-7 rounded-full grid place-items-center text-xs font-medium ${
              step >= it.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {it.n}
          </div>
          <span className={`text-sm ${step >= it.n ? "font-medium" : "text-muted-foreground"}`}>
            {it.label}
          </span>
          {idx < items.length - 1 && <div className="h-px bg-border flex-1" />}
        </div>
      ))}
    </div>
  );
}

function ClienteSelector({
  value,
  onChange,
  clientes,
  onCreated,
}: {
  value: string;
  onChange: (v: string) => void;
  clientes: Array<{ id: string; razon_social: string; rfc: string }>;
  onCreated: (c: { id: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipoPersona, setTipoPersona] = useState<"moral" | "fisica">("moral");
  const [razonSocial, setRazonSocial] = useState("");
  const [rfc, setRfc] = useState("");
  const create = useServerFn(crearCliente);
  const m = useMutation({
    mutationFn: create,
    onSuccess: (c) => {
      toast.success("Cliente creado");
      onCreated(c);
      setOpen(false);
      setRazonSocial("");
      setRfc("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <Label>Cliente *</Label>
      <div className="flex gap-2 mt-1.5">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.razon_social} <span className="text-muted-foreground">· {c.rfc}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-1" /> Nuevo
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de persona</Label>
              <Select value={tipoPersona} onValueChange={(v) => setTipoPersona(v as "moral" | "fisica")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moral">Persona moral</SelectItem>
                  <SelectItem value="fisica">Persona física</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Razón social</Label>
              <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
            </div>
            <div>
              <Label>RFC</Label>
              <Input value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() =>
                m.mutate({
                  data: {
                    tipo_persona: tipoPersona,
                    razon_social: razonSocial.trim(),
                    rfc: rfc.trim(),
                    datos_contacto: { nombre_contacto: "", email: "", telefono: "" },
                  },
                })
              }
              disabled={m.isPending}
            >
              {m.isPending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
