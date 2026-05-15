type TopbarProps = {
  title: string;
};

export function Topbar({ title }: TopbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-black/5 bg-white px-6 py-4">
      <h1 className="text-[15px] font-medium text-[var(--color-text-primary)]">{title}</h1>
      <button className="rounded-md border border-black/10 px-3 py-1.5 text-sm text-[var(--color-text-primary)]">刷新</button>
    </div>
  );
}
