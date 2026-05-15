export type PageId = "overview" | "provider" | "monitor";

export const NAV_ITEMS = [
  { id: "overview", label: "状态概览", section: "总览" },
  { id: "provider", label: "模型服务", section: "配置" },
  { id: "monitor", label: "监控", section: "配置" }
] as const;
