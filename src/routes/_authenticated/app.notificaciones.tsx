import { createFileRoute } from "@tanstack/react-router";
import { NotificacionesModule } from "@/components/notificaciones/NotificacionesModule";

export const Route = createFileRoute("/_authenticated/app/notificaciones")({
  head: () => ({
    meta: [
      { title: "Notificaciones — ERP PNF" },
      { name: "description", content: "Historial completo de notificaciones de tu cuenta." },
    ],
  }),
  component: NotificacionesPage,
});

function NotificacionesPage() {
  return <NotificacionesModule />;
}
