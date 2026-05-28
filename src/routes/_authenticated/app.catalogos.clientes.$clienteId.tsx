import { createFileRoute } from "@tanstack/react-router";
import { CatalogoClientesModule } from "@/components/clientes/CatalogoClientesModule";

export const Route = createFileRoute("/_authenticated/app/catalogos/clientes/$clienteId")({
  component: ClienteDeepLink,
});

function ClienteDeepLink() {
  const { clienteId } = Route.useParams();
  return <CatalogoClientesModule initialClienteId={clienteId} />;
}
