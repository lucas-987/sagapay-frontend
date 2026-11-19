import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createAppStore } from "../app/store";
import { server } from "../test/setup";
import { gatewayApi } from "./gateway-api";
import type { SessionPort } from "./session";

const probeApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    probe: build.query<{ ok: boolean }, number>({
      query: (n) => `/v1/probe?n=${String(n)}`,
    }),
  }),
});

const headerApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    withHeader: build.query<{ ok: boolean }, number>({
      query: (n) => ({
        url: `/v1/probe?n=${String(n)}`,
        headers: { "x-probe": "yes" },
      }),
    }),
  }),
});

const probeUrl = (n: number) =>
  new URL(`/v1/probe?n=${String(n)}`, location.origin).toString();

function sessionWith(...tokens: (string | null)[]): SessionPort {
  const queue = [...tokens];
  return { getAccessToken: () => Promise.resolve(queue.shift() ?? null) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("gateway base query", () => {
  test("sends the token of the session as a bearer header", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(probeUrl(1), ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    const store = createAppStore({ session: sessionWith("token-1") });

    const result = await store.dispatch(probeApi.endpoints.probe.initiate(1));

    expect(authorization).toBe("Bearer token-1");
    expect(result.data).toStrictEqual({ ok: true });
  });

  test("reads the token again for each request", async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(
        new URL("/v1/probe", location.origin).toString(),
        ({ request }) => {
          seen.push(request.headers.get("authorization"));
          return HttpResponse.json({ ok: true });
        },
      ),
    );
    const store = createAppStore({ session: sessionWith("old", "renewed") });

    await store.dispatch(probeApi.endpoints.probe.initiate(1));
    await store.dispatch(probeApi.endpoints.probe.initiate(2));

    expect(seen).toStrictEqual(["Bearer old", "Bearer renewed"]);
  });

  test("does not send a request when the session has no token", async () => {
    let requests = 0;
    server.use(
      http.get(probeUrl(1), () => {
        requests += 1;
        return HttpResponse.json({ ok: true });
      }),
    );
    const store = createAppStore({ session: sessionWith(null) });

    const result = await store.dispatch(probeApi.endpoints.probe.initiate(1));

    expect(requests).toBe(0);
    expect(result.error).toStrictEqual({ kind: "unauthenticated" });
  });

  test("does not send a request when the session cannot give a token", async () => {
    let requests = 0;
    server.use(
      http.get(probeUrl(1), () => {
        requests += 1;
        return HttpResponse.json({ ok: true });
      }),
    );
    const store = createAppStore({
      session: {
        getAccessToken: () => Promise.reject(new Error("renewal refused")),
      },
    });

    const result = await store.dispatch(probeApi.endpoints.probe.initiate(1));

    expect(requests).toBe(0);
    expect(result.error).toStrictEqual({ kind: "unauthenticated" });
  });

  test("keeps the headers an endpoint sets next to the bearer token", async () => {
    let seen: (string | null)[] = [];
    server.use(
      http.get(probeUrl(1), ({ request }) => {
        seen = [
          request.headers.get("authorization"),
          request.headers.get("x-probe"),
        ];
        return HttpResponse.json({ ok: true });
      }),
    );
    const store = createAppStore({ session: sessionWith("token-1") });

    await store.dispatch(headerApi.endpoints.withHeader.initiate(1));

    expect(seen).toStrictEqual(["Bearer token-1", "yes"]);
  });

  test("fails with a clear message when the store passes no session", async () => {
    const bare = configureStore({
      reducer: { [gatewayApi.reducerPath]: gatewayApi.reducer },
      middleware: (getDefault) => getDefault().concat(gatewayApi.middleware),
    });

    const result = await bare.dispatch(probeApi.endpoints.probe.initiate(1));

    expect(result.error).toMatchObject({
      message: "The store must pass the session as the thunk extra argument.",
    });
  });

  test("keeps the token out of every dispatched action and out of the state", async () => {
    server.use(http.get(probeUrl(1), () => HttpResponse.json({ ok: true })));
    const actions: unknown[] = [];
    const recorder: Middleware = () => (next) => (action) => {
      actions.push(action);
      return next(action);
    };
    const store = createAppStore({
      session: sessionWith("secret-token"),
      middleware: [recorder],
    });

    await store.dispatch(probeApi.endpoints.probe.initiate(1));

    const holders = [...actions, store.getState()].filter((value) =>
      holds(value, "secret-token"),
    );
    expect(holders).toStrictEqual([]);
    expect(actions.map((a) => (a as { type: string }).type)).toStrictEqual([
      "gatewayApi/config/middlewareRegistered",
      "gatewayApi/executeQuery/pending",
      "gatewayApi/executeQuery/fulfilled",
    ]);
  });

  test("maps a problem response to its code", async () => {
    server.use(
      http.get(probeUrl(1), () =>
        HttpResponse.json(
          { status: 404, code: "RECIPIENT_NOT_FOUND" },
          {
            status: 404,
            headers: { "content-type": "application/problem+json" },
          },
        ),
      ),
    );
    const store = createAppStore({ session: sessionWith("t") });

    const result = await store.dispatch(probeApi.endpoints.probe.initiate(1));

    expect(result.error).toStrictEqual({
      kind: "problem",
      code: "RECIPIENT_NOT_FOUND",
      status: 404,
    });
  });

  test("maps a 401 with an empty body to unauthenticated", async () => {
    server.use(
      http.get(probeUrl(1), () => new HttpResponse(null, { status: 401 })),
    );
    const store = createAppStore({ session: sessionWith("t") });

    const result = await store.dispatch(probeApi.endpoints.probe.initiate(1));

    expect(result.error).toStrictEqual({ kind: "unauthenticated" });
  });

  test("maps a network failure to uncertain", async () => {
    server.use(http.get(probeUrl(1), () => HttpResponse.error()));
    const store = createAppStore({ session: sessionWith("t") });

    const result = await store.dispatch(probeApi.endpoints.probe.initiate(1));

    expect(result.error).toStrictEqual({ kind: "uncertain" });
  });

  test("maps a response that never comes to uncertain", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    server.use(
      http.get(probeUrl(1), async () => {
        await delay("infinite");
        return HttpResponse.json({ ok: true });
      }),
    );
    const store = createAppStore({ session: sessionWith("t") });

    const pending = store.dispatch(probeApi.endpoints.probe.initiate(1));
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(result.error).toStrictEqual({ kind: "uncertain" });
  });

  test("maps a body that is not JSON to unexpected", async () => {
    server.use(
      http.get(probeUrl(1), () => new HttpResponse("<html>", { status: 500 })),
    );
    const store = createAppStore({ session: sessionWith("t") });

    const result = await store.dispatch(probeApi.endpoints.probe.initiate(1));

    expect(result.error).toStrictEqual({ kind: "unexpected", status: 500 });
  });

  test("maps a gateway answer without a problem to uncertain", async () => {
    server.use(
      http.get(probeUrl(1), () => new HttpResponse("<html>", { status: 504 })),
    );
    const store = createAppStore({ session: sessionWith("t") });

    const result = await store.dispatch(probeApi.endpoints.probe.initiate(1));

    expect(result.error).toStrictEqual({ kind: "uncertain" });
  });
});

function holds(
  value: unknown,
  needle: string,
  seen = new Set<unknown>(),
): boolean {
  if (typeof value === "string") return value.includes(needle);
  if (value instanceof Request) {
    return [...value.headers.values()].some((v) => v.includes(needle));
  }
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return false;
  }
  seen.add(value);
  return Object.values(value).some((child) => holds(child, needle, seen));
}
