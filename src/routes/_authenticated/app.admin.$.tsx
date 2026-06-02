import { createFileRoute, redirect } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { NominaAdminPanel } from "@/components/nomina/NominaAdminPanel";

const LABELS: Record<string, string> = {
  requisiciones: "Requisiciones",
  "cuentas-por-pagar": "Cuentas por pagar",
  tesoreria: "Tesorería",
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
  beforeLoad: ({ params }) => {
    const slug = (params._splat ?? "").split("/")[0];
    if (slug === "catalogos") {
      throw redirect({ to: "/app/catalogos" });
    }
  },
  component: AdminModule,
});

function AdminModule() {
  const { _splat } = Route.useParams();
  const slug = (_splat ?? "").split("/")[0];
  if (slug === "nomina") return <NominaAdminPanel />;
  const title = LABELS[slug] ?? "Módulo administrativo";
  return <ModulePlaceholder title={title} description="Módulo administrativo" />;
}
