import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  component: () => (
    <ModulePlaceholder title="Clientes" description="Listado y alta de clientes de la empresa" />
  ),
});
