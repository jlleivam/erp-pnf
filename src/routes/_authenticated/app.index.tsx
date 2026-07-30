import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Panel general de la empresa.
        </p>
      </header>

      <Card className="p-12 text-center border-dashed">
        <LayoutDashboard className="size-8 mx-auto text-muted-foreground" />
        <p className="mt-3 font-medium">Próximamente</p>
        <p className="text-sm text-muted-foreground mt-1">
          Aquí se diseñará el tablero con los indicadores del negocio.
        </p>
      </Card>
    </div>
  );
}
