import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, FileUp, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  subirDocumentoTrabajador,
  eliminarDocumentoTrabajador,
} from "@/lib/api/trabajadores.functions";
import { estadoVencimiento, formatDate, type EstadoDoc } from "@/lib/format";

const BUCKET = "trabajadores-docs";

const ESTADO_STYLES: Record<EstadoDoc, string> = {
  ok: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  por_vencer: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  vencido: "bg-rose-100 text-rose-800 hover:bg-rose-100",
  sin_documento: "bg-muted text-muted-foreground hover:bg-muted",
};
const ESTADO_LABEL: Record<EstadoDoc, string> = {
  ok: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_documento: "Sin documento",
};

export type DocTipo = "ine" | "curp" | "domicilio" | "contrato";

export function DocumentoTrabajadorUploader({
  trabajadorId,
  companyId,
  tipo,
  titulo,
  url,
  vencimiento,
  canEdit,
  conVencimiento = false,
}: {
  trabajadorId: string;
  companyId: string;
  tipo: DocTipo;
  titulo: string;
  url: string | null;
  vencimiento: string | null;
  canEdit: boolean;
  conVencimiento?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingVenc, setPendingVenc] = useState<string>(vencimiento ?? "");
  const [uploading, setUploading] = useState(false);

  const estado = conVencimiento
    ? estadoVencimiento(vencimiento, url)
    : url
      ? "ok"
      : "sin_documento";

  const guardar = useServerFn(subirDocumentoTrabajador);
  const eliminar = useServerFn(eliminarDocumentoTrabajador);

  const saveM = useMutation({
    mutationFn: guardar,
    onSuccess: () => {
      toast.success("Documento actualizado");
      qc.invalidateQueries({ queryKey: ["trabajador", trabajadorId] });
      qc.invalidateQueries({ queryKey: ["trabajadores"] });
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: eliminar,
    onSuccess: () => {
      toast.success("Documento eliminado");
      qc.invalidateQueries({ queryKey: ["trabajador", trabajadorId] });
      qc.invalidateQueries({ queryKey: ["trabajadores"] });
      setPendingVenc("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function descargar() {
    if (!url) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(url, 60);
    if (error || !data?.signedUrl) {
      toast.error("No se pudo generar enlace");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function onSubmit() {
    if (!pendingFile && !(conVencimiento && pendingVenc)) {
      toast.error("Selecciona un archivo");
      return;
    }
    let path = url;
    if (pendingFile) {
      setUploading(true);
      const ext = pendingFile.name.split(".").pop() || "pdf";
      const filename = `${tipo}-${Date.now()}.${ext}`;
      path = `${companyId}/${trabajadorId}/${filename}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
      setUploading(false);
      if (error) {
        toast.error(`Error al subir: ${error.message}`);
        return;
      }
    }
    saveM.mutate({
      data: {
        trabajador_id: trabajadorId,
        tipo,
        path: path || "",
        fecha_vencimiento: conVencimiento ? pendingVenc || null : null,
      },
    });
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">{titulo}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {url
              ? conVencimiento
                ? `Vence: ${formatDate(vencimiento)}`
                : "Documento cargado"
              : "No se ha cargado"}
          </p>
        </div>
        <Badge className={ESTADO_STYLES[estado]} variant="secondary">
          {ESTADO_LABEL[estado]}
        </Badge>
      </div>

      {url && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={descargar}>
            <Download className="size-4 mr-1" /> Descargar
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => delM.mutate({ data: { trabajador_id: trabajadorId, tipo } })}
              disabled={delM.isPending}
              className="text-rose-600 hover:text-rose-700"
            >
              <Trash2 className="size-4 mr-1" /> Eliminar
            </Button>
          )}
        </div>
      )}

      {canEdit && (
        <div
          className={`grid ${conVencimiento ? "grid-cols-2" : "grid-cols-1"} gap-3 pt-2 border-t`}
        >
          <div>
            <Label className="text-xs">Archivo (PDF/Imagen)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {conVencimiento && (
            <div>
              <Label className="text-xs">Fecha de vencimiento</Label>
              <Input
                type="date"
                value={pendingVenc}
                onChange={(e) => setPendingVenc(e.target.value)}
              />
            </div>
          )}
          <div className={conVencimiento ? "col-span-2" : ""}>
            <Button size="sm" onClick={onSubmit} disabled={uploading || saveM.isPending}>
              <FileUp className="size-4 mr-1" />
              {uploading || saveM.isPending ? "Guardando…" : url ? "Actualizar" : "Cargar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
