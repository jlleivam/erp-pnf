import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { listCxPCajaChicaFondoPendientes } from "@/lib/api/pagos.functions";
import { formatMXN, formatDate } from "@/lib/format";
import { RegistrarPagoCxPDialog } from "./RegistrarPagoCxPDialog";
import { ReponerReembolsoDialog } from "@/components/caja-chica/ReponerReembolsoDialog";
import { RevisarReembolsoSheet } from "@/components/caja-chica/RevisarReembolsoSheet";

type Row = {
  tipo: "fondo" | "reembolso";
  id: string;
  folio: string;
  fecha_emision: string;
  obra_id: string | null;
  obra_nombre: string | null;
  beneficiario_id: string | null;
  beneficiario_nombre: string;
  concepto: string;
  monto_total: number;
  monto_pagado: number;
  saldo: number;
  estatus: string;
  monto_aprobado?: number;
  semana_inicio?: string;
  semana_fin?: string;
};

export function CajaChicaPorPagarTab() {
  const fetchCxP = useServerFn(listCxPCajaChicaFondoPendientes);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pagarFondo, setPagarFondo] = useState<Row | null>(null);
  const [reponerReemb, setReponerReemb] = useState<Row | null>(null);
  const [verReembolsoId, setVerReembolsoId] = useState<string | null>(null);

  const cxpQ = useQuery({
    queryKey: ["caja-chica-por-pagar"],
    queryFn: () => fetchCxP(),
  });

  const all = (cxpQ.data ?? []) as Row[];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((r) =>
      r.folio.toLowerCase().includes(term) ||
      (r.obra_nombre ?? "").toLowerCase().includes(term) ||
      r.beneficiario_nombre.toLowerCase().includes(term),
    );
  }, [all, q]);

  const totalSaldo = useMemo(() => all.reduce((s, r) => s + r.saldo, 0), [all]);

  const onSaved = () => {
    setPagarFondo(null);
    setReponerReemb(null);
    qc.invalidateQueries({ queryKey: ["caja-chica-por-pagar"] });
    qc.invalidateQueries({ queryKey: ["cuentas-activas"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
    qc.invalidateQueries({ queryKey: ["caja-chica"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Caja chica por pagar</h3>
          <p className="text-xs text-muted-foreground">
            Fondos autorizados pendientes de entregar y reembolsos semanales pendientes de reponer.
          </p>
        </div>
        <Card className="px-4 py-2">
          <p className="text-xs text-muted-foreground">Saldo total</p>
          <p className="text-lg font-semibold">{formatMXN(totalSaldo)}</p>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar folio, obra o residente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Folio</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Residente</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cxpQ.isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!cxpQ.isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  <Wallet className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Sin pendientes de caja chica.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => {
              const isReemb = r.tipo === "reembolso";
              return (
                <TableRow
                  key={`${r.tipo}-${r.id}`}
                  className={isReemb ? "cursor-pointer hover:bg-muted/30" : undefined}
                  onClick={isReemb ? () => setVerReembolsoId(r.id) : undefined}
                >
                  <TableCell>
                    <Badge variant={isReemb ? "default" : "secondary"}>
                      {isReemb ? "Reembolso" : "Fondo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{r.folio}</TableCell>
                  <TableCell className="text-xs">{formatDate(r.fecha_emision)}</TableCell>
                  <TableCell className="text-xs">{r.obra_nombre ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.beneficiario_nombre}</TableCell>
                  <TableCell className="text-right">{formatMXN(r.monto_total)}</TableCell>
                  <TableCell className="text-right">{formatMXN(r.monto_pagado)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMXN(r.saldo)}</TableCell>
                  <TableCell className="text-right">
                    {isReemb ? (
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); setReponerReemb(r); }}>Reponer</Button>
                    ) : (
                      <Button size="sm" onClick={() => setPagarFondo(r)}>Registrar pago</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {pagarFondo && (
        <RegistrarPagoCxPDialog
          open={!!pagarFondo}
          onOpenChange={(o) => { if (!o) setPagarFondo(null); }}
          cxpId={pagarFondo.id}
          folio={pagarFondo.folio}
          beneficiarioNombre={pagarFondo.beneficiario_nombre}
          saldoPendiente={pagarFondo.saldo}
          onSaved={onSaved}
          defaultCuentaTipo="caja_fuerte"
        />
      )}

      {reponerReemb && (
        <ReponerReembolsoDialog
          open={!!reponerReemb}
          onOpenChange={(o) => { if (!o) setReponerReemb(null); }}
          reembolso={{
            id: reponerReemb.id,
            folio: reponerReemb.folio,
            monto_aprobado: reponerReemb.monto_aprobado ?? reponerReemb.monto_total,
          }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
