import type { ProviderRecord } from "@/types/provider";

export type FirstStartScanState = "detected" | "partial" | "fresh";

export type FirstStartCandidate = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  source: string;
  complete: boolean;
};

export type FirstStartScanResult = {
  state: FirstStartScanState;
  handled: boolean;
  candidates: FirstStartCandidate[];
  configExists: boolean;
  authExists: boolean;
  configPath: string | null;
  authMode: "apikey" | "chatgpt" | "logged_out" | null;
  envKeys: string[];
  lastActiveCustomProviderId: number | null;
};

export type FirstStartImportResult = {
  providers: ProviderRecord[];
  importedProviderId: string;
};
