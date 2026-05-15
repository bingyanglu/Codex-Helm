type EmptyStateCardProps = {
  title: string;
  body: string;
};

export function EmptyStateCard({ title, body }: EmptyStateCardProps) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      <div className="text-sm font-medium text-[var(--color-text-primary)]">{title}</div>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{body}</p>
    </div>
  );
}
