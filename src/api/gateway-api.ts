import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
} from "@reduxjs/toolkit/query/react";
import { mapFetchError, type ApiError } from "./api-error";
import type { SessionPort } from "./session";

export interface ThunkExtra {
  session: SessionPort;
}

const requestTimeoutMs = 15_000;

function sessionOf(extra: unknown): SessionPort {
  if (typeof extra === "object" && extra !== null && "session" in extra) {
    return (extra as ThunkExtra).session;
  }
  throw new Error(
    "The store must pass the session as the thunk extra argument.",
  );
}

// Built on the first request, so importing the module needs no browser location.
let rawBaseQuery: ReturnType<typeof fetchBaseQuery> | undefined;

function rawQuery() {
  rawBaseQuery ??= fetchBaseQuery({
    baseUrl: location.origin,
    timeout: requestTimeoutMs,
    responseHandler: async (response) => {
      const text = await response.text();
      return text === "" ? null : (JSON.parse(text) as unknown);
    },
  });
  return rawBaseQuery;
}

async function tokenOf(session: SessionPort): Promise<string | null> {
  try {
    return await session.getAccessToken();
  } catch {
    return null;
  }
}

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (
  args,
  api,
  extraOptions,
) => {
  // A request with no token, or whose token cannot be had, is not sent: the
  // gateway would only answer 401.
  const token = await tokenOf(sessionOf(api.extra));
  if (token === null) {
    return { error: { kind: "unauthenticated" } };
  }
  const request = typeof args === "string" ? { url: args } : args;
  const headers = new Headers(request.headers as HeadersInit | undefined);
  headers.set("Authorization", `Bearer ${token}`);
  const result = await rawQuery()({ ...request, headers }, api, extraOptions);
  if (result.error !== undefined) {
    return { error: mapFetchError(result.error) };
  }
  // The raw meta holds the Request, and with it the Authorization header,
  // which RTK Query copies into the dispatched actions.
  return { data: result.data };
};

export const gatewayApi = createApi({
  reducerPath: "gatewayApi",
  baseQuery,
  tagTypes: ["Wallet", "Activity", "Transfer", "Names"],
  endpoints: () => ({}),
});
