import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/app/obras/nueva")({
  component: () => (
    <ModulePlaceholder
      title="Nueva obra"
      description="Stepper de 3 pasos: datos generales, presupuesto y equipo"
    />
  ),
});
