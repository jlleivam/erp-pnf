import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getCompanyConfig,
  setCompanyLogo,
  getCompanyLogoSignedUrl,
} from "@/lib/api/company.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

export function IdentidadTab() {
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const fetchCfg = useServerFn(getCompanyConfig);
  const saveLogoFn = useServerFn(setCompanyLogo);
  const signFn = useServerFn(getCompanyLogoSignedUrl);

  const cfg = useQuery({ queryKey: ["company-config"], queryFn: () => fetchCfg() });

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!cfg.data?.logo_url) {
        setSignedUrl(null);
        return;
      }
      try {
        const { url } = await signFn({ data: { path: cfg.data.logo_url } });
        if (!cancel) setSignedUrl(url);
      } catch {
        if (!cancel) setSignedUrl(null);
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, [cfg.data?.logo_url, signFn]);

  const saveLogo = useMutation({
    mutationFn: saveLogoFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-config"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleUpload = async (file: File) => {
    if (!profile?.company_id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${profile.company_id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      if (cfg.data?.logo_url && cfg.data.logo_url !== path) {
        await supabase.storage.from("company-logos").remove([cfg.data.logo_url]);
      }
      await saveLogo.mutateAsync({ data: { logo_url: path } });
      toast.success("Logo actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!cfg.data?.logo_url) return;
    if (!confirm("¿Eliminar el logo?")) return;
    try {
      await supabase.storage.from("company-logos").remove([cfg.data.logo_url]);
      await saveLogo.mutateAsync({ data: { logo_url: null } });
      toast.success("Logo eliminado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  if (cfg.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-5">
      <div>
        <Label>Logo de la empresa</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Se mostrará en los PDFs generados (cotizaciones, órdenes de compra, etc.).
          Formatos: PNG, JPG, SVG. Tamaño recomendado: 512x512 px.
        </p>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <div className="size-32 rounded-md border bg-muted/30 grid place-items-center overflow-hidden">
          {signedUrl ? (
            <img src={signedUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">Sin logo</span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
              disabled={uploading}
              className="max-w-xs"
            />
            {uploading && <span className="text-xs text-muted-foreground">Subiendo…</span>}
          </div>
          {cfg.data?.logo_url && (
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Trash2 className="size-4 mr-1" /> Eliminar logo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
