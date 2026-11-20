import { connectSessionLifecycle } from "../auth/session-lifecycle";
import { createAuthAdapter, type OidcClient } from "../auth/auth-adapter";
import {
  streamRequested,
  type ActivityStreamOptions,
} from "../realtime/activity-stream";
import { createAppStore } from "./store";

export function createApplication(
  client: OidcClient,
  { stream }: { stream?: ActivityStreamOptions } = {},
) {
  const adapter = createAuthAdapter(client);
  const store = createAppStore({ session: adapter, stream });
  connectSessionLifecycle(adapter, store);
  adapter.onChange(() => {
    if (adapter.getState().status === "signed-in") {
      store.dispatch(streamRequested());
    }
  });
  return { adapter, store, ready: adapter.initialize() };
}

export type Application = ReturnType<typeof createApplication>;
