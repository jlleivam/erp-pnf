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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  crearTercero,
  actualizarTercero,
} from "@/lib/api/terceros.functions";
import {
  CATEGORIAS,
  REGIMENES_FISICA,
  REGIMENES_MORAL,
  type TerceroCategoria,
  type TipoPersona,
} from "./constants";
import { ESTADOS_MX } from "@/lib/mx-estados";

export type TerceroFormInitial = {
  id?: string;
  tipo_persona: TipoPersona;
  razon_social: string;
  rfc: string;
  curp?: string | null;
  regimen_fiscal?: string | null;
  calle?: string | null;
  numero_exterior?: string | null;
  numero_interior?: string | null;
  colonia?: string | null;
  municipio?: string | null;
  estado?: string | null;
  codigo_postal?: string | null;
  telefono?: string | null;
  correo?: string | null;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  categoria: TerceroCategoria;
  categoria_productos?: string | null;
  credito_disponible?: number | null;
  dias_credito?: number | null;
  requiere_factura?: boolean;
  banco?: string | null;
  clabe?: string | null;
  beneficiario?: string | null;
  retencion_iva?: boolean;
  retencion_iva_pct?: number | null;
  retencion_isr?: boolean;
  retencion_isr_pct?: number | null;
  tipo_trabajos?: string | null;
  fondo_garantia?: boolean;
  fondo_garantia_pct?: number | null;
  disponible_renta?: boolean;
};

