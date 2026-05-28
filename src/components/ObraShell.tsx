import { Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, LayoutGrid, ListChecks, Package, Receipt } from "lucide-react";

const QUICK_NAV = [
  { to: "", label: "Resumen", icon: LayoutGrid },
  { to: "/estimaciones", label: "Estimaciones", icon: Receipt },
  { to: "/tareas", label: "Tareas", icon: ListChecks },
  { to: "/almacen-obra", label: "Almacén", icon: Package },
] as const;

export function ObraShell() {
  const { obraId } = useParams({ strict: false }) as { obraId: string };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/app/obras/${obraId}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 sticky top-0 z-10">
        <Link
          to="/app"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Obras
        </Link>
      </header>

      <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-card border-t border-border flex items-stretch z-20">
        {QUICK_NAV.map((item) => {
          const href = `${base}${item.to}`;
          const active = item.to === "" ? pathname === base : pathname.startsWith(href);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-xs ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
