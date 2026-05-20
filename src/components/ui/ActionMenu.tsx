import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ActionMenuItem = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function ActionMenu({ items, className }: { items: ActionMenuItem[]; className?: string }) {
  return (
    <div className={cn("menu", className)} role="menu">
      {items.map((item, index) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          aria-disabled={item.disabled ? "true" : undefined}
          disabled={item.disabled}
          className={cn("menu-item", item.danger && "danger")}
          onClick={item.disabled ? undefined : item.onSelect}
        >
          {item.icon}
          {item.label}
          {index < items.length - 1 && null}
        </button>
      ))}
    </div>
  );
}
