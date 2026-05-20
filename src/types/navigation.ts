import type { IconName } from "@/components/ui/Icon";

export type PageId = "overview" | "runmode" | "provider" | "monitor";

export const NAV_ITEMS: Array<{ id: PageId; label: string; section: string; icon: IconName }> = [
  { id: "overview", label: "概览", section: "总览", icon: "overview" },
  { id: "runmode", label: "运行模式", section: "配置", icon: "runmode" },
  { id: "provider", label: "模型服务", section: "配置", icon: "provider" },
  { id: "monitor", label: "用量监控", section: "配置", icon: "monitor" }
];
