import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/app/catalogos/proveedores")({
  component: () => (
    <ModulePlaceholder
      title="Proveedores"
      description="Catálogo de proveedores (próximamente)."
    />
  ),
});
