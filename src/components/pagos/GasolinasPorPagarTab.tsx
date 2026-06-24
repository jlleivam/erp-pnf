import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fuel, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listValesPorPagar } from "@/lib/api/vales-gasolina.functions";
import { formatMXN, formatDate } from "@/lib/format";
import { RegistrarPagoValesGasolinaDialog, type ValeSeleccionado } from "./RegistrarPagoValesGasolinaDialog";
import { TruncatedCell } from "./TruncatedCell";

type ValeRow = {
  id: string;
  folio: string;
  obra_id: string | null;
  obra_nombre: string | null;
  tipo_combustible: string;
  estatus: string;
  ligado_at: string | null;
  solicitante_nombre: string | null;
  monto_autorizado: number;
  pagado: number;
  saldo: number;
};

export function GasolinasPorPagarTab() {
  const fetchVales = useServerFn(listValesPorPagar);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const valesQ = useQuery({
    queryKey: ["vales-por-pagar"],
    queryFn: () => fetchVales(),
  });

  const allVales = (valesQ.data ?? []) as ValeRow[];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return allVales;
    return allVales.filter((v) =>
      v.folio.toLowerCase().includes(term) ||
      (v.obra_nombre ?? "").toLowerCase().includes(term) ||
      (v.solicitante_nombre ?? "").toLowerCase().includes(term) ||
      v.tipo_combustible.toLowerCase().includes(term)
    );
  }, [allVales, q]);

  const totalSaldo = useMemo(() => allVales.reduce((s, v) => s + v.saldo, 0), [allVales]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (filtered.every((v) => selected.has(v.id)) && filtered.length > 0) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((v) => next.delete(v.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((v) => next.add(v.id));
        return next;
      });
    }
  };

  const selectedRows = allVales.filter((v) => selected.has(v.id));
  const selectedTotal = selectedRows.reduce((s, v) => s + v.saldo, 0);
  const allChecked = filtered.length > 0 && filtered.every((v) => selected.has(v.id));

  const valesParaPagar: ValeSeleccionado[] = selectedRows.map((v) => ({
    id: v.id, folio: v.folio, obra_nombre: v.obra_nombre, saldo: v.saldo,
  }));

  const onSaved = () => {
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["vales-por-pagar"] });
    qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
    qc.invalidateQueries({ queryKey: ["vales-gasolina"] });
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Vales de gasolina por pagar</h3>
          <p className="text-xs text-muted-foreground">
            Vales ligados y entregados al residente, pendientes de pago. Selecciona varios para liquidarlos en una sola operación.
          </p>
        </div>
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Saldo total</p>
          <p className="text-lg font-semibold">{formatMXN(totalSaldo)}</p>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar folio, obra o solicitante…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={toggleAll}
                  aria-label="Seleccionar todos"
                />
              </TableHead>
              <TableHead>Folio</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Combustible</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Entregado</TableHead>
              <TableHead className="text-right">Autorizado</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estatus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {valesQ.isLoading && (
              <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">Cargando…</TableCell></TableRow>
            )}
            {!valesQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                  <Fuel className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin vales de gasolina pendientes de pago.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((v) => (
              <TableRow key={v.id} className={selected.has(v.id) ? "bg-muted/40" : ""}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(v.id)}
                    onCheckedChange={() => toggle(v.id)}
                    aria-label={`Seleccionar ${v.folio}`}
                  />
                </TableCell>
                <TableCell className="font-medium max-w-[140px]">
                  <TruncatedCell>{v.folio}</TruncatedCell>
                </TableCell>
                <TableCell className="text-xs max-w-[180px]">
                  <TruncatedCell>{v.obra_nombre ?? "—"}</TruncatedCell>
                </TableCell>
                <TableCell className="text-xs capitalize whitespace-nowrap">{v.tipo_combustible}</TableCell>
                <TableCell className="text-xs max-w-[180px]">
                  <TruncatedCell>{v.solicitante_nombre ?? "—"}</TruncatedCell>
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{v.ligado_at ? formatDate(v.ligado_at) : "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatMXN(v.monto_autorizado)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatMXN(v.pagado)}</TableCell>
                <TableCell className="text-right font-semibold whitespace-nowrap">{formatMXN(v.saldo)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge className={v.estatus === "confirmado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                    {v.estatus === "confirmado" ? "Confirmado" : "Entregado"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-full px-6 py-3 flex items-center gap-4">
          <div className="text-sm">
            <span className="font-semibold">{selected.size}</span> vale{selected.size === 1 ? "" : "s"}
            <span className="text-muted-foreground"> · </span>
            <span className="font-semibold">{formatMXN(selectedTotal)}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpiar</Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>Registrar pago</Button>
        </div>
      )}

      {dialogOpen && (
        <RegistrarPagoValesGasolinaDialog
          vales={valesParaPagar}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
