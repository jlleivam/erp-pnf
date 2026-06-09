import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMXN } from "@/lib/format";

export type VigenteRow = {
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

export function VigenteTable({ rows }: { rows: VigenteRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin renglones.</p>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="overflow-x-auto">
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col className="w-28" />
            <col />
            <col className="w-16" />
            <col className="w-20" />
            <col className="w-24" />
            <col className="w-28" />
          </colgroup>
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1.5">Clave</th>
              <th className="text-left px-2 py-1.5">Concepto</th>
              <th className="text-left px-2 py-1.5">Unidad</th>
              <th className="text-right px-2 py-1.5">Cantidad</th>
              <th className="text-right px-2 py-1.5">PU</th>
              <th className="text-right px-2 py-1.5">Importe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.clave}
                className={`border-t border-border ${r.es_grupo ? "bg-muted/30 font-medium" : ""}`}
              >
                <td
                  className="px-2 py-1 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{
                    paddingLeft: `${0.5 + ((r.nivel ?? 1) - 1) * 1}rem`,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{r.clave}</span>
                    {r.origen === "modificada" && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1 shrink-0"
                      >
                        Mod
                      </Badge>
                    )}
                    {r.origen === "agregada" && (
                      <Badge className="text-[10px] h-4 px-1 shrink-0">
                        Nuevo
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-2 py-1 max-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate whitespace-nowrap overflow-hidden text-ellipsis cursor-default">
                        {r.concepto}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="start"
                      className="max-w-md whitespace-normal"
                    >
                      {r.concepto}
                    </TooltipContent>
                  </Tooltip>
                </td>
                <td className="px-2 py-1 text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {r.unidad ?? "—"}
                </td>
                <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                  {r.cantidad != null
                    ? Number(r.cantidad).toLocaleString("es-MX")
                    : "—"}
                </td>
                <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                  {r.precio_unitario != null
                    ? formatMXN(Number(r.precio_unitario))
                    : "—"}
                </td>
                <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                  {r.importe != null ? formatMXN(Number(r.importe)) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </TooltipProvider>
  );
}
