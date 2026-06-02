import { createFileRoute } from "@tanstack/react-router";
import { DestajosModule } from "@/components/destajos/DestajosModule";

export const Route = createFileRoute("/_authenticated/app/obras/$obraId/destajos")({
  component: () => {
    const { obraId } = Route.useParams();
    return <DestajosModule obraId={obraId} />;
  },
});
