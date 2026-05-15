import { EmptyStateCard } from "@/components/common/EmptyStateCard";

export function SessionsPage() {
  return (
    <section className="p-6">
      <EmptyStateCard title="会话管理即将支持" body="Phase 1 先保留完整页面位置，稍后再接入 SQLite 会话数据库。" />
    </section>
  );
}
