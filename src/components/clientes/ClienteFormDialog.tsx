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
import { crearCliente, actualizarCliente } from "@/lib/api/clientes.functions";

export type ClienteFormInitial = {
  id?: string;
  tipo_persona: "moral" | "fisica";
  razon_social: string;
  rfc: string;
  regimen_fiscal?: string | null;
  direccion_fiscal?: string | null;
  telefono?: string | null;
  correo?: string | null;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  curp?: string | null;
  condiciones_pago?: number | null;
  limite_credito?: number | null;
  banco?: string | null;
  clabe?: string | null;
  beneficiario?: string | null;
};

const EMPTY: ClienteFormInitial = {
  tipo_persona: "moral",
  razon_social: "",
  rfc: "",
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

export function ClienteFormDialog({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ClienteFormInitial | null;
  onSaved?: (clienteId?: string) => void;
}) {
  const isEdit = !!initial?.id;
  const base: ClienteFormInitial = initial ?? EMPTY;

  const [f, setF] = useState<ClienteFormInitial>(base);
  const set = <K extends keyof ClienteFormInitial>(k: K, v: ClienteFormInitial[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const qc = useQueryClient();
  const create = useServerFn(crearCliente);
  const update = useServerFn(actualizarCliente);

  const createM = useMutation({
    mutationFn: create,
    onSuccess: (c) => {
      toast.success("Cliente creado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      onSaved?.(c?.id);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Cliente actualizado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cliente", initial?.id] });
      onSaved?.(initial?.id);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!f.razon_social.trim()) return toast.error("Razón social requerida");
    const rfc = f.rfc.trim().toUpperCase();
    const len = f.tipo_persona === "moral" ? 12 : 13;
    if (rfc.length !== len) {
      return toast.error(
        `RFC debe tener ${len} caracteres para persona ${f.tipo_persona === "moral" ? "moral" : "física"}`,
      );
    }
    if (f.clabe && !/^\d{18}$/.test(f.clabe)) {
      return toast.error("CLABE debe ser 18 dígitos numéricos");
    }

    const payload = {
      tipo_persona: f.tipo_persona,
      razon_social: f.razon_social.trim(),
      rfc,
      regimen_fiscal: f.regimen_fiscal?.trim() || null,
      direccion_fiscal: f.direccion_fiscal?.trim() || null,
      telefono: f.telefono?.trim() || null,
      correo: f.correo?.trim() || null,
      contacto_nombre: f.contacto_nombre?.trim() || null,
      contacto_telefono: f.contacto_telefono?.trim() || null,
      curp: f.curp?.trim().toUpperCase() || null,
      condiciones_pago:
        f.condiciones_pago == null || isNaN(Number(f.condiciones_pago))
          ? null
          : Number(f.condiciones_pago),
      limite_credito:
        f.limite_credito == null || isNaN(Number(f.limite_credito))
          ? null
          : Number(f.limite_credito),
      banco: f.banco?.trim() || null,
      clabe: f.clabe?.trim() || null,
      beneficiario: f.beneficiario?.trim() || null,
    };

    if (isEdit && initial?.id) {
      updateM.mutate({ data: { ...payload, id: initial.id } });
    } else {
      createM.mutate({ data: payload });
    }
  };

  const pending = createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            Captura los datos fiscales y comerciales. Los documentos se suben desde la ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <Section title="Identificación">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de persona</Label>
                <Select
                  value={f.tipo_persona}
                  onValueChange={(v) => set("tipo_persona", v as "moral" | "fisica")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moral">Persona moral</SelectItem>
                    <SelectItem value="fisica">Persona física</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>RFC</Label>
                <Input
                  value={f.rfc}
                  onChange={(e) => set("rfc", e.target.value.toUpperCase())}
                  maxLength={13}
                  className="font-mono uppercase"
                />
              </div>
            </div>
            <div>
              <Label>{f.tipo_persona === "moral" ? "Razón social" : "Nombre completo"}</Label>
              <Input
                value={f.razon_social}
                onChange={(e) => set("razon_social", e.target.value)}
              />
            </div>
            {f.tipo_persona === "fisica" && (
              <div>
                <Label>CURP</Label>
                <Input
                  value={f.curp ?? ""}
                  onChange={(e) => set("curp", e.target.value.toUpperCase())}
                  maxLength={18}
                  className="font-mono uppercase"
                />
              </div>
            )}
            <div>
              <Label>Régimen fiscal</Label>
              <Input
                value={f.regimen_fiscal ?? ""}
                onChange={(e) => set("regimen_fiscal", e.target.value)}
                placeholder="Ej. 601 — General de Ley Personas Morales"
              />
            </div>
          </Section>

          <Section title="Contacto">
            <div>
              <Label>Dirección fiscal</Label>
              <Input
                value={f.direccion_fiscal ?? ""}
                onChange={(e) => set("direccion_fiscal", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={f.telefono ?? ""}
                  onChange={(e) => set("telefono", e.target.value)}
                />
              </div>
              <div>
                <Label>Correo</Label>
                <Input
                  type="email"
                  value={f.correo ?? ""}
                  onChange={(e) => set("correo", e.target.value)}
                />
              </div>
            </div>
            {f.tipo_persona === "moral" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contacto principal</Label>
                  <Input
                    value={f.contacto_nombre ?? ""}
                    onChange={(e) => set("contacto_nombre", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Teléfono del contacto</Label>
                  <Input
                    value={f.contacto_telefono ?? ""}
                    onChange={(e) => set("contacto_telefono", e.target.value)}
                  />
                </div>
              </div>
            )}
          </Section>

          <Section title="Comercial">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Condiciones de pago (días)</Label>
                <Input
                  type="number"
                  min={0}
                  value={f.condiciones_pago ?? ""}
                  onChange={(e) =>
                    set(
                      "condiciones_pago",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </div>
              <div>
                <Label>Límite de crédito (MXN)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={f.limite_credito ?? ""}
                  onChange={(e) =>
                    set(
                      "limite_credito",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Banco</Label>
                <Input
                  value={f.banco ?? ""}
                  onChange={(e) => set("banco", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label>CLABE (18 dígitos)</Label>
                <Input
                  value={f.clabe ?? ""}
                  onChange={(e) => set("clabe", e.target.value.replace(/\D/g, ""))}
                  maxLength={18}
                  className="font-mono"
                />
              </div>
            </div>
            <div>
              <Label>Beneficiario</Label>
              <Input
                value={f.beneficiario ?? ""}
                onChange={(e) => set("beneficiario", e.target.value)}
              />
            </div>
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
