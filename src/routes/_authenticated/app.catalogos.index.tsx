import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/catalogos/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/catalogos/clientes" });
  },
});
