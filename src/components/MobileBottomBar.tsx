import { Link } from "@tanstack/react-router";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { PendientesBadge } from "@/components/PendientesBadge";

export type BottomBarItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Active if pathname equals `to` (exact) or starts with `to` */
  exact?: boolean;
  /** Pendientes count to show as a badge over the icon */
  pendientes?: number;
};


type Props = {
  items: BottomBarItem[];
  pathname: string;
  variant?: "fixed" | "scroll";
  onMoreClick?: () => void;
};

export function MobileBottomBar({ items, pathname, variant = "fixed", onMoreClick }: Props) {
  if (variant === "scroll") {
    return (
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-card border-t border-border z-30">
        <div className="h-full w-full flex items-stretch justify-around">
          {items.map((it) => {
            const Icon = it.icon;
            const active = it.exact
              ? pathname === it.to
              : pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.label}
                to={it.to}
                className={`flex-1 min-w-0 px-1 flex flex-col items-center justify-center gap-1 text-[10px] leading-none ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                <span className="truncate max-w-full">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-card border-t border-border flex items-stretch z-30">
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.exact ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/");
        return (
          <Link
            key={it.label}
            to={it.to}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] leading-none ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-5" />
            <span className="truncate max-w-[80%]">{it.label}</span>
          </Link>
        );
      })}
      {onMoreClick && (
        <button
          type="button"
          onClick={onMoreClick}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] leading-none text-muted-foreground"
          aria-label="Más opciones"
        >
          <MoreHorizontal className="size-5" />
          <span>Más</span>
        </button>
      )}
    </nav>
  );
}
