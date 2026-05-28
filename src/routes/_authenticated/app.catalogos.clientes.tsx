import { createFileRoute } from "@tanstack/react-router";
import { CatalogoClientesModule } from "@/components/clientes/CatalogoClientesModule";

export const Route = createFileRoute("/_authenticated/app/catalogos/clientes")({
  component: () => <CatalogoClientesModule />,
});
