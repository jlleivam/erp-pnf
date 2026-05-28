import { createFileRoute } from "@tanstack/react-router";
import { CatalogoTerceroModule } from "@/components/terceros/CatalogoTerceroModule";

export const Route = createFileRoute("/_authenticated/app/catalogos/proveedores")({
  component: CatalogoTerceroModule,
});
