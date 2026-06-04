import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCompanyConfig, updateCompanyConfig } from "@/lib/api/company.functions";
import { Button } from "@/components/ui/button";
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

export function ConfiguracionTab() {
  const qc = useQueryClient();
  const fetchCfg = useServerFn(getCompanyConfig);
  const saveFn = useServerFn(updateCompanyConfig);

  const cfg = useQuery({ queryKey: ["company-config"], queryFn: () => fetchCfg() });

  const [moneda, setMoneda] = useState("MXN");
  const [zona, setZona] = useState("America/Mexico_City");

  useEffect(() => {
    if (!cfg.data) return;
    setMoneda(cfg.data.moneda ?? "MXN");
    setZona(cfg.data.zona_horaria ?? "America/Mexico_City");
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      toast.success("Configuración actualizada");
      qc.invalidateQueries({ queryKey: ["company-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        <div className="flex justify-end">
          <Button
            onClick={() => save.mutate({ data: { moneda, zona_horaria: zona } })}
            disabled={save.isPending}
          >
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h3 className="text-sm font-medium">Unidades de negocio</h3>
        <UnidadesNegocioManager />
      </section>
    </div>
  );
}
