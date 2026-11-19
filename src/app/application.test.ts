import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { gatewayApi } from "../api/gateway-api";
import { fakeOidcClient, userOf } from "../test/fake-oidc-client";
import { server } from "../test/setup";
import { createApplication } from "./application";

const probeApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    probe: build.query<{ ok: boolean }, number>({
      query: (n) => `/v1/probe?n=${String(n)}`,
    }),
  }),
});

const probeUrl = new URL("/v1/probe", location.origin).toString();

test("sends the token renewed by the adapter on the next API call", async () => {
  const seen: (string | null)[] = [];
  server.use(
    http.get(probeUrl, ({ request }) => {
      seen.push(request.headers.get("authorization"));
      return HttpResponse.json({ ok: true });
    }),
  );
  const fake = fakeOidcClient(
    userOf({ subject: "julien-id", token: "first-token" }),
  );
  const { store, ready } = createApplication(fake.client);
  await ready;
  await store.dispatch(probeApi.endpoints.probe.initiate(1));

  fake.load(userOf({ subject: "julien-id", token: "renewed-token" }));
  await store.dispatch(probeApi.endpoints.probe.initiate(2));

  expect(seen).toEqual(["Bearer first-token", "Bearer renewed-token"]);
});

test("clears the query cache when another customer replaces the first", async () => {
  server.use(http.get(probeUrl, () => HttpResponse.json({ ok: true })));
  const fake = fakeOidcClient(userOf({ subject: "julien-id" }));
  const { store, ready } = createApplication(fake.client);
  await ready;
  await store.dispatch(probeApi.endpoints.probe.initiate(1));
  expect(Object.keys(store.getState().gatewayApi.queries)).toHaveLength(1);

  fake.load(userOf({ subject: "gina-id" }));

  expect(store.getState().gatewayApi.queries).toEqual({});
});
