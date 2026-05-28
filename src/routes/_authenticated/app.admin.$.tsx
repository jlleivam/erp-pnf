import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { CatalogoInsumosModule } from "@/components/insumos/CatalogoInsumosModule";

const LABELS: Record<string, string> = {
  requisiciones: "Requisiciones",
  "cuentas-por-pagar": "Cuentas por pagar",
  tesoreria: "Tesorería",
  catalogos: "Catálogos",
  "almacen-central": "Almacén central",
  "gastos-oficina": "Gastos de oficina",
  nomina: "Nómina",
  destajos: "Destajos",
  subcontratos: "Subcontratos",
  rentas: "Rentas",
  gasolinas: "Gasolinas",
  "caja-chica": "Caja chica",
  tareas: "Tareas",
};

export const Route = createFileRoute("/_authenticated/app/admin/$")({
  component: AdminModule,
});

function AdminModule() {
  const { _splat } = Route.useParams();
  const slug = (_splat ?? "").split("/")[0];
  if (slug === "catalogos") return <CatalogoInsumosModule />;
  const title = LABELS[slug] ?? "Módulo administrativo";
  return <ModulePlaceholder title={title} description="Módulo administrativo" />;
}
