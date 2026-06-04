import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { EquipoModule } from "@/components/equipo/EquipoModule";
import { FacturacionTab } from "@/components/configuracion/FacturacionTab";
import { ConfiguracionTab } from "@/components/configuracion/ConfiguracionTab";
import { IdentidadTab } from "@/components/configuracion/IdentidadTab";
import { useEffectiveIsDirector } from "@/stores/auth";

export const Route = createFileRoute("/_authenticated/app/configuracion")({
  component: Configuracion,
});

function Configuracion() {
  const navigate = useNavigate();
  const director = useEffectiveIsDirector();

  useEffect(() => {
    if (!director) navigate({ to: "/app", replace: true });
  }, [director, navigate]);

  if (!director) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración de empresa</h1>
        <p className="text-sm text-muted-foreground">
          Datos fiscales, identidad, equipo y otras opciones.
        </p>
      </header>

      <Tabs defaultValue="facturacion">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="facturacion">Datos de facturación</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
          <TabsTrigger value="identidad">Identidad</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="documentacion">Documentación</TabsTrigger>
        </TabsList>

        <TabsContent value="facturacion" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Datos de facturación</CardTitle></CardHeader>
            <CardContent>
              <FacturacionTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracion" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Configuración general</CardTitle></CardHeader>
            <CardContent>
              <ConfiguracionTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="identidad" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Identidad visual</CardTitle></CardHeader>
            <CardContent>
              <IdentidadTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipo" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Equipo de la empresa</CardTitle></CardHeader>
            <CardContent>
              <EquipoModule />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentacion" className="mt-4">
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
