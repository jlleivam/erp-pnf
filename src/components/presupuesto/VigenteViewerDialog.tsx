import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/lib/format";

type Row = {
  clave: string;
  concepto?: string | null;
  unidad?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  importe?: number | null;
  nivel?: number;
  es_grupo?: boolean;
  origen?: string;
};

export function VigenteViewerDialog({
  open,
  onClose,
  vigente,
  total,
  title = "Presupuesto vigente",
  description = "Vista de solo lectura para usar como referencia.",
}: {
  open: boolean;
  onClose: () => void;
  vigente: Row[];
  total?: number;
  title?: string;
  description?: string;
}) {
  const calcTotal =
    total ??
    vigente
      .filter((r) => !r.es_grupo)
      .reduce((sum, r) => sum + Number(r.importe ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {title}
            <span className="ml-auto text-base font-semibold">
              {formatMXN(calcTotal)}
            </span>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {vigente.length === 0 ? (
          <Card className="border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin renglones.
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-2 w-24">Clave</th>
                  <th className="text-left p-2">Concepto</th>
                  <th className="text-left p-2 w-20">Unidad</th>
                  <th className="text-right p-2 w-24">Cant.</th>
                  <th className="text-right p-2 w-28">PU</th>
                  <th className="text-right p-2 w-32">Importe</th>
                </tr>
              </thead>
              <tbody>
                {vigente.map((r) => (
                  <tr
                    key={r.clave}
                    className={`border-t border-border ${r.es_grupo ? "bg-muted/30 font-medium" : ""}`}
                  >
                    <td
                      className="p-2 tabular-nums"
                      style={{
                        paddingLeft: `${0.5 + ((r.nivel ?? 1) - 1) * 1}rem`,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        {r.clave}
                        {r.origen === "modificada" && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            Mod
                          </Badge>
                        )}
                        {r.origen === "agregada" && (
                          <Badge className="text-[10px] h-4 px-1">Nuevo</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-2">{r.concepto}</td>
                    <td className="p-2 text-muted-foreground">{r.unidad ?? "—"}</td>
                    <td className="p-2 text-right tabular-nums">
                      {r.cantidad != null
                        ? Number(r.cantidad).toLocaleString("es-MX")
                        : "—"}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.precio_unitario != null
                        ? formatMXN(Number(r.precio_unitario))
                        : "—"}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {r.importe != null ? formatMXN(Number(r.importe)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
