import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { EquipoModule } from "@/components/equipo/EquipoModule";
import { FacturacionTab, type FacturacionTabHandle } from "@/components/configuracion/FacturacionTab";
import { ConfiguracionTab, type ConfiguracionTabHandle } from "@/components/configuracion/ConfiguracionTab";
import { IdentidadTab } from "@/components/configuracion/IdentidadTab";
import { CuentasTab } from "@/components/configuracion/CuentasTab";
import { useEffectiveIsDirector } from "@/stores/auth";

export const Route = createFileRoute("/_authenticated/app/configuracion")({
  component: Configuracion,
});

function Configuracion() {
  const navigate = useNavigate();
  const director = useEffectiveIsDirector();
  const [tab, setTab] = useState("facturacion");
  const facturacionRef = useRef<FacturacionTabHandle>(null);
  const configRef = useRef<ConfiguracionTabHandle>(null);

  useEffect(() => {
    if (!director) navigate({ to: "/app", replace: true });
  }, [director, navigate]);

  if (!director) return null;

  const [saving, setSaving] = useState(false);
  const handleSaveAndClose = async () => {
    setSaving(true);
    try {
      if (tab === "facturacion") await facturacionRef.current?.submitAsync();
      else if (tab === "configuracion") await configRef.current?.submitAsync();
      navigate({ to: "/app" });
    } catch {
      // error toast ya lo muestra la mutation
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configuración de empresa</h1>
          <p className="text-sm text-muted-foreground">
            Datos fiscales, identidad, equipo y otras opciones.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/app" })} disabled={saving}>
            Descartar
          </Button>
          <Button onClick={handleSaveAndClose} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="facturacion">Datos de facturación</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
          <TabsTrigger value="identidad">Identidad</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="cuentas">Cuentas</TabsTrigger>
          <TabsTrigger value="documentacion">Documentación</TabsTrigger>
        </TabsList>

        <TabsContent value="facturacion" forceMount className="mt-4 data-[state=inactive]:hidden">
          <Card>
            <CardHeader><CardTitle>Datos de facturación</CardTitle></CardHeader>
            <CardContent>
              <FacturacionTab ref={facturacionRef} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracion" forceMount className="mt-4 data-[state=inactive]:hidden">
          <Card>
            <CardHeader><CardTitle>Configuración general</CardTitle></CardHeader>
            <CardContent>
              <ConfiguracionTab ref={configRef} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="identidad" forceMount className="mt-4 data-[state=inactive]:hidden">
          <Card>
            <CardHeader><CardTitle>Identidad visual</CardTitle></CardHeader>
            <CardContent>
              <IdentidadTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipo" forceMount className="mt-4 data-[state=inactive]:hidden">
          <Card>
            <CardHeader><CardTitle>Equipo de la empresa</CardTitle></CardHeader>
            <CardContent>
              <EquipoModule />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cuentas" forceMount className="mt-4 data-[state=inactive]:hidden">
          <Card>
            <CardHeader><CardTitle>Cuentas bancarias y caja fuerte</CardTitle></CardHeader>
            <CardContent>
              <CuentasTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentacion" forceMount className="mt-4 data-[state=inactive]:hidden">
          <Card>
            <CardHeader><CardTitle>Documentación de la empresa</CardTitle></CardHeader>
            <CardContent>
              <ModulePlaceholder title="Próximamente" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
