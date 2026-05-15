import type { AuthMode } from "@/types/auth";

export type InstallStatus = {
  installed: boolean;
  version: string | null;
  path: string | null;
  detail: string | null;
};

export type OverviewStatus = {
  cli: InstallStatus;
  app: InstallStatus;
  authMode: AuthMode;
  activeProvider: string | null;
  activeProviderBaseUrl: string | null;
  monitorAvailable: boolean;
  model: string | null;
  sandboxMode: string | null;
  approvalPolicy: string | null;
  configPath: string;
  configExists: boolean;
  configLastModified: string | null;
};
