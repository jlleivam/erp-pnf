import { createFileRoute } from "@tanstack/react-router";
import { CatalogoInsumosModule } from "@/components/insumos/CatalogoInsumosModule";

export const Route = createFileRoute("/_authenticated/app/catalogos/insumos")({
  component: () => <CatalogoInsumosModule />,
});
