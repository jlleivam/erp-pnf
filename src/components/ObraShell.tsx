import { Link, Outlet, useParams } from "@tanstack/react-router";
import { ArrowLeft, LayoutGrid } from "lucide-react";

export function ObraShell() {
  const { obraId } = useParams({ strict: false }) as { obraId?: string };

  return (
    <div className="min-h-full bg-background flex flex-col">
      <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 md:hidden sticky top-0 z-10">
        <Link
          to="/app"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Obras
        </Link>
        {obraId && (
          <Link
            to="/app/obras/$obraId"
            params={{ obraId }}
            className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
            activeOptions={{ exact: true }}
            activeProps={{ className: "flex items-center gap-1.5 text-sm font-medium text-primary" }}
          >
            <LayoutGrid className="size-4" />
            Resumen
          </Link>
        )}
      </header>

      <main className="flex-1 p-4 md:p-0 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

