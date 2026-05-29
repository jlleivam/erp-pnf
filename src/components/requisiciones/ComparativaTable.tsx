import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Props {
  reqItems: any[]; // items de la requisición con insumo {id, nombre, unidad}
  solicitudes: any[]; // solo recibidas
}

const mxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function ComparativaTable({ reqItems, solicitudes }: Props) {
  const recibidas = solicitudes.filter((s) => s.estatus === "recibida");

  // Map<insumoId, Map<solicitudId, {precio, disponible}>>
  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, { precio: number; disponible: boolean }>>();
    for (const sc of recibidas) {
      for (const it of sc.items ?? []) {
        if (!m.has(it.insumo_id)) m.set(it.insumo_id, new Map());
        m.get(it.insumo_id)!.set(sc.id, {
          precio: Number(it.precio_unitario ?? 0),
          disponible: it.disponible !== false,
        });
      }
    }
    return m;
  }, [recibidas]);

  // Totales por proveedor (solo insumos que ofertó)
  const totales = useMemo(() => {
    const t = new Map<string, number>();
    for (const sc of recibidas) {
      let suma = 0;
      for (const it of sc.items ?? []) {
        if (it.disponible !== false) {
          suma += Number(it.cantidad) * Number(it.precio_unitario ?? 0);
        }
      }
      t.set(sc.id, suma);
    }
    return t;
  }, [recibidas]);

  if (recibidas.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="text-sm text-muted-foreground">
          Aún no hay cotizaciones recibidas. Captura las respuestas de tus proveedores para comparar precios aquí.
        </p>
      </Card>
    );
  }

  const sinCotizar = reqItems.filter((ri) => !matrix.has(ri.insumo.id)).length;

  return (
    <div className="space-y-3">
      {sinCotizar > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          {sinCotizar} insumo{sinCotizar === 1 ? "" : "s"} de la requisición sin cotización todavía.
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Insumo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                {recibidas.map((sc) => (
                  <TableHead key={sc.id} className="text-right min-w-[140px]">
                    <div className="flex flex-col items-end">
                      <span className="font-semibold">{sc.proveedor?.razon_social ?? "—"}</span>
                      <span className="text-xs text-muted-foreground font-normal">{sc.folio}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reqItems.map((ri) => {
                const ofertas = matrix.get(ri.insumo.id);
                const preciosValidos = ofertas
                  ? Array.from(ofertas.values()).filter((o) => o.disponible && o.precio > 0).map((o) => o.precio)
                  : [];
                const minPrecio = preciosValidos.length > 0 ? Math.min(...preciosValidos) : null;
                return (
                  <TableRow key={ri.id}>
                    <TableCell className="font-medium text-sm">{ri.insumo.nombre}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {Number(ri.cantidad)} {ri.insumo.unidad}
                    </TableCell>
                    {recibidas.map((sc) => {
                      const oferta = ofertas?.get(sc.id);
                      if (!oferta) return <TableCell key={sc.id} className="text-right text-muted-foreground">—</TableCell>;
                      if (!oferta.disponible) {
                        return (
                          <TableCell key={sc.id} className="text-right">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">No disponible</Badge>
                          </TableCell>
                        );
                      }
                      const isMin = minPrecio !== null && oferta.precio === minPrecio;
                      return (
                        <TableCell
                          key={sc.id}
                          className={`text-right text-sm tabular-nums ${
                            isMin ? "bg-emerald-50 text-emerald-800 font-semibold" : ""
                          }`}
                        >
                          {mxn(oferta.precio)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot className="border-t bg-muted/30">
              <TableRow>
                <TableCell className="font-semibold text-sm" colSpan={2}>
                  Total ofertado
                </TableCell>
                {recibidas.map((sc) => (
                  <TableCell key={sc.id} className="text-right font-semibold tabular-nums">
                    {mxn(totales.get(sc.id) ?? 0)}
                  </TableCell>
                ))}
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </Card>
    </div>
  );
}
