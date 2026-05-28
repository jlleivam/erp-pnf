import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/app/catalogos/subcontratistas")({
  component: () => (
    <ModulePlaceholder
      title="Subcontratistas"
      description="Catálogo de subcontratistas (próximamente)."
    />
  ),
});
