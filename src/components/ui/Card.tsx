import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, tight = false, flat = false, ...props }: HTMLAttributes<HTMLDivElement> & { tight?: boolean; flat?: boolean }) {
  return <div className={cn("card", tight && "tight", flat && "flat", className)} {...props} />;
}

export function SectionHeader({ title, meta, children, className }: { title: ReactNode; meta?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("section-h", className)}>
      <h2>{title}</h2>
      {children ?? (meta ? <span className="meta">{meta}</span> : null)}
    </div>
  );
}

export function Pill({ tone, solid = false, className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "ok" | "warn" | "danger" | "info"; solid?: boolean }) {
  return <span className={cn("pill", tone, solid && "solid", className)} {...props} />;
}

export function StatusDot({ tone = "muted", className }: { tone?: "ok" | "warn" | "danger" | "muted"; className?: string }) {
  return <span className={cn("dot", tone, className)} />;
}

export function EmptyState({ icon, title, description, actions, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("empty", className)}>
      {icon ? <div className="empty-mark">{icon}</div> : null}
      <div className="empty-title">{title}</div>
      {description ? <div className="empty-desc">{description}</div> : null}
      {actions ? <div className="empty-actions">{actions}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, warn = false }: { value: number; warn?: boolean }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("bar", warn && "warn")}>
      <i style={{ width: `${width}%` }} />
    </div>
  );
}

export function SegmentedControl<T extends string | number>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="segment">
      {options.map((option) => (
        <button key={option.value} type="button" className={value === option.value ? "active" : ""} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
