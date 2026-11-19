import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { gatewayApi, type ThunkExtra } from "../api/gateway-api";
import type { SessionPort } from "../api/session";

interface StoreOptions {
  session: SessionPort;
  production?: boolean;
  middleware?: Middleware[];
}

export function createAppStore({
  session,
  production = import.meta.env.PROD,
  middleware = [],
}: StoreOptions) {
  const extra: ThunkExtra = { session };
  return configureStore({
    reducer: { [gatewayApi.reducerPath]: gatewayApi.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: extra } })
        .concat(gatewayApi.middleware)
        .concat(middleware),
    devTools: !production,
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore["getState"]>;
