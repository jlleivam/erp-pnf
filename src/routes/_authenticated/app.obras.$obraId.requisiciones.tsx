import { createFileRoute } from "@tanstack/react-router";
import { RequisicionesModule } from "@/components/requisiciones/RequisicionesModule";

export const Route = createFileRoute("/_authenticated/app/obras/$obraId/requisiciones")({
  component: RequisicionesPage,
});

function RequisicionesPage() {
  const { obraId } = Route.useParams();
  return <RequisicionesModule obraId={obraId} />;
}
