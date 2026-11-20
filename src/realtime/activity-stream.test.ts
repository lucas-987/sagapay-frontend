import type { Middleware, UnknownAction } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { gatewayApi } from "../api/gateway-api";
import { createAppStore } from "../app/store";
import { sessionEnded } from "../auth/session-lifecycle";
import { server } from "../test/setup";
import { serveStream, type StreamConnection } from "../test/stream-server";
import { activityEventReceived, streamRequested } from "./activity-stream";

const transferA = "7d1d2a3e-5a0e-4c7a-9a55-0c7a4b1f2e01";
const transferB = "7d1d2a3e-5a0e-4c7a-9a55-0c7a4b1f2e02";
const sender = "00000000-0000-4000-a000-000000000001";
const recipient = "00000000-0000-4000-a000-000000000002";

interface WalletBody {
  balance: { currency: string; amount: string };
  available: { currency: string; amount: string };
  held: { currency: string; amount: string };
}

interface TransferBody {
  id: string;
  status: string;
}

const probeApi = gatewayApi.injectEndpoints({
  endpoints: (build) => ({
    wallet: build.query<WalletBody, undefined>({
      query: () => "/v1/wallet",
      providesTags: ["Wallet"],
    }),
    list: build.query<{ items: TransferBody[] }, undefined>({
      query: () => "/v1/transfers",
      providesTags: ["Activity"],
    }),
    detail: build.query<TransferBody, string>({
      query: (id) => `/v1/transfers/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Transfer", id }],
    }),
  }),
});

const fast = {
  reconnect: { initialDelayMs: 2, maxDelayMs: 8 },
  random: () => 1,
};

function eventData(transferId: string, extra: object = {}) {
  return {
    transferId,
    senderId: sender,
    recipientId: recipient,
    amount: "25.00",
    currency: "EUR",
    ...extra,
  };
}

function walletBody(amount: string) {
  return {
    balance: { currency: "EUR", amount },
    available: { currency: "EUR", amount },
    held: { currency: "EUR", amount: "0.00" },
  };
}

function transferBody(id: string, status: string) {
  return {
    id,
    senderId: sender,
    recipientId: recipient,
    amount: { currency: "EUR", amount: "25.00" },
    status,
    createdAt: "2026-11-12T12:00:00Z",
  };
}

function serveRest() {
  const served = {
    balance: "10.00",
    status: "INITIATED",
    walletReads: 0,
    listReads: 0,
    detailReads: { [transferA]: 0, [transferB]: 0 } as Record<string, number>,
  };
  server.use(
    http.get("*/v1/wallet", () => {
      served.walletReads += 1;
      return HttpResponse.json(walletBody(served.balance));
    }),
    http.get("*/v1/transfers", () => {
      served.listReads += 1;
      return HttpResponse.json({
        items: [transferBody(transferA, served.status)],
        nextCursor: null,
      });
    }),
    http.get("*/v1/transfers/:id", ({ params }) => {
      const id = String(params.id);
      served.detailReads[id] = (served.detailReads[id] ?? 0) + 1;
      return HttpResponse.json(transferBody(id, served.status));
    }),
  );
  return served;
}

function newSession(tokens: (string | null)[] = ["token-1"]) {
  let reads = 0;
  return {
    getAccessToken: vi.fn(() => {
      const token = tokens[Math.min(reads, tokens.length - 1)] ?? null;
      reads += 1;
      return Promise.resolve(token);
    }),
  };
}

function newStore({
  session = newSession(),
  stream = fast,
}: {
  session?: ReturnType<typeof newSession>;
  stream?: Parameters<typeof createAppStore>[0]["stream"];
} = {}) {
  const actions: UnknownAction[] = [];
  const recorder: Middleware = () => (next) => (action) => {
    actions.push(action as UnknownAction);
    return next(action);
  };
  const store = createAppStore({ session, stream, middleware: [recorder] });
  return { store, session, actions };
}

type Store = ReturnType<typeof newStore>["store"];

function subscribeToEverything(store: Store) {
  void store.dispatch(probeApi.endpoints.wallet.initiate(undefined));
  void store.dispatch(probeApi.endpoints.list.initiate(undefined));
  void store.dispatch(probeApi.endpoints.detail.initiate(transferA));
  void store.dispatch(probeApi.endpoints.detail.initiate(transferB));
}

async function connected(connections: StreamConnection[], count = 1) {
  await vi.waitFor(() => {
    expect(connections).toHaveLength(count);
  });
  const connection = connections[count - 1];
  if (connection === undefined) throw new Error("no connection");
  return connection;
}

function walletOf(store: Store) {
  return probeApi.endpoints.wallet.select(undefined)(store.getState()).data;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("activity stream middleware", () => {
  test("opens no connection until the stream is requested", async () => {
    const { connections } = serveStream();
    newStore();

    await new Promise((resolve) => setImmediate(resolve));

    expect(connections).toHaveLength(0);
  });

  test("reads the stream with the bearer token and the event-stream media type", async () => {
    const { connections } = serveStream();
    const { store } = newStore({ session: newSession(["token-1"]) });

    store.dispatch(streamRequested());

    const connection = await connected(connections);
    expect(connection.authorization).toBe("Bearer token-1");
    expect(connection.accept).toBe("text/event-stream");
  });

  test("opens one connection when the stream is requested twice", async () => {
    const { connections } = serveStream();
    const { store } = newStore();

    store.dispatch(streamRequested());
    store.dispatch(streamRequested());
    await connected(connections);

    await new Promise((resolve) => setImmediate(resolve));
    expect(connections).toHaveLength(1);
  });

  test("keeps the stream open while the tab is hidden", async () => {
    const { connections } = serveStream();
    const { store } = newStore();
    store.dispatch(streamRequested());
    const connection = await connected(connections);

    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));

    await new Promise((resolve) => setImmediate(resolve));
    expect(connection.aborted).toBe(false);
    expect(connections).toHaveLength(1);
  });

  test.each([
    {
      event: "transfer.posted",
      data: eventData(transferA),
      reads: { wallet: 2, list: 2, a: 2 },
    },
    {
      event: "transfer.failed",
      data: eventData(transferA, { cause: "INSUFFICIENT_FUNDS" }),
      reads: { wallet: 2, list: 2, a: 2 },
    },
    {
      event: "transfer.blocked",
      data: eventData(transferA, {
        confirmationDeadline: "2026-11-12T12:05:00Z",
      }),
      reads: { wallet: 1, list: 2, a: 2 },
    },
  ])(
    "$event reads again the entries it affects and no other",
    async ({ event, data, reads }) => {
      const served = serveRest();
      const { connections } = serveStream();
      const { store } = newStore();
      subscribeToEverything(store);
      await vi.waitFor(() => {
        expect(walletOf(store)).toBeDefined();
        expect(served.detailReads[transferB]).toBe(1);
      });
      store.dispatch(streamRequested());
      const connection = await connected(connections);

      connection.push(event, data);

      await vi.waitFor(() => {
        expect(served.listReads).toBe(reads.list);
        expect(served.detailReads[transferA]).toBe(reads.a);
        expect(served.walletReads).toBe(reads.wallet);
      });
      expect(served.detailReads[transferB]).toBe(1);
    },
  );

  test("shows the new balance and status after a posted event", async () => {
    const served = serveRest();
    const { connections } = serveStream();
    const { store } = newStore();
    subscribeToEverything(store);
    await vi.waitFor(() => {
      expect(walletOf(store)?.balance.amount).toBe("10.00");
    });
    store.dispatch(streamRequested());
    const connection = await connected(connections);
    served.balance = "35.00";
    served.status = "POSTED";

    connection.push("transfer.posted", eventData(transferA));

    await vi.waitFor(() => {
      expect(walletOf(store)?.balance.amount).toBe("35.00");
      expect(
        probeApi.endpoints.detail.select(transferA)(store.getState()).data
          ?.status,
      ).toBe("POSTED");
    });
  });

  test("dispatches the blocked event with its deadline", async () => {
    serveRest();
    const { connections } = serveStream();
    const { store, actions } = newStore();
    store.dispatch(streamRequested());
    const connection = await connected(connections);

    connection.push(
      "transfer.blocked",
      eventData(transferA, { confirmationDeadline: "2026-11-12T12:05:00Z" }),
      "event-1",
    );

    await vi.waitFor(() => {
      expect(
        actions.filter(activityEventReceived.match).map((a) => a.payload),
      ).toEqual([
        {
          type: "transfer.blocked",
          id: "event-1",
          ...eventData(transferA),
          confirmationDeadline: "2026-11-12T12:05:00Z",
        },
      ]);
    });
  });

  test("leaves the same state when an event arrives twice as when it arrives once", async () => {
    const served = serveRest();
    const { connections } = serveStream();
    const { store } = newStore();
    subscribeToEverything(store);
    await vi.waitFor(() => {
      expect(walletOf(store)).toBeDefined();
    });
    store.dispatch(streamRequested());
    const connection = await connected(connections);
    served.balance = "35.00";

    connection.push("transfer.posted", eventData(transferA), "event-1");
    connection.push("transfer.posted", eventData(transferA), "event-1");

    await vi.waitFor(() => {
      expect(walletOf(store)).toEqual({
        balance: { currency: "EUR", amount: "35.00" },
        available: { currency: "EUR", amount: "35.00" },
        held: { currency: "EUR", amount: "0.00" },
      });
    });
    await new Promise((resolve) => setImmediate(resolve));
    const statuses = Object.values(store.getState().gatewayApi.queries).map(
      (query) => String(query?.status),
    );
    expect(statuses.every((status) => status === "fulfilled")).toBe(true);
  });

  test("drops malformed and unknown events and keeps the stream open", async () => {
    const served = serveRest();
    const { connections } = serveStream();
    const { store, actions } = newStore();
    subscribeToEverything(store);
    await vi.waitFor(() => {
      expect(walletOf(store)).toBeDefined();
    });
    store.dispatch(streamRequested());
    const connection = await connected(connections);

    connection.push("transfer.posted", "{not json");
    connection.push("transfer.created", eventData(transferA));
    connection.push("transfer.posted", { transferId: transferA });
    connection.comment("ping");
    connection.push("transfer.posted", eventData(transferA), "valid");

    await vi.waitFor(() => {
      expect(served.walletReads).toBe(2);
    });
    expect(
      actions.filter(activityEventReceived.match).map((a) => a.payload.id),
    ).toEqual(["valid"]);
    expect(connection.aborted).toBe(false);
    expect(connections).toHaveLength(1);
  });

  test.each([
    {
      how: "is cut",
      end: (c: StreamConnection) => {
        c.cut();
      },
    },
    {
      how: "is closed by the server",
      end: (c: StreamConnection) => {
        c.close();
      },
    },
  ])(
    "reconnects and reads again wallet, activity and the open detail when the stream $how",
    async ({ end }) => {
      const served = serveRest();
      const { connections } = serveStream();
      const { store } = newStore();
      subscribeToEverything(store);
      await vi.waitFor(() => {
        expect(walletOf(store)).toBeDefined();
      });
      store.dispatch(streamRequested());
      const first = await connected(connections);
      served.balance = "35.00";
      served.status = "POSTED";

      end(first);

      await connected(connections, 2);
      await vi.waitFor(() => {
        expect(walletOf(store)?.balance.amount).toBe("35.00");
        expect(served.listReads).toBe(2);
        expect(served.detailReads[transferA]).toBe(2);
      });
    },
  );

  test("reads nothing again when the first connection opens", async () => {
    const served = serveRest();
    const { connections } = serveStream();
    const { store } = newStore();
    subscribeToEverything(store);
    await vi.waitFor(() => {
      expect(walletOf(store)).toBeDefined();
    });

    store.dispatch(streamRequested());
    await connected(connections);

    await new Promise((resolve) => setImmediate(resolve));
    expect([served.walletReads, served.listReads]).toEqual([1, 1]);
  });

  test("uses the current token for each connection", async () => {
    const { connections } = serveStream();
    const session = newSession(["token-1", "token-2", "token-3"]);
    const { store } = newStore({ session });
    serveRest();

    store.dispatch(streamRequested());
    (await connected(connections)).cut();
    (await connected(connections, 2)).close();
    await connected(connections, 3);

    expect(connections.map((c) => c.authorization)).toEqual([
      "Bearer token-1",
      "Bearer token-2",
      "Bearer token-3",
    ]);
  });

  test("retries when the gateway refuses the connection, then reads again", async () => {
    const served = serveRest();
    let token = "old";
    const { connections } = serveStream((attempt) => {
      token = "new";
      return attempt === 0 ? 401 : 200;
    });
    const { store } = newStore({
      session: {
        getAccessToken: vi.fn(() => Promise.resolve(token)),
      },
    });
    subscribeToEverything(store);
    await vi.waitFor(() => {
      expect(walletOf(store)).toBeDefined();
    });

    store.dispatch(streamRequested());

    await connected(connections, 2);
    await vi.waitFor(() => {
      expect(served.walletReads).toBe(2);
    });
    expect(connections.map((c) => c.authorization)).toEqual([
      "Bearer old",
      "Bearer new",
    ]);
  });

  test("treats a session that cannot give a token as having none", async () => {
    const { connections } = serveStream();
    let reads = 0;
    const session = {
      getAccessToken: vi.fn(() => {
        reads += 1;
        return reads === 1
          ? Promise.reject(new Error("session unavailable"))
          : Promise.resolve("token-2");
      }),
    };
    const { store } = newStore({ session });

    store.dispatch(streamRequested());

    const connection = await connected(connections);
    expect(connection.authorization).toBe("Bearer token-2");
    expect(connections).toHaveLength(1);
  });

  test("makes no request while there is no token and connects when there is one", async () => {
    const { connections } = serveStream();
    const { store, session } = newStore({
      session: newSession([null, "token-2"]),
    });

    store.dispatch(streamRequested());

    const connection = await connected(connections);
    expect(session.getAccessToken).toHaveBeenCalledTimes(2);
    expect(connection.authorization).toBe("Bearer token-2");
  });

  describe("with timers under control", () => {
    const reconnect = { initialDelayMs: 100, maxDelayMs: 400 };
    const settle = () => new Promise((resolve) => setImmediate(resolve));

    async function untilConnections(
      connections: StreamConnection[],
      count: number,
    ) {
      for (let i = 0; i < 50 && connections.length < count; i += 1) {
        await settle();
      }
    }

    async function expectDelayBefore(
      connections: StreamConnection[],
      delay: number,
    ) {
      const before = connections.length;
      await vi.advanceTimersByTimeAsync(delay - 1);
      await settle();
      expect(connections).toHaveLength(before);
      await vi.advanceTimersByTimeAsync(1);
      await untilConnections(connections, before + 1);
      expect(connections).toHaveLength(before + 1);
    }

    test("waits longer after each failed attempt, never more than the maximum", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const { connections } = serveStream((attempt) =>
        attempt === 0 ? 200 : 503,
      );
      const { store } = newStore({ stream: { reconnect, random: () => 1 } });
      store.dispatch(streamRequested());
      await untilConnections(connections, 1);
      connections[0]?.cut();
      await settle();

      for (const delay of [100, 200, 400, 400, 400]) {
        await expectDelayBefore(connections, delay);
      }
    });

    test("starts again from the initial delay after a connection that opened", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const { connections } = serveStream((attempt) =>
        attempt === 0 || attempt === 3 ? 200 : 503,
      );
      const { store } = newStore({ stream: { reconnect, random: () => 1 } });
      store.dispatch(streamRequested());
      await untilConnections(connections, 1);
      connections[0]?.cut();
      await settle();
      for (const delay of [100, 200, 400]) {
        await expectDelayBefore(connections, delay);
      }

      connections[3]?.cut();
      await settle();

      await expectDelayBefore(connections, 100);
    });
  });

  test("aborts the stream when the session ends and requests nothing afterwards", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { connections } = serveStream();
    const { store, session } = newStore();
    store.dispatch(streamRequested());
    const connection = await connected(connections);

    store.dispatch(sessionEnded());

    await vi.waitFor(() => {
      expect(connection.aborted).toBe(true);
    });
    const reads = session.getAccessToken.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(connections).toHaveLength(1);
    expect(session.getAccessToken).toHaveBeenCalledTimes(reads);
  });

  test("cancels a reconnection that is waiting when the session ends", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { connections } = serveStream();
    const { store, session } = newStore({
      stream: {
        reconnect: { initialDelayMs: 100, maxDelayMs: 100 },
        random: () => 1,
      },
    });
    store.dispatch(streamRequested());
    (await connected(connections)).cut();
    await vi.waitFor(() => {
      expect(session.getAccessToken).toHaveBeenCalledTimes(1);
    });

    store.dispatch(sessionEnded());

    await vi.advanceTimersByTimeAsync(1000);
    expect(connections).toHaveLength(1);
  });

  test("does not use a token read before the session ended", async () => {
    const { connections } = serveStream();
    let release: (token: string) => void = () => undefined;
    const session = {
      getAccessToken: vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            release = resolve;
          }),
      ),
    };
    const { store } = newStore({ session });
    store.dispatch(streamRequested());
    await vi.waitFor(() => {
      expect(session.getAccessToken).toHaveBeenCalledTimes(1);
    });

    store.dispatch(sessionEnded());
    release("previous-token");
    store.dispatch(streamRequested());
    await vi.waitFor(() => {
      expect(session.getAccessToken).toHaveBeenCalledTimes(2);
    });
    release("fresh-token");

    const connection = await connected(connections);
    expect(connection.authorization).toBe("Bearer fresh-token");
    expect(connections).toHaveLength(1);
  });

  test("opens a new stream when it is requested after the session ended", async () => {
    const { connections } = serveStream();
    const { store } = newStore({ session: newSession(["first", "second"]) });
    store.dispatch(streamRequested());
    await connected(connections);
    store.dispatch(sessionEnded());

    store.dispatch(streamRequested());

    const second = await connected(connections, 2);
    expect(second.authorization).toBe("Bearer second");
  });
});
