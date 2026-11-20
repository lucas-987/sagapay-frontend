import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";
import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { gatewayApi, ThunkExtra } from "../../api/gateway-api";
import { idsToAsk } from "./transfer-logic";
import { transfersApi } from "./transfers-api";

type ApiState = {
  [gatewayApi.reducerPath]: ReturnType<typeof gatewayApi.reducer>;
};

function cachedNames(queries: ApiState["gatewayApi"]["queries"]) {
  const names: Record<string, string> = {};
  const asked = new Set<string>();
  for (const entry of Object.values(queries)) {
    if (entry?.endpointName !== "getNames") continue;
    for (const id of (entry.originalArgs as readonly string[] | undefined) ??
      []) {
      asked.add(id);
    }
    if (entry.data !== undefined) {
      Object.assign(names, entry.data as Record<string, string>);
    }
  }
  return { names, asked };
}

export function useCounterpartyNames(
  ids: readonly (string | undefined)[],
): Readonly<Record<string, string>> {
  const dispatch =
    useDispatch<ThunkDispatch<ApiState, ThunkExtra, UnknownAction>>();
  const queries = useSelector((state: ApiState) => state.gatewayApi.queries);
  const { names, asked } = useMemo(() => cachedNames(queries), [queries]);
  const subscriptions = useRef<{ unsubscribe: () => void }[]>([]);
  const requests = idsToAsk(
    ids.filter((id) => id !== undefined),
    asked,
  );

  useEffect(() => {
    for (const request of requests) {
      subscriptions.current.push(
        dispatch(transfersApi.endpoints.getNames.initiate(request)),
      );
    }
  }, [requests, dispatch]);

  useEffect(() => {
    const held = subscriptions.current;
    return () => {
      held.splice(0).forEach((subscription) => {
        subscription.unsubscribe();
      });
    };
  }, []);

  return names;
}
