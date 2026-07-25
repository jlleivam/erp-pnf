import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CatalogoClientesModule } from "@/components/clientes/CatalogoClientesModule";

const searchSchema = z.object({
  tab: z.enum(["todos", "pendientes"]).optional(),
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/app/catalogos/clientes")({
  validateSearch: searchSchema,
  component: () => <CatalogoClientesModule />,
});
