import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CatalogoTrabajadoresModule } from "@/components/trabajadores/CatalogoTrabajadoresModule";

const searchSchema = z.object({
  tab: z.enum(["todos", "pendientes"]).optional(),
  id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/app/catalogos/trabajadores")({
  validateSearch: searchSchema,
  component: CatalogoTrabajadoresModule,
});
