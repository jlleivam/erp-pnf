import { Link } from "@tanstack/react-router";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export type BottomBarItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Active if pathname equals `to` (exact) or starts with `to` */
  exact?: boolean;
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
        <div className="h-full overflow-x-auto overflow-y-hidden flex items-stretch [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((it) => {
            const Icon = it.icon;
            const active = it.exact
              ? pathname === it.to
              : pathname === it.to || pathname.startsWith(it.to + "/");
            return (
              <Link
                key={it.label}
                to={it.to}
                className={`shrink-0 min-w-[72px] px-2 flex flex-col items-center justify-center gap-1 text-[11px] leading-none ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                <span className="truncate max-w-[68px]">{it.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-card to-transparent" />
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
