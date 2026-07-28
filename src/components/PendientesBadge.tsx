import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  count: number;
  className?: string;
};

export function PendientesBadge({ count, className }: Props) {
  if (!count || count <= 0) return null;
  return (
    <Badge
      className={cn(
        "h-4 min-w-4 px-1 text-[10px] bg-rose-500 text-white border-0 rounded-full grid place-items-center leading-none",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </Badge>
  );
}
