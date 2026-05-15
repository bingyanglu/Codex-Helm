type StatusCardProps = {
  label: string;
  value: string;
  subtext: string;
  tone?: "default" | "danger";
};

export function StatusCard({ label, value, subtext, tone = "default" }: StatusCardProps) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
      <div className="text-[11px] text-[var(--color-text-tertiary)]">{label}</div>
      <div
        className={`mt-2 text-base font-medium ${
          tone === "danger" ? "text-[#b42318]" : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtext}</div>
    </div>
  );
}
