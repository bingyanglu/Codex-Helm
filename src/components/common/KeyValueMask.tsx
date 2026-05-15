type KeyValueMaskProps = {
  value: string;
};

export function KeyValueMask({ value }: KeyValueMaskProps) {
  const masked =
    value.length <= 8 ? "••••" : `${value.slice(0, 8)}••••${value.slice(-4)}`;

  return <span className="font-mono text-sm text-[var(--color-text-primary)]">{masked}</span>;
}
