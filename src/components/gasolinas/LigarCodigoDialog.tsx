import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ligarCodigoVale } from "@/lib/api/vales-gasolina.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatMXN } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vale: { id: string; folio: string; monto_autorizado: number | null } | null;
};

export function LigarCodigoDialog({ open, onOpenChange, vale }: Props) {
  const qc = useQueryClient();
  const ligar = useServerFn(ligarCodigoVale);
  const [codigo, setCodigo] = useState("");

  const m = useMutation({
    mutationFn: ligar,
    onSuccess: () => {
      toast.success("Código ligado y vale entregado");
      qc.invalidateQueries({ queryKey: ["vales-gasolina"] });
      onOpenChange(false);
      setCodigo("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });

  if (!vale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ligar código físico — {vale.folio}</DialogTitle>
          <DialogDescription>
            Captura el código del vale físico que se entregará al residente.
            Monto autorizado: <strong>{formatMXN(vale.monto_autorizado ?? 0)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Código del vale</Label>
          <Input
            value={codigo} onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej. VL-00012345"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (codigo.trim().length === 0) return toast.error("Código requerido");
              m.mutate({ data: { id: vale.id, codigoVale: codigo.trim() } });
            }}
            disabled={m.isPending}
          >
            {m.isPending ? "Ligando..." : "Ligar y entregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
