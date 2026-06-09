import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getVigente } from "@/lib/api/presupuestos.functions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { formatMXN } from "@/lib/format";
import { VigenteTable } from "./VigenteTable";

export function VerVigenteSheet({
  obraId,
  onClose,
}: {
  obraId: string;
  onClose: () => void;
}) {
  const fetch = useServerFn(getVigente);
  const { data, isLoading } = useQuery({
    queryKey: ["presupuesto-vigente", obraId],
    queryFn: () => fetch({ data: { obraId } }),
  });

  const vigente = data?.vigente ?? [];
  const total = data?.montoTotal ?? 0;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            Presupuesto vigente
            <span className="ml-auto text-base font-semibold">{formatMXN(total)}</span>
          </SheetTitle>
          <SheetDescription>
            Consolidado del presupuesto base más las órdenes de cambio autorizadas.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : !data?.hasBase ? (
            <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay presupuesto base autorizado todavía.
            </Card>
          ) : (
            <VigenteTable rows={vigente as any} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
