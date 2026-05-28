import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Users, Wallet, ClipboardList, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ERP PNF — ERP para empresas constructoras" },
      {
        name: "description",
        content:
          "Plataforma integral en español para gestionar obras, equipo, presupuestos, requisiciones, nómina y tesorería de empresas constructoras.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-semibold">
              P
            </div>
            <span className="font-semibold text-foreground">ERP PNF</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/onboarding">Registra tu usuario</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
          <p className="text-sm font-medium text-primary mb-4">
            ERP para empresas constructoras
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-foreground max-w-3xl mx-auto">
            Tu obra, tu equipo y tus finanzas en un mismo lugar.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Centraliza estimaciones, requisiciones, nómina, destajos, tesorería y caja chica.
            Roles definidos para Director, Residente, Auxiliar, Administrativo y Supervisor.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/onboarding">
                Registra tu usuario
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Building2, title: "Gestión de obras", desc: "Industrial, comercial, residencial, infraestructura, vivienda en serie y urbanización." },
            { icon: Users, title: "Perfiles y permisos", desc: "Cinco perfiles operativos con accesos y vistos buenos diferenciados." },
            { icon: Wallet, title: "Finanzas en obra", desc: "Caja chica, gasolinas, rentas, destajos, subcontratos y comisiones." },
            { icon: ClipboardList, title: "Estimaciones y órdenes", desc: "Estimaciones y órdenes de cambio con flujo de aprobación." },
            { icon: ShieldCheck, title: "Visto bueno del Supervisor", desc: "Nada se paga ni se ejecuta sin el filtro del Supervisor." },
            { icon: Building2, title: "Multi-empresa", desc: "Cada empresa con su propio equipo, clientes y obras aisladas." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-5">
              <f.icon className="size-5 text-primary mb-3" />
              <h3 className="font-medium text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ERP PNF
      </footer>
    </div>
  );
}
