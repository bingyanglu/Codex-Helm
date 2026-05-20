import { Icon } from "@/components/ui/Icon";

type TopbarProps = {
  title: string;
  onRefresh: () => void;
};

export function Topbar({ title, onRefresh }: TopbarProps) {
  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-spacer" />
      <div className="topbar-actions">
        <button type="button" className="icon-btn" title="刷新" aria-label="刷新" onClick={onRefresh}>
          <Icon name="refresh" size={16} />
        </button>
      </div>
    </div>
  );
}
