import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Building2, LayoutDashboard, Users, Settings, LogOut, ChevronDown, HardHat, UserCog } from "lucide-react";
import { useAuthStore, isDirector, type AppRole } from "@/stores/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ADMIN_MODULES } from "@/lib/modules";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABELS: Record<AppRole, string> = {
  director: "Director",
  residente: "Residente",
  auxiliar: "Auxiliar",
  administrativo: "Administrativo",
  supervisor: "Supervisor",
};


export function AppShell() {
  const navigate = useNavigate();
  const { profile, roles, assumedRole, setAssumedRole, reset } = useAuthStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const director = isDirector(roles);
  const showAdmin = director || roles.includes("administrativo");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    reset();
    navigate({ to: "/login" });
  };

  const initials =
    profile?.nombre_completo
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "U";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <div className="size-8 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-semibold">
            P
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">ERP PNF</p>
            <p className="text-xs text-sidebar-foreground/60 leading-tight">Constructoras</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          <div>
            <p className="px-3 mb-2 text-xs uppercase tracking-wider text-sidebar-foreground/50">
              Corporativo
            </p>
            <NavItem to="/app" exact label="Dashboard" icon={<LayoutDashboard className="size-4" />} active={pathname === "/app"} />
            <NavItem to="/app/clientes" label="Clientes" icon={<Users className="size-4" />} active={pathname.startsWith("/app/clientes")} />
            {director && (
              <NavItem
                to="/app/equipo"
                label="Equipo"
                icon={<UserCog className="size-4" />}
                active={pathname.startsWith("/app/equipo")}
              />
            )}
            {director && (
              <NavItem
                to="/app/obras/nueva"
                label="Nueva obra"
                icon={<HardHat className="size-4" />}
                active={pathname === "/app/obras/nueva"}
              />
            )}
            <NavItem
              to="/app/configuracion"
              label="Configuración"
              icon={<Settings className="size-4" />}
              active={pathname.startsWith("/app/configuracion")}
            />
          </div>

          {showAdmin && (
            <div>
              <p className="px-3 mb-2 text-xs uppercase tracking-wider text-sidebar-foreground/50">
                Administración
              </p>
              {ADMIN_MODULES.map((m) => (
                <NavItem
                  key={m.to}
                  to={m.to}
                  label={m.label}
                  active={pathname === m.to}
                />
              ))}
            </div>
          )}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6">
          <Link to="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Building2 className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">ERP PNF</span>
          </Link>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-2" title="Configuración de la empresa">
              <Link to="/app/configuracion">
                <Settings className="size-4" />
                <span className="hidden sm:inline">Configuración</span>
              </Link>
            </Button>


            {director && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    Vista: {assumedRole ? ROLE_LABELS[assumedRole] : "Director"}
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Asumir rol</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setAssumedRole(null)}>
                    Director (mi rol)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAssumedRole("residente")}>
                    Residente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAssumedRole("administrativo")}>
                    Administrativo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAssumedRole("supervisor")}>
                    Supervisor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{profile?.nombre_completo}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{profile?.nombre_completo}</span>
                    <span className="text-xs text-muted-foreground">{profile?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="size-4 mr-2" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}
