import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CatalogoTerceroModule } from "@/components/terceros/CatalogoTerceroModule";

const searchSchema = z.object({
  tab: z.enum(["todos", "pendientes"]).optional(),
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/app/catalogos/proveedores")({
  validateSearch: searchSchema,
  component: CatalogoTerceroModule,
});
