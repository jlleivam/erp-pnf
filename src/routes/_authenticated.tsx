import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { loading, userId, profile } = useAuthStore();

  useEffect(() => {
    if (!loading && !userId) {
      navigate({ to: "/login", replace: true });
    } else if (!loading && userId && profile && !profile.company_id) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, userId, profile, navigate]);

  if (loading || !userId || !profile) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!profile.company_id) return null;

  return <Outlet />;
}
