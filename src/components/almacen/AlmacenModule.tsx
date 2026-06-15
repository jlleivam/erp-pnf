import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMXN } from "@/lib/format";
import {
  listOCsPorRecibir,
  listHistorialSemanas,
  getSemana,
} from "@/lib/api/almacen.functions";
import { RecepcionDialog } from "./RecepcionDialog";
import { SemanaActualPanel } from "./SemanaActualPanel";
import { useObraRole } from "@/hooks/useObraRole";


interface Props { obraId: string }

const OC_BADGE: Record<string, { label: string; className: string }> = {
  enviada: { label: "Pendiente de recibir", className: "bg-blue-100 text-blue-800" },
  recibida_parcial: { label: "Recibida parcial", className: "bg-cyan-100 text-cyan-800" },
};

export function AlmacenModule({ obraId }: Props) {
  const [tab, setTab] = useState("semana");
  const [recepcionOCId, setRecepcionOCId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Almacén de obra</h1>
        <p className="text-sm text-muted-foreground">
          Recepción de material, control semanal de inventario (lun–dom) y consumo.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="semana">Semana actual</TabsTrigger>
          <TabsTrigger value="recibir">Por recibir</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="semana" className="mt-4">
          <SemanaActualPanel obraId={obraId} />
        </TabsContent>

        <TabsContent value="recibir" className="mt-4">
          <PorRecibirTab obraId={obraId} onRecibir={setRecepcionOCId} />
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <HistorialTab obraId={obraId} />
        </TabsContent>
      </Tabs>

      {recepcionOCId && (
        <RecepcionDialog
          ocId={recepcionOCId}
          open={!!recepcionOCId}
          onOpenChange={(o) => { if (!o) setRecepcionOCId(null); }}
        />
      )}
    </div>
  );
}

function PorRecibirTab({ obraId, onRecibir }: { obraId: string; onRecibir: (id: string) => void }) {
  const fn = useServerFn(listOCsPorRecibir);
  const { role, isDirector } = useObraRole(obraId);
  const puedeRecibir = isDirector || role === "residente" || role === "supervisor";
  const { data, isLoading } = useQuery({
    queryKey: ["almacen", "por-recibir", obraId],
    queryFn: () => fn({ data: { obraId } }),
  });


  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const ocs = data ?? [];
  if (ocs.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No hay órdenes de compra pendientes de recibir.
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>OC</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Enviada</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Estatus</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ocs.map((oc: any) => {
            const badge = OC_BADGE[oc.estatus];
            return (
              <TableRow key={oc.id}>
                <TableCell className="font-medium">{oc.folio}</TableCell>
                <TableCell>{oc.proveedor?.razon_social ?? "—"}</TableCell>
                <TableCell>{formatDate(oc.enviada_proveedor_at)}</TableCell>
                <TableCell>{formatMXN(Number(oc.total))}</TableCell>
                <TableCell>
                  {badge && <Badge className={badge.className}>{badge.label}</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {puedeRecibir ? (
                    <Button size="sm" onClick={() => onRecibir(oc.id)}>Registrar recepción</Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function HistorialTab({ obraId }: { obraId: string }) {
  const fn = useServerFn(listHistorialSemanas);
  const { data, isLoading } = useQuery({
    queryKey: ["almacen", "historial", obraId],
    queryFn: () => fn({ data: { obraId } }),
  });
  const [openSemana, setOpenSemana] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Aún no hay semanas cerradas.
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead>Cerrada</TableHead>
              <TableHead className="text-right">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {formatDate(s.semana_inicio)} – {formatDate(s.semana_fin)}
                </TableCell>
                <TableCell>{formatDate(s.cerrada_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setOpenSemana(s.id)}>
                    {openSemana === s.id ? "Ocultar" : "Ver"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {openSemana && <SemanaReadOnly semanaId={openSemana} />}
    </div>
  );
}

function SemanaReadOnly({ semanaId }: { semanaId: string }) {
  const fn = useServerFn(getSemana);
  const { data, isLoading } = useQuery({
    queryKey: ["almacen", "semana", semanaId],
    queryFn: () => fn({ data: { semanaId } }),
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data) return null;
  return (
    <Card>
      <div className="p-3 text-sm font-medium">
        {formatDate(data.semana.semana_inicio)} – {formatDate(data.semana.semana_fin)}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Insumo</TableHead>
            <TableHead>Unidad</TableHead>
            <TableHead className="text-right">PU</TableHead>
            <TableHead className="text-right">Inv. inicial</TableHead>
            <TableHead className="text-right">Recibido</TableHead>
            <TableHead className="text-right">Utilizado</TableHead>
            <TableHead className="text-right">Inv. final</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((m: any) => {
            const final = Number(m.inv_inicial) + Number(m.recibido) - Number(m.utilizado);
            return (
              <TableRow key={m.id}>
                <TableCell>{m.insumo?.nombre ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.insumo?.unidad ?? "—"}</TableCell>
                <TableCell className="text-right">{formatMXN(Number(m.precio_unitario))}</TableCell>
                <TableCell className="text-right">{Number(m.inv_inicial)}</TableCell>
                <TableCell className="text-right">{Number(m.recibido)}</TableCell>
                <TableCell className="text-right">{Number(m.utilizado)}</TableCell>
                <TableCell className="text-right font-medium">{final}</TableCell>
              </TableRow>
            );
          })}
          {data.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Sin movimientos.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
