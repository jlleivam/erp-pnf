import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCompanyConfig, updateCompanyFacturacion } from "@/lib/api/company.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REGIMENES_MORAL, REGIMENES_FISICA } from "@/components/terceros/constants";

const ESTADOS_MX = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas",
  "Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México",
  "Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit",
  "Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí",
  "Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas",
];

type TipoPersona = "moral" | "fisica";

export function FacturacionTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchCfg = useServerFn(getCompanyConfig);
  const saveFn = useServerFn(updateCompanyFacturacion);

  const cfg = useQuery({ queryKey: ["company-config"], queryFn: () => fetchCfg() });

  const [f, setF] = useState({
    tipo_persona: "moral" as TipoPersona,
    razon_social: "",
    nombre_completo: "",
    rfc: "",
    curp: "",
    regimen_fiscal: "",
    calle: "",
    numero_exterior: "",
    numero_interior: "",
    colonia: "",
    municipio: "",
    estado: "",
    codigo_postal: "",
    registro_imss: "",
    registro_infonavit: "",
  });

  useEffect(() => {
    if (!cfg.data) return;
    setF({
      tipo_persona: (cfg.data.tipo_persona as TipoPersona) ?? "moral",
      razon_social: cfg.data.razon_social ?? "",
      nombre_completo: cfg.data.nombre_completo ?? "",
      rfc: cfg.data.rfc ?? "",
      curp: cfg.data.curp ?? "",
      regimen_fiscal: cfg.data.regimen_fiscal ?? "",
      calle: cfg.data.calle ?? "",
      numero_exterior: cfg.data.numero_exterior ?? "",
      numero_interior: cfg.data.numero_interior ?? "",
      colonia: cfg.data.colonia ?? "",
      municipio: cfg.data.municipio ?? "",
      estado: cfg.data.estado ?? "",
      codigo_postal: cfg.data.codigo_postal ?? "",
      registro_imss: cfg.data.registro_imss ?? "",
      registro_infonavit: cfg.data.registro_infonavit ?? "",
    });
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      toast.success("Datos actualizados");
      qc.invalidateQueries({ queryKey: ["company-config"] });
      navigate({ to: "/app" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  if (cfg.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const regimenes = f.tipo_persona === "moral" ? REGIMENES_MORAL : REGIMENES_FISICA;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          data: {
            tipo_persona: f.tipo_persona,
            razon_social: f.razon_social.trim(),
            nombre_completo: f.nombre_completo.trim() || null,
            rfc: f.rfc.trim().toUpperCase(),
            curp: f.tipo_persona === "fisica" ? f.curp.trim() || null : null,
            regimen_fiscal: f.regimen_fiscal || null,
            calle: f.calle.trim() || null,
            numero_exterior: f.numero_exterior.trim() || null,
            numero_interior: f.numero_interior.trim() || null,
            colonia: f.colonia.trim() || null,
            municipio: f.municipio.trim() || null,
            estado: f.estado.trim() || null,
            codigo_postal: f.codigo_postal.trim() || null,
            registro_imss: f.registro_imss.trim() || null,
            registro_infonavit: f.registro_infonavit.trim() || null,
          },
        });
      }}
    >
      <div>
        <Label>Tipo de persona</Label>
        <RadioGroup
          value={f.tipo_persona}
          onValueChange={(v) =>
            setF((p) => ({ ...p, tipo_persona: v as TipoPersona, regimen_fiscal: "" }))
          }
          className="flex gap-6 mt-2"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="moral" /> Persona moral
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="fisica" /> Persona física
          </label>
        </RadioGroup>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>{f.tipo_persona === "moral" ? "Razón social *" : "Nombre completo *"}</Label>
          <Input
            value={f.razon_social}
            onChange={(e) => set("razon_social", e.target.value)}
            required
          />
        </div>
        {f.tipo_persona === "moral" && (
          <div>
            <Label>Nombre comercial</Label>
            <Input
              value={f.nombre_completo}
              onChange={(e) => set("nombre_completo", e.target.value)}
            />
          </div>
        )}
        <div>
          <Label>RFC *</Label>
          <Input
            value={f.rfc}
            onChange={(e) => set("rfc", e.target.value.toUpperCase())}
            maxLength={13}
            required
          />
        </div>
        {f.tipo_persona === "fisica" && (
          <div>
            <Label>CURP</Label>
            <Input
              value={f.curp}
              onChange={(e) => set("curp", e.target.value.toUpperCase())}
              maxLength={18}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label>Régimen fiscal</Label>
          <Select value={f.regimen_fiscal} onValueChange={(v) => set("regimen_fiscal", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona régimen" /></SelectTrigger>
            <SelectContent>
              {regimenes.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-medium">Dirección fiscal</h3>
        <div className="grid sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <Label>Calle</Label>
            <Input value={f.calle} onChange={(e) => set("calle", e.target.value)} />
          </div>
          <div>
            <Label>Núm. exterior</Label>
            <Input value={f.numero_exterior} onChange={(e) => set("numero_exterior", e.target.value)} />
          </div>
          <div>
            <Label>Núm. interior</Label>
            <Input value={f.numero_interior} onChange={(e) => set("numero_interior", e.target.value)} />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Colonia</Label>
            <Input value={f.colonia} onChange={(e) => set("colonia", e.target.value)} />
          </div>
          <div>
            <Label>Municipio / Alcaldía</Label>
            <Input value={f.municipio} onChange={(e) => set("municipio", e.target.value)} />
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={f.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
              <SelectContent>
                {ESTADOS_MX.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Código postal</Label>
            <Input
              value={f.codigo_postal}
              onChange={(e) => set("codigo_postal", e.target.value)}
              maxLength={5}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-medium">Registros patronales</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Registro IMSS</Label>
            <Input value={f.registro_imss} onChange={(e) => set("registro_imss", e.target.value)} />
          </div>
          <div>
            <Label>Registro INFONAVIT</Label>
            <Input
              value={f.registro_infonavit}
              onChange={(e) => set("registro_infonavit", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
