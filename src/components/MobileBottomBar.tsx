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
  onMoreClick: () => void;
};

export function MobileBottomBar({ items, pathname, onMoreClick }: Props) {
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
      <button
        type="button"
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] leading-none text-muted-foreground"
        aria-label="Más opciones"
      >
        <MoreHorizontal className="size-5" />
        <span>Más</span>
      </button>
    </nav>
  );
}
