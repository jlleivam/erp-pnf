import { createFileRoute } from "@tanstack/react-router";
import { CatalogoTrabajadoresModule } from "@/components/trabajadores/CatalogoTrabajadoresModule";

export const Route = createFileRoute("/_authenticated/app/catalogos/trabajadores")({
  component: CatalogoTrabajadoresModule,
});