const EMPTY: TerceroFormInitial = {
  tipo_persona: "moral",
  razon_social: "",
  rfc: "",
  categoria: "proveedor",
  requiere_factura: true,
  retencion_iva: false,
  retencion_isr: false,
  fondo_garantia: false,
  disponible_renta: false,
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

export function TerceroFormDialog({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: TerceroFormInitial | null;
  onSaved?: (id?: string) => void;
}) {
  const isEdit = !!initial?.id;
  const base: TerceroFormInitial = initial ?? EMPTY;

  const [f, setF] = useState<TerceroFormInitial>(base);
  const set = <K extends keyof TerceroFormInitial>(
    k: K,
    v: TerceroFormInitial[K],
  ) => setF((p) => ({ ...p, [k]: v }));

  const qc = useQueryClient();
  const create = useServerFn(crearTercero);
  const update = useServerFn(actualizarTercero);

  const createM = useMutation({
    mutationFn: create,
    onSuccess: (t) => {
      toast.success("Creado");
      qc.invalidateQueries({ queryKey: ["terceros"] });
      onSaved?.(t?.id);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => {
      toast.success("Actualizado");
      qc.invalidateQueries({ queryKey: ["terceros"] });
      qc.invalidateQueries({ queryKey: ["tercero", initial?.id] });
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

    const numOrNull = (v: number | null | undefined) =>
      v == null || isNaN(Number(v)) ? null : Number(v);

    const payload = {
      tipo_persona: f.tipo_persona,
      razon_social: f.razon_social.trim(),
      rfc,
      curp: f.curp?.trim().toUpperCase() || null,
      regimen_fiscal: f.regimen_fiscal?.trim() || null,
      calle: f.calle?.trim() || null,
      numero_exterior: f.numero_exterior?.trim() || null,
      numero_interior: f.numero_interior?.trim() || null,
      colonia: f.colonia?.trim() || null,
      municipio: f.municipio?.trim() || null,
      estado: f.estado?.trim() || null,
      codigo_postal: f.codigo_postal?.trim() || null,
      telefono: f.telefono?.trim() || null,
      correo: f.correo?.trim() || null,
      contacto_nombre: f.contacto_nombre?.trim() || null,
      contacto_telefono: f.contacto_telefono?.trim() || null,
      categoria: f.categoria,
      categoria_productos: f.categoria_productos?.trim() || null,
      credito_disponible: numOrNull(f.credito_disponible),
      dias_credito: numOrNull(f.dias_credito),
      requiere_factura: !!f.requiere_factura,
      banco: f.banco?.trim() || null,
      clabe: f.clabe?.trim() || null,
      beneficiario: f.beneficiario?.trim() || null,
      retencion_iva: !!f.retencion_iva,
      retencion_iva_pct: numOrNull(f.retencion_iva_pct),
      retencion_isr: !!f.retencion_isr,
      retencion_isr_pct: numOrNull(f.retencion_isr_pct),
      tipo_trabajos: f.tipo_trabajos?.trim() || null,
      fondo_garantia: !!f.fondo_garantia,
      fondo_garantia_pct: numOrNull(f.fondo_garantia_pct),
      disponible_renta: !!f.disponible_renta,
    };

    if (isEdit && initial?.id) {
      updateM.mutate({ data: { ...payload, id: initial.id } });
    } else {
      createM.mutate({ data: payload });
    }
  };

  const pending = createM.isPending || updateM.isPending;
  const showProveedor = f.categoria === "proveedor" || f.categoria === "ambos";
  const showContratista = f.categoria === "contratista" || f.categoria === "ambos";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar tercero" : "Nuevo proveedor / contratista"}
          </DialogTitle>
          <DialogDescription>
            Captura los datos fiscales y comerciales. Los documentos se suben desde la ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <Section title="Categoría">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoría</Label>
                <Select
                  value={f.categoria}
                  onValueChange={(v) => set("categoria", v as TerceroCategoria)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de persona</Label>
                <Select
                  value={f.tipo_persona}
                  onValueChange={(v) => {
                    const next = v as TipoPersona;
                    setF((p) => ({
                      ...p,
                      tipo_persona: next,
                      regimen_fiscal:
                        p.tipo_persona === next ? p.regimen_fiscal : null,
                    }));
                  }}
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
            </div>
            {showProveedor && (
              <>
                <div>
                  <Label>Categoría de productos / servicios</Label>
                  <Input
                    value={f.categoria_productos ?? ""}
                    onChange={(e) => set("categoria_productos", e.target.value)}
                    placeholder="Ej. Materiales eléctricos, herramienta…"
                  />
                </div>
                <div className="flex items-start gap-3">
                  <Switch
                    checked={!!f.disponible_renta}
                    onCheckedChange={(v) => set("disponible_renta", v)}
                  />
                  <div>
                    <Label>Disponible para rentas</Label>
                    <p className="text-xs text-muted-foreground">
                      Si se activa, este proveedor podrá seleccionarse al cotizar rentas.
                    </p>
                  </div>
                </div>
              </>
            )}
          </Section>

          <Section title="Identificación">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RFC</Label>
                <Input
                  value={f.rfc}
                  onChange={(e) => set("rfc", e.target.value.toUpperCase())}
                  maxLength={13}
                  className="font-mono uppercase"
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
            </div>
            <div>
              <Label>
                {f.tipo_persona === "moral" ? "Razón social" : "Nombre completo"}
              </Label>
              <Input
                value={f.razon_social}
                onChange={(e) => set("razon_social", e.target.value)}
              />
            </div>
            <div>
              <Label>Régimen fiscal</Label>
              <Select
                value={f.regimen_fiscal ?? ""}
                onValueChange={(v) => set("regimen_fiscal", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un régimen fiscal" />
                </SelectTrigger>
                <SelectContent>
                  {(f.tipo_persona === "moral" ? REGIMENES_MORAL : REGIMENES_FISICA).map(
                    (r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section title="Dirección fiscal">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <Label>Calle</Label>
                <Input
                  value={f.calle ?? ""}
                  onChange={(e) => set("calle", e.target.value)}
                />
              </div>
              <div>
                <Label>Núm. exterior</Label>
                <Input
                  value={f.numero_exterior ?? ""}
                  onChange={(e) => set("numero_exterior", e.target.value)}
                />
              </div>
              <div>
                <Label>Núm. interior</Label>
                <Input
                  value={f.numero_interior ?? ""}
                  onChange={(e) => set("numero_interior", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Colonia</Label>
                <Input
                  value={f.colonia ?? ""}
                  onChange={(e) => set("colonia", e.target.value)}
                />
              </div>
              <div>
                <Label>Municipio / Alcaldía</Label>
                <Input
                  value={f.municipio ?? ""}
                  onChange={(e) => set("municipio", e.target.value)}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Select
                  value={f.estado ?? ""}
                  onValueChange={(v) => set("estado", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_MX.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Código postal</Label>
                <Input
                  value={f.codigo_postal ?? ""}
                  onChange={(e) =>
                    set("codigo_postal", e.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                  maxLength={5}
                  inputMode="numeric"
                />
              </div>
            </div>
          </Section>

          <Section title="Contacto">
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
                <Label>Días de crédito</Label>
                <Input
                  type="number"
                  min={0}
                  value={f.dias_credito ?? ""}
                  onChange={(e) =>
                    set(
                      "dias_credito",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </div>
              <div>
                <Label>Crédito disponible (MXN)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={f.credito_disponible ?? ""}
                  onChange={(e) =>
                    set(
                      "credito_disponible",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={!!f.requiere_factura}
                onCheckedChange={(v) => set("requiere_factura", v)}
              />
              <Label>Requiere factura</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!f.retencion_iva}
                  onCheckedChange={(v) => set("retencion_iva", v)}
                />
                <Label>Retención IVA</Label>
                {f.retencion_iva && (
                  <Input
                    type="number"
                    className="w-24"
                    placeholder="%"
                    value={f.retencion_iva_pct ?? ""}
                    onChange={(e) =>
                      set(
                        "retencion_iva_pct",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!f.retencion_isr}
                  onCheckedChange={(v) => set("retencion_isr", v)}
                />
                <Label>Retención ISR</Label>
                {f.retencion_isr && (
                  <Input
                    type="number"
                    className="w-24"
                    placeholder="%"
                    value={f.retencion_isr_pct ?? ""}
                    onChange={(e) =>
                      set(
                        "retencion_isr_pct",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                )}
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

          {showContratista && (
            <Section title="Contratista">
              <div>
                <Label>Tipo de trabajos que realiza</Label>
                <Input
                  value={f.tipo_trabajos ?? ""}
                  onChange={(e) => set("tipo_trabajos", e.target.value)}
                  placeholder="Ej. Albañilería, instalación eléctrica…"
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!f.fondo_garantia}
                  onCheckedChange={(v) => set("fondo_garantia", v)}
                />
                <Label>Fondo de garantía</Label>
                {f.fondo_garantia && (
                  <Input
                    type="number"
                    className="w-24"
                    placeholder="%"
                    value={f.fondo_garantia_pct ?? ""}
                    onChange={(e) =>
                      set(
                        "fondo_garantia_pct",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                )}
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
            {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
