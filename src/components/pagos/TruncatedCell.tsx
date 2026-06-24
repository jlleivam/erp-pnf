import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Single-line text cell with ellipsis. Shows the full content in a tooltip
 * on hover. Must be rendered inside a <TooltipProvider>.
 */
export function TruncatedCell({
  children,
  title,
  className,
}: {
  children: React.ReactNode;
  /** Full text shown in the tooltip. If omitted, uses `children` if it is a string. */
  title?: React.ReactNode;
  className?: string;
}) {
  const tip = title ?? (typeof children === "string" ? children : null);
  const content = (
    <div
      className={cn(
        "block max-w-full truncate whitespace-nowrap overflow-hidden text-ellipsis",
        className,
      )}
    >
      {children}
    </div>
  );
  if (tip == null || tip === "") return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-md whitespace-normal break-words">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
