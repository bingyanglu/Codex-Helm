export type ProviderKind = "builtin" | "custom";

export type ProviderRecord = {
  localId: number;
  providerId: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  envKey: string;
  httpHeaders: Record<string, string>;
  queryParams: Record<string, string>;
  supportsWebsockets: boolean;
  requiresOpenaiAuth: boolean;
  active: boolean;
  enabled: boolean;
  lastValidatedAt: string | null;
  lastValidationStatus: string;
};

export type ProviderValidationResult = {
  ok: boolean;
  detail: string;
};

export type ProviderConnectivityResult = {
  reachable: boolean;
  authenticated: boolean;
  latencyMs: number;
  detail: string;
};
