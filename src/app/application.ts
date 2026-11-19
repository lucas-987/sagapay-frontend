import { connectSessionLifecycle } from "../auth/session-lifecycle";
import { createAuthAdapter, type OidcClient } from "../auth/auth-adapter";
import { createAppStore } from "./store";

export function createApplication(client: OidcClient) {
  const adapter = createAuthAdapter(client);
  const store = createAppStore({ session: adapter });
  connectSessionLifecycle(adapter, store);
  return { adapter, store, ready: adapter.initialize() };
}

export type Application = ReturnType<typeof createApplication>;
