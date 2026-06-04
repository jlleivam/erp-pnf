import { useState } from "react";
import { Link, Outlet, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCompanyConfig, getCompanyLogoSignedUrl } from "@/lib/api/company.functions";
import {
  Building2,
  LayoutDashboard,
  BookOpen,
  Settings,
  LogOut,
  ChevronDown,
  HardHat,

  ShieldCheck,
  Receipt,
  ClipboardList,
  Users,
  Hammer,
  Handshake,
  Warehouse,
  Truck,
  Fuel,
  Coins,
  ListTodo,
  BarChart3,
} from "lucide-react";
import { useAuthStore, useEffectiveRoles, useEffectiveIsDirector, useRealIsDirector, type AppRole } from "@/stores/auth";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { NotificacionesBell } from "@/components/NotificacionesBell";
import { MobileBottomBar, type BottomBarItem } from "@/components/MobileBottomBar";



const ROLE_LABELS: Record<AppRole, string> = {
  director: "Director",
  residente: "Residente",
  auxiliar: "Auxiliar",
  administrativo: "Administrativo",
  supervisor: "Supervisor",
};


export function AppShell() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const assumedRole = useAuthStore((s) => s.assumedRole);
  const setAssumedRole = useAuthStore((s) => s.setAssumedRole);
  const reset = useAuthStore((s) => s.reset);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = useParams({ strict: false }) as { obraId?: string };
  const obraId = params.obraId;
  const isInsideObra = Boolean(obraId) && pathname.startsWith(`/app/obras/${obraId}`);
  const [mobileOpen, setMobileOpen] = useState(false);


  const realDirector = useRealIsDirector();
  const effRoles = useEffectiveRoles();
  const director = useEffectiveIsDirector();
  const showAdmin = director || effRoles.includes("administrativo");
  const showSupervisor = director || effRoles.includes("supervisor");


  const switchRole = (role: AppRole | null) => {
    setAssumedRole(role);
    navigate({ to: "/app" });
  };

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

  const sidebarBranding = (
    <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
      <div className="size-8 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-semibold">
        P
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">ERP PNF</p>
        <p className="text-xs text-sidebar-foreground/60 leading-tight">Constructoras</p>
      </div>
    </div>
  );

  const obraNavItems: BottomBarItem[] = obraId
    ? [
        { to: `/app/obras/${obraId}/presupuesto`, label: "Presupuesto", icon: Receipt },
        { to: `/app/obras/${obraId}/estimaciones`, label: "Estimaciones", icon: BarChart3 },
        { to: `/app/obras/${obraId}/requisiciones`, label: "Requisiciones", icon: ClipboardList },
        { to: `/app/obras/${obraId}/nomina`, label: "Nómina", icon: Users },
        { to: `/app/obras/${obraId}/destajos`, label: "Destajos", icon: Hammer },
        { to: `/app/obras/${obraId}/subcontratos`, label: "Subcontratos", icon: Handshake },
        { to: `/app/obras/${obraId}/almacen-obra`, label: "Almacén", icon: Warehouse },
        { to: `/app/obras/${obraId}/rentas`, label: "Rentas", icon: Truck },
        { to: `/app/obras/${obraId}/gasolinas`, label: "Gasolinas", icon: Fuel },
        { to: `/app/obras/${obraId}/caja-chica`, label: "Caja chica", icon: Coins },
        { to: `/app/obras/${obraId}/tareas`, label: "Tareas", icon: ListTodo },
      ]
    : [];

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
      {isInsideObra && obraNavItems.length > 0 && (
        <div>
          <p className="px-3 mb-2 text-xs uppercase tracking-wider text-sidebar-foreground/50">
            Obra
          </p>
          {obraNavItems.map((m) => {
            const Icon = m.icon;
            return (
              <NavItem
                key={m.to}
                to={m.to}
                label={m.label}
                icon={<Icon className="size-4" />}
                active={pathname === m.to || pathname.startsWith(m.to + "/")}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      )}

      <div>
        <p className="px-3 mb-2 text-xs uppercase tracking-wider text-sidebar-foreground/50">
          Corporativo
        </p>
        <NavItem to="/app" label="Dashboard" icon={<LayoutDashboard className="size-4" />} active={pathname === "/app"} onNavigate={onNavigate} />
        <NavItem to="/app/catalogos" label="Catálogos" icon={<BookOpen className="size-4" />} active={pathname.startsWith("/app/catalogos")} onNavigate={onNavigate} />
        {director && (
          <NavItem to="/app/obras/nueva" label="Nueva obra" icon={<HardHat className="size-4" />} active={pathname === "/app/obras/nueva"} onNavigate={onNavigate} />
        )}
        {director && (
          <NavItem to="/app/configuracion" label="Configuración" icon={<Settings className="size-4" />} active={pathname.startsWith("/app/configuracion")} onNavigate={onNavigate} />
        )}
      </div>


      {showSupervisor && (
        <div>
          <p className="px-3 mb-2 text-xs uppercase tracking-wider text-sidebar-foreground/50">
            Supervisión
          </p>
          <NavItem
            to="/app/supervisor/requisiciones"
            label="Por autorizar"
            icon={<ShieldCheck className="size-4" />}
            active={pathname.startsWith("/app/supervisor/requisiciones")}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {showAdmin && (
        <div>
          <p className="px-3 mb-2 text-xs uppercase tracking-wider text-sidebar-foreground/50">
            Administración
          </p>
          {ADMIN_MODULES.map((m) => (
            <NavItem key={m.to} to={m.to} label={m.label} active={pathname === m.to} onNavigate={onNavigate} />
          ))}
        </div>
      )}

    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 flex-col bg-sidebar text-sidebar-foreground">
        {sidebarBranding}
        {renderNav()}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Link to="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Building2 className="size-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">ERP PNF</span>
            </Link>
          </div>


          <div className="flex items-center gap-3">
            <NotificacionesBell />





            {realDirector && (
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
                  <DropdownMenuItem onClick={() => switchRole(null)}>
                    Director (mi rol)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => switchRole("residente")}>
                    Residente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => switchRole("administrativo")}>
                    Administrativo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => switchRole("supervisor")}>
                    Supervisor
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => switchRole("auxiliar")}>
                    Auxiliar
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

        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom bar móvil (contextual) */}
      {isInsideObra && obraId ? (
        <MobileBottomBar
          pathname={pathname}
          variant="scroll"
          items={obraNavItems}
        />
      ) : (
        <MobileBottomBar
          pathname={pathname}
          items={[
            { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
            { to: "/app/catalogos", label: "Catálogos", icon: BookOpen },
            ...(director
              ? [{ to: "/app/configuracion", label: "Config", icon: Settings }]
              : []),
          ] satisfies BottomBarItem[]}
          onMoreClick={() => setMobileOpen(true)}
        />
      )}


      {/* Sheet con menú completo (se abre desde "Más") */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col"
        >
          {sidebarBranding}
          {renderNav(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>
    </div>
  );

}

function NavItem({
  to,
  label,
  icon,
  active,
  onNavigate,
}: {
  to: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
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
