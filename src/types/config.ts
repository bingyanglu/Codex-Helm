export type ConfigView = {
  model: string;
  modelProvider: string;
  approvalPolicy: string;
  sandboxMode: string;
  webSearch: string;
  toolsViewImage: boolean;
  historyPersistence: string;
  historyMaxBytes: number;
  rawToml: string;
  backupPath: string;
};

export type ConfigInput = Omit<ConfigView, "rawToml" | "backupPath">;
