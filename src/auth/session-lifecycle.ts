import { createAction, type UnknownAction } from "@reduxjs/toolkit";
import { gatewayApi } from "../api/gateway-api";
import type { AuthAdapter } from "./auth-adapter";

export const sessionEnded = createAction("session/ended");

export function connectSessionLifecycle(
  adapter: AuthAdapter,
  store: { dispatch(action: UnknownAction): unknown },
): () => void {
  return adapter.onEvent(() => {
    store.dispatch(sessionEnded());
    store.dispatch(gatewayApi.util.resetApiState());
  });
}
