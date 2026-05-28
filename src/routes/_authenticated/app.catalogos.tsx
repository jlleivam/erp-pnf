import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SECTIONS = [
  { slug: "clientes", label: "Clientes", to: "/app/catalogos/clientes" as const },
  { slug: "insumos", label: "Insumos", to: "/app/catalogos/insumos" as const },
  { slug: "trabajadores", label: "Trabajadores", to: "/app/catalogos/trabajadores" as const },
  { slug: "proveedores", label: "Proveedores", to: "/app/catalogos/proveedores" as const },
  { slug: "subcontratistas", label: "Subcontratistas", to: "/app/catalogos/subcontratistas" as const },
];

export const Route = createFileRoute("/_authenticated/app/catalogos")({
  component: CatalogosLayout,
});

function CatalogosLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const active =
    SECTIONS.find((s) => pathname.startsWith(s.to))?.slug ?? "clientes";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Información maestra que se reutiliza en obras, compras y nómina.
        </p>
      </div>

      {/* Desktop tabs */}
      <div className="hidden md:flex border-b border-border gap-1">
        {SECTIONS.map((s) => {
          const isActive = active === s.slug;
          return (
            <Link
              key={s.slug}
              to={s.to}
              className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-[#0f1e3d] text-[#0f1e3d]"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile selector */}
      <div className="md:hidden">
        <Select
          value={active}
          onValueChange={(slug) => {
            const target = SECTIONS.find((s) => s.slug === slug);
            if (target) navigate({ to: target.to });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTIONS.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Outlet />
    </div>
  );
}
