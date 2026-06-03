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
  if (slug === "catalogos") return <CatalogoInsumosModule />;
  if (slug === "requisiciones") return <RequisicionesModule obraId={obraId} />;
  if (slug === "almacen-obra") return <AlmacenModule obraId={obraId} />;
  if (slug === "presupuesto") return <PresupuestoModule obraId={obraId} />;
  if (slug === "estimaciones") return <EstimacionesModule obraId={obraId} />;
  if (slug === "nomina") return <NominaModule obraId={obraId} />;
  if (slug === "destajos") return <DestajosModule obraId={obraId} />;
  if (slug === "subcontratos") return <SubcontratosModule obraId={obraId} />;
  if (slug === "rentas") return <RentasModule obraId={obraId} />;
  if (slug === "gasolinas") return <GasolinasModule obraId={obraId} scope="obra" />;
  if (slug === "caja-chica") return <CajaChicaModule obraId={obraId} scope="obra" />;
  if (slug === "estado-resultados") return <EstadoResultadosModule obraId={obraId} />;
  if (slug === "tareas") return <TareasModule obraId={obraId} />;
  const title = LABELS[slug] ?? "Módulo";
  const isAuxiliar = !isDirector(roles) && roles.includes("auxiliar");

  return (
    <ModulePlaceholder
      title={title}
      description="Módulo de obra"
      badge={isAuxiliar ? "Requiere VB Residente" : undefined}
    />
  );
}
