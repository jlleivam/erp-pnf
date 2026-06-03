import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { CatalogoInsumosModule } from "@/components/insumos/CatalogoInsumosModule";
import { RequisicionesModule } from "@/components/requisiciones/RequisicionesModule";
import { AlmacenModule } from "@/components/almacen/AlmacenModule";
import { PresupuestoModule } from "@/components/presupuesto/PresupuestoModule";
import { EstimacionesModule } from "@/components/estimaciones/EstimacionesModule";
import { NominaModule } from "@/components/nomina/NominaModule";
import { DestajosModule } from "@/components/destajos/DestajosModule";
import { SubcontratosModule } from "@/components/subcontratos/SubcontratosModule";
import { RentasModule } from "@/components/rentas/RentasModule";
import { GasolinasModule } from "@/components/gasolinas/GasolinasModule";
import { CajaChicaModule } from "@/components/caja-chica/CajaChicaModule";
import { EstadoResultadosModule } from "@/components/estado-resultados/EstadoResultadosModule";
import { TareasModule } from "@/components/tareas/TareasModule";
import { useEffectiveRoles, isDirector } from "@/stores/auth";

const LABELS: Record<string, string> = {
  estimaciones: "Estimaciones",
  "ordenes-cambio": "Órdenes de cambio",
  requisiciones: "Requisiciones",
  presupuesto: "Presupuesto",
  nomina: "Nómina",
  destajos: "Destajos",
  subcontratos: "Subcontratos",
  rentas: "Rentas",
  gasolinas: "Gasolinas",
  "caja-chica": "Caja chica",
  "estado-resultados": "Estado de resultados",
  "almacen-obra": "Almacén de obra",
  tareas: "Tareas",
  catalogos: "Catálogos",
};

export const Route = createFileRoute("/_authenticated/app/obras/$obraId/$")({
  component: ObraModule,
});

function ObraModule() {
  const { _splat, obraId } = Route.useParams() as { _splat?: string; obraId: string };
  const roles = useEffectiveRoles();
  const slug = (_splat ?? "").split("/")[0];

  let content;
  if (slug === "catalogos") content = <CatalogoInsumosModule />;
  else if (slug === "requisiciones") content = <RequisicionesModule obraId={obraId} />;
  else if (slug === "almacen-obra") content = <AlmacenModule obraId={obraId} />;
  else if (slug === "presupuesto") content = <PresupuestoModule obraId={obraId} />;
  else if (slug === "estimaciones") content = <EstimacionesModule obraId={obraId} />;
  else if (slug === "nomina") content = <NominaModule obraId={obraId} />;
  else if (slug === "destajos") content = <DestajosModule obraId={obraId} />;
  else if (slug === "subcontratos") content = <SubcontratosModule obraId={obraId} />;
  else if (slug === "rentas") content = <RentasModule obraId={obraId} />;
  else if (slug === "gasolinas") content = <GasolinasModule obraId={obraId} scope="obra" />;
  else if (slug === "caja-chica") content = <CajaChicaModule obraId={obraId} scope="obra" />;
  else if (slug === "estado-resultados") content = <EstadoResultadosModule obraId={obraId} />;
  else if (slug === "tareas") content = <TareasModule obraId={obraId} />;
  else {
    const title = LABELS[slug] ?? "Módulo";
    const isAuxiliar = !isDirector(roles) && roles.includes("auxiliar");
    content = (
      <ModulePlaceholder
        title={title}
        description="Módulo de obra"
        badge={isAuxiliar ? "Requiere VB Residente" : undefined}
      />
    );
  }

  return (
    <div>
      <div className="mb-3">
        <Link
          to="/app/obras/$obraId"
          params={{ obraId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Volver a la obra
        </Link>
      </div>
      {content}
    </div>
  );
}
