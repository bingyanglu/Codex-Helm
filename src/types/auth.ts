export type AuthMode = "chatgpt" | "apikey" | "logged_out";

export type AuthStatus = {
  mode: AuthMode;
  maskedToken: string | null;
  sourcePath: string;
};
