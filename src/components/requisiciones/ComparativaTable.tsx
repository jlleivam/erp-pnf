import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Props {
  reqItems: any[]; // items de la requisición con insumo {id, nombre, unidad}
  solicitudes: any[]; // solo recibidas
}

const mxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function ComparativaTable({ reqItems, solicitudes }: Props) {
  const recibidas = solicitudes.filter((s) => s.estatus === "recibida");

  // Map<insumoId, Map<solicitudId, {precio, disponible, cantidad}>>
  const matrix = useMemo(() => {
    const m = new Map<string, Map<string, { precio: number; disponible: boolean; cantidad: number }>>();
    for (const sc of recibidas) {
      for (const it of sc.items ?? []) {
        if (!m.has(it.insumo_id)) m.set(it.insumo_id, new Map());
        m.get(it.insumo_id)!.set(sc.id, {
          precio: Number(it.precio_unitario ?? 0),
          disponible: it.disponible !== false,
          cantidad: Number(it.cantidad ?? 0),
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
                <TableHead rowSpan={2} className="min-w-[200px] align-bottom">Insumo</TableHead>
                <TableHead rowSpan={2} className="text-right align-bottom">Cant. requerida</TableHead>
                {recibidas.map((sc) => (
                  <TableHead
                    key={sc.id}
                    colSpan={3}
                    className="text-center border-l min-w-[280px]"
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-semibold">{sc.proveedor?.razon_social ?? "—"}</span>
                      <span className="text-xs text-muted-foreground font-normal">{sc.folio}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
              <TableRow>
                {recibidas.map((sc) => (
                  <>
                    <TableHead key={`${sc.id}-c`} className="text-right text-xs border-l">Cant.</TableHead>
                    <TableHead key={`${sc.id}-p`} className="text-right text-xs">P.U.</TableHead>
                    <TableHead key={`${sc.id}-i`} className="text-right text-xs">Importe</TableHead>
                  </>
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
                const cantReq = Number(ri.cantidad);
                const unidad = ri.insumo.unidad ?? "";
                return (
                  <TableRow key={ri.id}>
                    <TableCell className="font-medium text-sm">{ri.insumo.nombre}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {cantReq} {unidad}
                    </TableCell>
                    {recibidas.map((sc) => {
                      const oferta = ofertas?.get(sc.id);
                      if (!oferta || !oferta.disponible) {
                        return (
                          <>
                            <TableCell key={`${sc.id}-c`} className="text-right text-muted-foreground border-l">—</TableCell>
                            <TableCell key={`${sc.id}-p`} className="text-right text-muted-foreground">—</TableCell>
                            <TableCell key={`${sc.id}-i`} className="text-right text-muted-foreground">—</TableCell>
                          </>
                        );
                      }
                      const isMin = minPrecio !== null && oferta.precio === minPrecio;
                      const cantOf = oferta.cantidad;
                      let cantClass = "";
                      if (cantOf < cantReq) cantClass = "text-amber-700 font-medium";
                      else if (cantOf > cantReq) cantClass = "text-sky-700";
                      const importe = cantOf * oferta.precio;
                      return (
                        <>
                          <TableCell key={`${sc.id}-c`} className={`text-right text-sm tabular-nums border-l whitespace-nowrap ${cantClass}`}>
                            {cantOf} {unidad}
                          </TableCell>
                          <TableCell
                            key={`${sc.id}-p`}
                            className={`text-right text-sm tabular-nums ${
                              isMin ? "bg-emerald-50 text-emerald-800 font-semibold" : ""
                            }`}
                          >
                            {mxn(oferta.precio)}
                          </TableCell>
                          <TableCell key={`${sc.id}-i`} className="text-right text-sm tabular-nums">
                            {mxn(importe)}
                          </TableCell>
                        </>
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
                  <TableCell
                    key={sc.id}
                    colSpan={3}
                    className="text-right font-semibold tabular-nums border-l"
                  >
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
