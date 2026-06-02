import { createFileRoute } from "@tanstack/react-router";
import { EquipoModule } from "@/components/equipo/EquipoModule";

export const Route = createFileRoute("/_authenticated/app/equipo")({
  component: EquipoPage,
});

function EquipoPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestión de usuarios de la empresa y sus roles.
        </p>
      </header>
      <EquipoModule />
    </div>
  );
}
