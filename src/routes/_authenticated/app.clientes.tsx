import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/clientes")({
  beforeLoad: () => {
    throw redirect({ to: "/app/catalogos/clientes" });
  },
});
