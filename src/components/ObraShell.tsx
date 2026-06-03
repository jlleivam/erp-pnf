import { Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function ObraShell() {
  return (
    <div className="min-h-full bg-background flex flex-col">
      <header className="h-12 border-b border-border bg-card flex items-center px-4 md:hidden sticky top-0 z-10">
        <Link
          to="/app"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Obras
        </Link>
      </header>

      <main className="flex-1 p-4 md:p-0 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
