import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import { createAction, type Middleware } from "@reduxjs/toolkit";
import { gatewayApi } from "../api/gateway-api";
import type { SessionPort } from "../api/session";
import { sessionEnded } from "../auth/session-lifecycle";
import { createBackoff } from "./backoff";
import { decodeStreamEvent, type StreamEvent } from "./stream-events";

export const streamRequested = createAction("realtime/streamRequested");
export const activityEventReceived = createAction<StreamEvent>(
  "realtime/activityEventReceived",
);

export interface ActivityStreamOptions {
  reconnect?: { initialDelayMs: number; maxDelayMs: number };
  random?: () => number;
}

const defaultReconnect = { initialDelayMs: 1000, maxDelayMs: 30_000 };

function tagsOf(event: StreamEvent) {
  const transfer = { type: "Transfer", id: event.transferId } as const;
  return event.type === "transfer.blocked"
    ? [transfer, "Activity" as const]
    : [transfer, "Activity" as const, "Wallet" as const];
}

export function createActivityStreamMiddleware(
  session: SessionPort,
  { reconnect = defaultReconnect, random }: ActivityStreamOptions = {},
): Middleware {
  return (api) => {
    let controller: AbortController | undefined;

    function open(stop: AbortSignal) {
      const backoff = createBackoff({ ...reconnect, random });
      let interrupted = false;

      // The library reuses the headers it was started with for every retry,
      // so the token is put on each request here, at the moment it is sent.
      const fetchWithToken: typeof fetch = async (input, init) => {
        const token = await session.getAccessToken().catch(() => null);
        if (token === null) throw new Error("There is no access token.");
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      };

      void fetchEventSource(
        new URL("/v1/stream/activity", location.origin).href,
        {
          signal: stop,
          fetch: fetchWithToken,
          openWhenHidden: true,
          onopen: (response) => {
            if (
              !response.ok ||
              !response.headers
                .get("content-type")
                ?.startsWith(EventStreamContentType)
            ) {
              throw new Error(
                `The activity stream answered ${String(response.status)}.`,
              );
            }
            backoff.reset();
            if (interrupted) {
              interrupted = false;
              api.dispatch(
                gatewayApi.util.invalidateTags([
                  "Wallet",
                  "Activity",
                  "Transfer",
                ]),
              );
            }
            return Promise.resolve();
          },
          onmessage: ({ id, event, data }) => {
            const decoded = decodeStreamEvent({ id, event, data });
            if (decoded === undefined || stop.aborted) return;
            api.dispatch(activityEventReceived(decoded));
            api.dispatch(gatewayApi.util.invalidateTags(tagsOf(decoded)));
          },
          // The library ends for good on a clean close: throwing makes it an
          // interruption like any other.
          onclose: () => {
            throw new Error("The activity stream was closed by the server.");
          },
          onerror: () => {
            interrupted = true;
            return backoff.next();
          },
        },
      );
    }

    return (next) => (action) => {
      if (streamRequested.match(action) && controller === undefined) {
        controller = new AbortController();
        open(controller.signal);
      } else if (sessionEnded.match(action)) {
        controller?.abort();
        controller = undefined;
      }
      return next(action);
    };
  };
}
