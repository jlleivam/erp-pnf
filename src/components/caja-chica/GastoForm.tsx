import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { montoGastoObra } from "@/lib/api/caja-chica.functions";

export type GastoFormValue = {
  fecha: string;
  concepto: string;
  descripcion: string;
  monto: string;
  tipoComprobante: "factura" | "nota" | "ninguno";
  evidenciaUrl: string | null;
};

const BUCKET = "caja-chica-evidencias";

export function emptyGasto(): GastoFormValue {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    concepto: "",
    descripcion: "",
    monto: "",
    tipoComprobante: "ninguno",
    evidenciaUrl: null,
  };
}

export function GastoForm({
  value, onChange, obraId,
}: {
  value: GastoFormValue;
  onChange: (v: GastoFormValue) => void;
  obraId: string;
}) {
  const companyId = useAuthStore((s) => s.profile?.company_id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!companyId) return toast.error("Sin empresa asociada");
    setUploading(true);
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${companyId}/${obraId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
      upsert: false, contentType: f.type,
    });
    setUploading(false);
    if (error) return toast.error(`No se pudo subir: ${error.message}`);
    onChange({ ...value, evidenciaUrl: path });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input
            type="date" value={value.fecha}
            onChange={(e) => onChange({ ...value, fecha: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Monto (MXN)</Label>
          <Input
            type="number" min="0" step="0.01" value={value.monto}
            onChange={(e) => onChange({ ...value, monto: e.target.value })}
            placeholder="0.00"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Concepto</Label>
        <Input
          value={value.concepto}
          onChange={(e) => onChange({ ...value, concepto: e.target.value })}
          placeholder="p.ej. Gasolina, agua, papelería…"
        />
      </div>
      <div className="space-y-1">
        <Label>Descripción / ¿En qué se usó?</Label>
        <Textarea
          rows={3} value={value.descripcion}
          onChange={(e) => onChange({ ...value, descripcion: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>Tipo de comprobante</Label>
        <Select
          value={value.tipoComprobante}
          onValueChange={(v) => onChange({ ...value, tipoComprobante: v as any })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="factura">Factura</SelectItem>
            <SelectItem value="nota">Nota</SelectItem>
            <SelectItem value="ninguno">Sin comprobante</SelectItem>
          </SelectContent>
        </Select>
        {value.tipoComprobante === "factura" && Number(value.monto) > 0 && (
          <p className="text-xs text-muted-foreground">
            Gasto a obra (sin IVA): ${montoGastoObra(Number(value.monto), "factura").toFixed(2)} · IVA acreditable: ${(Number(value.monto) - montoGastoObra(Number(value.monto), "factura")).toFixed(2)}
          </p>
        )}
        {value.tipoComprobante !== "factura" && Number(value.monto) > 0 && (
          <p className="text-xs text-muted-foreground">
            Gasto a obra: ${Number(value.monto).toFixed(2)} (sin IVA acreditable)
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Evidencia (foto)</Label>
        {value.evidenciaUrl ? (
          <div className="flex items-center justify-between border rounded p-2 text-sm">
            <span className="truncate">{value.evidenciaUrl.split("/").pop()}</span>
            <Button
              variant="ghost" size="sm"
              onClick={() => onChange({ ...value, evidenciaUrl: null })}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              ref={fileRef}
              type="file" accept="image/*"
              onChange={onPickFile}
              disabled={uploading}
            />
            {uploading && <Upload className="w-4 h-4 animate-pulse" />}
          </div>
        )}
      </div>
    </div>
  );
}
