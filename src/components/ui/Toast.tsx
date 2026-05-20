import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

export function Toast({ msg, onDone }: { msg: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!msg) return;
    const timer = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(timer);
  }, [msg, onDone]);

  if (!msg) return null;

  return (
    <div className="toast">
      <Icon name="check" size={14} strokeWidth={2.4} />
      {msg}
    </div>
  );
}
