export interface SessionPort {
  getAccessToken(): Promise<string | null>;
}
