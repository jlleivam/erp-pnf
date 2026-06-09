import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getCompanyConfig,
  updateCompanyConfig,
  updateCompanyCapitalSocial,
} from "@/lib/api/company.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UnidadesNegocioManager } from "./UnidadesNegocioManager";

const MONEDAS = [
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "USD", label: "USD — Dólar estadounidense" },
  { value: "EUR", label: "EUR — Euro" },
];

const ZONAS = [
  "America/Mexico_City",
  "America/Tijuana",
  "America/Cancun",
  "America/Chihuahua",
  "America/Monterrey",
];

export type ConfiguracionTabHandle = { submit: () => void; isSaving: boolean };

export const ConfiguracionTab = forwardRef<ConfiguracionTabHandle>(function ConfiguracionTab(_, ref) {
  const qc = useQueryClient();
  const fetchCfg = useServerFn(getCompanyConfig);
  const saveFn = useServerFn(updateCompanyConfig);
  const saveCapital = useServerFn(updateCompanyCapitalSocial);

  const cfg = useQuery({ queryKey: ["company-config"], queryFn: () => fetchCfg() });

  const [moneda, setMoneda] = useState("MXN");
  const [zona, setZona] = useState("America/Mexico_City");
  const [capital, setCapital] = useState<string>("0");

  useEffect(() => {
    if (!cfg.data) return;
    setMoneda(cfg.data.moneda ?? "MXN");
    setZona(cfg.data.zona_horaria ?? "America/Mexico_City");
    setCapital(String((cfg.data as any).capital_social ?? 0));
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: async () => {
      const capitalNum = Number(capital);
      if (!Number.isFinite(capitalNum) || capitalNum < 0) {
        throw new Error("Capital social inválido");
      }
      const initialCapital = Number((cfg.data as any)?.capital_social ?? 0);
      await Promise.all([
        saveFn({ data: { moneda, zona_horaria: zona } }),
        capitalNum !== initialCapital
          ? saveCapital({ data: { capital_social: capitalNum } })
          : Promise.resolve(),
      ]);
    },
    onSuccess: () => {
      toast.success("Configuración actualizada");
      qc.invalidateQueries({ queryKey: ["company-config"] });
      qc.invalidateQueries({ queryKey: ["balance-general"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useImperativeHandle(ref, () => ({
    submit: () => save.mutate(),
    isSaving: save.isPending,
  }), [save]);

  if (cfg.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-medium">General</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Moneda</Label>
            <Select value={moneda} onValueChange={setMoneda}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONEDAS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zona horaria</Label>
            <Select value={zona} onValueChange={setZona}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ZONAS.map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h3 className="text-sm font-medium">Contabilidad</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Capital social (MXN)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Aportación inicial de los socios. Se usa como base del Balance General.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h3 className="text-sm font-medium">Unidades de negocio</h3>
        <UnidadesNegocioManager />
      </section>
    </div>
  );
});
