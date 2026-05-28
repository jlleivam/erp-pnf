import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/app/catalogos/trabajadores")({
  component: () => (
    <ModulePlaceholder
      title="Trabajadores"
      description="Catálogo de trabajadores (próximamente)."
    />
  ),
});
