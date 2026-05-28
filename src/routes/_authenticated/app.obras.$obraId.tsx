import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getObraDashboard } from "@/lib/api/obras.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ObraShell } from "@/components/ObraShell";
import { Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/obras/$obraId")({
  component: ObraLayout,
});

function ObraLayout() {
  return <ObraShell />;
}

// Sub-route handled in separate files below
export { Outlet, Link, getObraDashboard, useServerFn, useQuery, Card, Badge };
