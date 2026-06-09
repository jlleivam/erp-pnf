import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/lib/format";
import { VigenteTable, type VigenteRow } from "./VigenteTable";

export function VigenteViewerDialog({
  open,
  onClose,
  vigente,
  total,
  title = "Presupuesto vigente",
}: {
  open: boolean;
  onClose: () => void;
  vigente: VigenteRow[];
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
            <Badge>Autorizado</Badge>
            <span className="ml-auto text-base font-semibold">
              {formatMXN(calcTotal)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div>
          <VigenteTable rows={vigente} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
