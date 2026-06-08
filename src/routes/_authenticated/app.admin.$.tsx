import { createFileRoute, redirect } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { NominaAdminPanel } from "@/components/nomina/NominaAdminPanel";
import { GasolinasModule } from "@/components/gasolinas/GasolinasModule";
import { CajaChicaModule } from "@/components/caja-chica/CajaChicaModule";
import { CuentasPorPagarModule } from "@/components/pagos/CuentasPorPagarModule";
import { TesoreriaModule } from "@/components/tesoreria/TesoreriaModule";
import { useEffectiveRoles } from "@/stores/auth";

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
  const roles = useEffectiveRoles();
  if (slug === "nomina") return <NominaAdminPanel />;
  if (slug === "gasolinas") return <GasolinasModule scope="admin" />;
  if (slug === "caja-chica") return <CajaChicaModule scope="admin" />;
  if (slug === "cuentas-por-pagar") return <CuentasPorPagarModule />;
  if (slug === "tesoreria") {
    if (!roles.includes("director") && !roles.includes("administrativo")) {
      return (
        <ModulePlaceholder
          title="Tesorería"
          description="No tienes permisos para ver este módulo."
        />
      );
    }
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Tesorería</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cuentas activas de la empresa, saldos y movimientos.
          </p>
        </header>
        <TesoreriaModule />
      </div>
    );
  }
  const title = LABELS[slug] ?? "Módulo administrativo";
  return <ModulePlaceholder title={title} description="Módulo administrativo" />;
}

