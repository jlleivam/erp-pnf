import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crearTrabajador,
  actualizarTrabajador,
} from "@/lib/api/trabajadores.functions";
import { PUESTOS, type TrabajadorPuesto } from "./imss";

export type TrabajadorFormInitial = {
  id?: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  curp?: string | null;
  nss?: string | null;
  rfc?: string | null;
  fecha_nacimiento?: string | null;
  sexo?: "masculino" | "femenino" | null;
  estado_civil?: string | null;
  puesto?: TrabajadorPuesto | null;
  sueldo_diario?: number | null;
  tipo_contrato?: "eventual_urbano" | "eventual_campo" | "permanente" | null;
  fecha_ingreso?: string | null;
  fecha_baja?: string | null;
  imss_estatus?: "alta_activa" | "sin_alta" | "en_tramite" | "baja";
  imss_fecha_alta?: string | null;
  imss_nss?: string | null;
  imss_sbc?: number | null;
  imss_tipo_trabajador?: string | null;
};

const EMPTY: TrabajadorFormInitial = {
  nombres: "",
  apellido_paterno: "",
  apellido_materno: "",
  imss_estatus: "sin_alta",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Req() {
  return <span className="text-destructive ml-0.5" aria-hidden="true">*</span>;
}


export function TrabajadorFormDialog({
  open,
  onClose,
  initial,
  canManage,
  obraId,
}: {
  open: boolean;
  onClose: () => void;
  initial?: TrabajadorFormInitial | null;
  canManage: boolean;
  obraId?: string;
}) {
  const isEdit = !!initial?.id;
  const [f, setF] = useState<TrabajadorFormInitial>(initial ?? EMPTY);
  const set = <K extends keyof TrabajadorFormInitial>(
    k: K,
    v: TrabajadorFormInitial[K],
  ) => setF((p) => ({ ...p, [k]: v }));

  const qc = useQueryClient();
  const create = useServerFn(crearTrabajador);
  const update = useServerFn(actualizarTrabajador);

  const createM = useMutation({
    mutationFn: create,
    onSuccess: () => {
      toast.success(
        canManage ? "Trabajador creado" : "Solicitud enviada. Pendiente de registro.",
      );
      qc.invalidateQueries({ queryKey: ["trabajadores"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Trabajador actualizado");
      qc.invalidateQueries({ queryKey: ["trabajadores"] });
      qc.invalidateQueries({ queryKey: ["trabajador", initial?.id] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!f.nombres.trim()) return toast.error("Nombre(s) requerido");
    if (!f.apellido_paterno.trim()) return toast.error("Apellido paterno requerido");
    if (!f.apellido_materno?.trim()) return toast.error("Apellido materno requerido");
    if (!f.puesto) return toast.error("Puesto requerido");
    if (f.sueldo_diario == null || isNaN(Number(f.sueldo_diario)) || Number(f.sueldo_diario) <= 0)
      return toast.error("Sueldo semanal requerido");
    if (!isEdit && !canManage) {
      if (!f.sexo) return toast.error("Sexo requerido");
    }
    const payload = {
      nombres: f.nombres.trim(),
      apellido_paterno: f.apellido_paterno.trim(),
      apellido_materno: f.apellido_materno?.trim() || null,
      telefono: f.telefono?.trim() || null,
      correo: f.correo?.trim() || null,
      direccion: f.direccion?.trim() || null,
      curp: f.curp?.trim().toUpperCase() || null,
      nss: f.nss?.trim() || null,
      rfc: f.rfc?.trim().toUpperCase() || null,
      fecha_nacimiento: f.fecha_nacimiento || null,
      sexo: f.sexo ?? null,
      estado_civil: f.estado_civil?.trim() || null,
      puesto: f.puesto ?? null,
      sueldo_diario:
        f.sueldo_diario == null || isNaN(Number(f.sueldo_diario))
          ? null
          : Number(f.sueldo_diario),
      tipo_contrato: f.tipo_contrato ?? null,
      fecha_ingreso: f.fecha_ingreso || null,
      fecha_baja: f.fecha_baja || null,
      imss_estatus: canManage ? (f.imss_estatus ?? "sin_alta") : "sin_alta",
      imss_fecha_alta: canManage ? (f.imss_fecha_alta || null) : null,
      imss_nss: canManage ? (f.imss_nss?.trim() || null) : null,
      imss_sbc: canManage
        ? (f.imss_sbc == null || isNaN(Number(f.imss_sbc)) ? null : Number(f.imss_sbc))
        : null,
      imss_tipo_trabajador: canManage ? (f.imss_tipo_trabajador?.trim() || null) : null,

    };
    if (isEdit && initial?.id) {
      updateM.mutate({ data: { ...payload, id: initial.id } });
    } else {
      createM.mutate({ data: obraId ? { ...payload, obraId } : payload });
    }
  };

  const pending = createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Editar trabajador"
              : canManage
                ? "Nuevo trabajador"
                : "Solicitar alta de trabajador"}
          </DialogTitle>
          <DialogDescription>
            {canManage
              ? "Captura los datos del trabajador. Los documentos se suben desde la ficha."
              : "Tu solicitud quedará pendiente de registro por un administrativo o director."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {!isEdit && !canManage && (
            <p className="text-xs text-muted-foreground">
              Los campos marcados con <Req /> son obligatorios.
            </p>
          )}
          <Section title="Datos personales">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Nombre(s)<Req /></Label>
                <Input
                  value={f.nombres}
                  onChange={(e) => set("nombres", e.target.value)}
                />
              </div>
              <div>
                <Label>Apellido paterno<Req /></Label>
                <Input
                  value={f.apellido_paterno}
                  onChange={(e) => set("apellido_paterno", e.target.value)}
                />
              </div>
              <div>
                <Label>Apellido materno<Req /></Label>
                <Input
                  value={f.apellido_materno ?? ""}
                  onChange={(e) => set("apellido_materno", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={f.fecha_nacimiento ?? ""}
                  onChange={(e) => set("fecha_nacimiento", e.target.value || null)}
                />
              </div>
              <div>
                <Label>Sexo{!isEdit && !canManage && <Req />}</Label>
                <Select
                  value={f.sexo ?? ""}
                  onValueChange={(v) =>
                    set("sexo", (v || null) as TrabajadorFormInitial["sexo"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="femenino">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CURP</Label>
                <Input
                  value={f.curp ?? ""}
                  onChange={(e) => set("curp", e.target.value.toUpperCase())}
                  maxLength={18}
                  className="font-mono uppercase"
                />
              </div>
              <div>
                <Label>RFC</Label>
                <Input
                  value={f.rfc ?? ""}
                  onChange={(e) => set("rfc", e.target.value.toUpperCase())}
                  maxLength={13}
                  className="font-mono uppercase"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estado civil</Label>
                <Input
                  value={f.estado_civil ?? ""}
                  onChange={(e) => set("estado_civil", e.target.value)}
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={f.telefono ?? ""}
                  onChange={(e) => set("telefono", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Correo</Label>
              <Input
                type="email"
                value={f.correo ?? ""}
                onChange={(e) => set("correo", e.target.value)}
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <Input
                value={f.direccion ?? ""}
                onChange={(e) => set("direccion", e.target.value)}
              />
            </div>
          </Section>

          <Section title="Datos laborales">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Puesto{!isEdit && !canManage && <Req />}</Label>
                <Select
                  value={f.puesto ?? ""}
                  onValueChange={(v) => set("puesto", v as TrabajadorPuesto)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona puesto" />
                  </SelectTrigger>
                  <SelectContent>
                    {PUESTOS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sueldo semanal (MXN){!isEdit && !canManage && <Req />}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Semanal"
                    value={
                      f.sueldo_diario == null || isNaN(Number(f.sueldo_diario))
                        ? ""
                        : Number((Number(f.sueldo_diario) * 6).toFixed(2))
                    }
                    onChange={(e) =>
                      set(
                        "sueldo_diario",
                        e.target.value === "" ? null : Number(e.target.value) / 6,
                      )
                    }
                  />
                  <Input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    className="bg-muted text-muted-foreground"
                    placeholder="Diario ÷6"
                    value={
                      f.sueldo_diario == null || isNaN(Number(f.sueldo_diario))
                        ? ""
                        : `$${Number(f.sueldo_diario).toFixed(2)} / día`
                    }
                  />
                </div>
              </div>

            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo de contrato</Label>
                <Select
                  value={f.tipo_contrato ?? ""}
                  onValueChange={(v) =>
                    set(
                      "tipo_contrato",
                      (v || null) as TrabajadorFormInitial["tipo_contrato"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eventual_urbano">Eventual urbano</SelectItem>
                    <SelectItem value="eventual_campo">Eventual campo</SelectItem>
                    <SelectItem value="permanente">Permanente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha de ingreso</Label>
                <Input
                  type="date"
                  value={f.fecha_ingreso ?? ""}
                  onChange={(e) => set("fecha_ingreso", e.target.value || null)}
                />
              </div>
              <div>
                <Label>Fecha de baja</Label>
                <Input
                  type="date"
                  value={f.fecha_baja ?? ""}
                  onChange={(e) => set("fecha_baja", e.target.value || null)}
                />
              </div>
            </div>
          </Section>

          {canManage && (
            <Section title="IMSS">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Estatus IMSS</Label>
                  <Select
                    value={f.imss_estatus ?? "sin_alta"}
                    onValueChange={(v) =>
                      set("imss_estatus", v as TrabajadorFormInitial["imss_estatus"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta_activa">Alta activa</SelectItem>
                      <SelectItem value="sin_alta">Sin alta</SelectItem>
                      <SelectItem value="en_tramite">En trámite</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha de alta IMSS</Label>
                  <Input
                    type="date"
                    value={f.imss_fecha_alta ?? ""}
                    onChange={(e) => set("imss_fecha_alta", e.target.value || null)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>NSS</Label>
                  <Input
                    value={f.nss ?? ""}
                    onChange={(e) => set("nss", e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>SBC (Salario base cotización)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={f.imss_sbc ?? ""}
                    onChange={(e) =>
                      set("imss_sbc", e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </div>
                <div>
                  <Label>Tipo de trabajador</Label>
                  <Input
                    value={f.imss_tipo_trabajador ?? ""}
                    onChange={(e) => set("imss_tipo_trabajador", e.target.value)}
                  />
                </div>
              </div>
            </Section>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={pending}
            className="bg-[#0f1e3d] hover:bg-[#0f1e3d]/90"
          >
            {pending
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : canManage
                  ? "Crear trabajador"
                  : "Enviar solicitud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
