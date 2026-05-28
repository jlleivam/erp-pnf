import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { useAuthStore, isDirector } from "@/stores/auth";

const LABELS: Record<string, string> = {
  estimaciones: "Estimaciones",
  "ordenes-cambio": "Órdenes de cambio",
  requisiciones: "Requisiciones",
  nomina: "Nómina",
  destajos: "Destajos",
  subcontratos: "Subcontratos",
  rentas: "Rentas",
  gasolinas: "Gasolinas",
  "caja-chica": "Caja chica",
  "almacen-obra": "Almacén de obra",
  tareas: "Tareas",
  catalogos: "Catálogos",
};

export const Route = createFileRoute("/_authenticated/app/obras/$obraId/$")({
  component: ObraModule,
});

function ObraModule() {
  const { _splat } = Route.useParams();
  const roles = useAuthStore((s) => s.roles);
  const slug = (_splat ?? "").split("/")[0];
  const title = LABELS[slug] ?? "Módulo";
  const isAuxiliar = !isDirector(roles) && roles.includes("auxiliar");

  return (
    <ModulePlaceholder
      title={title}
      description="Módulo de obra"
      badge={isAuxiliar ? "Requiere VB Residente" : undefined}
    />
  );
}
