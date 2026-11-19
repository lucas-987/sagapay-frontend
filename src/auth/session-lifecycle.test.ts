import type { Middleware } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { gatewayApi } from "../api/gateway-api";
import { createAppStore } from "../app/store";
import { fakeOidcClient, userOf } from "../test/fake-oidc-client";
import { server } from "../test/setup";
import { createAuthAdapter, type AuthAdapter } from "./auth-adapter";
import { connectSessionLifecycle, sessionEnded } from "./session-lifecycle";

const probeApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    probe: build.query<{ owner: string }, number>({
      query: () => "/v1/probe",
    }),
  }),
});

const probeUrl = new URL("/v1/probe", location.origin).toString();
type Fake = ReturnType<typeof fakeOidcClient>;
const julien = userOf({ subject: "julien-id", name: "Julien Simon" });

async function signedInStore() {
  const fake = fakeOidcClient(julien);
  const adapter = createAuthAdapter(fake.client);
  await adapter.initialize();
  const actionTypes: string[] = [];
  const recorder: Middleware = () => (next) => (action) => {
    actionTypes.push((action as { type: string }).type);
    return next(action);
  };
  const store = createAppStore({ session: adapter, middleware: [recorder] });
  connectSessionLifecycle(adapter, store);
  return { fake, adapter, store, actionTypes };
}

describe("session lifecycle", () => {
  test.each([
    {
      event: "sign-out",
      trigger: async (_fake: Fake, adapter: AuthAdapter) => {
        await adapter.signOut();
      },
    },
    {
      event: "user change",
      trigger: (fake: Fake) => {
        fake.load(userOf({ subject: "gina-id" }));
      },
    },
    {
      event: "expiry",
      trigger: (fake: Fake) => {
        fake.expire();
      },
    },
  ])(
    "on $event it signals the stream to stop, then clears the query cache",
    async ({ trigger }) => {
      server.use(
        http.get(probeUrl, () => HttpResponse.json({ owner: "julien" })),
      );
      const { fake, adapter, store, actionTypes } = await signedInStore();
      await store.dispatch(probeApi.endpoints.probe.initiate(1));
      expect(probeApi.endpoints.probe.select(1)(store.getState()).data).toEqual(
        {
          owner: "julien",
        },
      );
      actionTypes.length = 0;

      await trigger(fake, adapter);

      expect(actionTypes).toEqual([
        sessionEnded.type,
        "gatewayApi/resetApiState",
        "gatewayApi/config/middlewareRegistered",
      ]);
      expect(store.getState().gatewayApi.queries).toEqual({});
    },
  );

  test("a renewal of the same customer leaves the cache and the stream alone", async () => {
    server.use(
      http.get(probeUrl, () => HttpResponse.json({ owner: "julien" })),
    );
    const { fake, store, actionTypes } = await signedInStore();
    await store.dispatch(probeApi.endpoints.probe.initiate(1));
    actionTypes.length = 0;

    fake.load(userOf({ subject: "julien-id", token: "renewed" }));

    expect(actionTypes).toEqual([]);
    expect(probeApi.endpoints.probe.select(1)(store.getState()).data).toEqual({
      owner: "julien",
    });
  });

  test("an answer to a request sent before the sign-out never reaches the cache", async () => {
    let answer: () => void = () => undefined;
    let requestReceived: () => void = () => undefined;
    const received = new Promise<void>((resolve) => {
      requestReceived = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      answer = resolve;
    });
    server.use(
      http.get(probeUrl, async () => {
        requestReceived();
        await gate;
        return HttpResponse.json({ owner: "julien" });
      }),
    );
    const { adapter, store } = await signedInStore();
    const pending = store.dispatch(probeApi.endpoints.probe.initiate(1));
    await received;

    await adapter.signOut();
    answer();
    await pending;

    expect(store.getState().gatewayApi.queries).toEqual({});
  });
});
