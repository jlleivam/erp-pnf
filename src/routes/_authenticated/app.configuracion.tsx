import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { EquipoModule } from "@/components/equipo/EquipoModule";

export const Route = createFileRoute("/_authenticated/app/configuracion")({
  component: Configuracion,
});

function Configuracion() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">Datos de la empresa, equipo y otras opciones.</p>
      </header>
      <Tabs defaultValue="facturacion">
        <TabsList>
          <TabsTrigger value="facturacion">Facturación</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="otras">Otras</TabsTrigger>
        </TabsList>
        <TabsContent value="facturacion" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Datos de facturación</CardTitle></CardHeader>
            <CardContent>
              <ModulePlaceholder title="Datos fiscales y de facturación" />
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
        <TabsContent value="otras" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Otras configuraciones</CardTitle></CardHeader>
            <CardContent>
              <ModulePlaceholder title="Otras configuraciones" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
