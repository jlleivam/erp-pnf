import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { completeOnboarding } from "@/lib/api/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Registra tu usuario — ERP PNF" }] }),
  component: Onboarding,
});

type TipoPersona = "moral" | "fisica";

function Onboarding() {
  const navigate = useNavigate();
  const finish = useServerFn(completeOnboarding);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [tipoPersona, setTipoPersona] = useState<TipoPersona>("moral");
  const [razonSocial, setRazonSocial] = useState("");
  const [rfc, setRfc] = useState("");

  // Step 2
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!razonSocial.trim() || !rfc.trim()) {
      toast.error("Completa razón social y RFC");
      return;
    }
    setStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nombre_completo: nombreCompleto },
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
      if (!data.session) {
        // attempt direct sign in (auto-confirm enabled)
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }

      await finish({
        data: {
          tipo_persona: tipoPersona,
          razon_social: razonSocial.trim(),
          rfc: rfc.trim(),
          nombre_completo: nombreCompleto.trim(),
        },
      });

      // Re-sync session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { getSessionContext } = await import("@/lib/api/auth.functions");
        const ctx = await getSessionContext();
        useAuthStore.getState().setSession({
          userId: ctx.userId,
          profile: ctx.profile,
          roles: ctx.roles,
        });
      }

      toast.success("Empresa creada");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Registra tu usuario</CardTitle>
          <CardDescription>
            Paso {step} de 2 — {step === 1 ? "Datos de la empresa" : "Cuenta del Director"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tipo de persona</Label>
                <Select value={tipoPersona} onValueChange={(v) => setTipoPersona(v as TipoPersona)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moral">Persona moral</SelectItem>
                    <SelectItem value="fisica">Persona física</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="razon">
                  {tipoPersona === "moral" ? "Razón social" : "Nombre completo"}
                </Label>
                <Input
                  id="razon"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rfc">RFC</Label>
                <Input
                  id="rfc"
                  value={rfc}
                  onChange={(e) => setRfc(e.target.value.toUpperCase())}
                  required
                  maxLength={13}
                  minLength={12}
                />
              </div>
              <Button type="submit" className="w-full">
                Continuar
              </Button>
            </form>
          ) : (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input
                  id="nombre"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                  Atrás
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Creando…" : "Crear empresa y cuenta"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
