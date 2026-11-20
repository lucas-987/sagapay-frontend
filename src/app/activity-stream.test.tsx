import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fakeOidcClient, userOf } from "../test/fake-oidc-client";
import { renderApp } from "../test/render-app";
import { server } from "../test/setup";
import { serveStream } from "../test/stream-server";

const olivia = "00000000-0000-4000-a000-000000000001";
const transferId = "7d1d2a3e-5a0e-4c7a-9a55-0c7a4b1f2e01";

function walletOf(amount: string) {
  return {
    balance: { currency: "EUR", amount },
    available: { currency: "EUR", amount },
    held: { currency: "EUR", amount: "0.00" },
  };
}

function serveActivity() {
  const served = { balance: "10.00", items: [] as object[] };
  server.use(
    http.get("*/v1/wallet", () => HttpResponse.json(walletOf(served.balance))),
    http.get("*/v1/transfers", () =>
      HttpResponse.json({ items: served.items, nextCursor: null }),
    ),
    http.get("*/v1/users/names", () =>
      HttpResponse.json({
        items: [{ accountId: olivia, displayName: "Olivia Martin" }],
      }),
    ),
  );
  return served;
}

afterEach(() => {
  vi.useRealTimers();
});

const reconnect = { initialDelayMs: 2, maxDelayMs: 8 };

describe("the activity stream of the signed-in customer", () => {
  test("opens with the customer's token once the session is known", async () => {
    serveActivity();
    const { connections } = serveStream();

    await renderApp("/activity", { stream: { reconnect } });

    await vi.waitFor(() => {
      expect(connections.map((c) => c.authorization)).toEqual([
        "Bearer token-of-julien-id",
      ]);
    });
  });

  test("does not open for a visitor who is signed out", async () => {
    const { connections } = serveStream();
    const fake = fakeOidcClient(null);

    await renderApp("/activity", { fake, stream: { reconnect } });

    await new Promise((resolve) => setImmediate(resolve));
    expect(connections).toHaveLength(0);
  });

  test("shows a transfer completed while the connection was down once it is restored", async () => {
    const served = serveActivity();
    const { connections } = serveStream();
    await renderApp("/activity", { stream: { reconnect } });
    const region = await screen.findByRole("region", { name: "Your wallet" });
    expect(within(region).getAllByText("10.00 EUR")).toHaveLength(2);
    await vi.waitFor(() => {
      expect(connections).toHaveLength(1);
    });

    served.balance = "35.00";
    served.items = [
      {
        id: transferId,
        senderId: olivia,
        recipientId: "julien-id",
        amount: { currency: "EUR", amount: "25.00" },
        status: "POSTED",
        createdAt: "2026-11-12T12:00:00Z",
      },
    ];
    connections[0]?.cut();

    expect(await screen.findByText("Olivia Martin")).toBeVisible();
    expect(await screen.findAllByText("35.00 EUR")).toHaveLength(2);
  });

  test("aborts on sign-out and makes no request with the previous token afterwards", async () => {
    serveActivity();
    const { connections } = serveStream();
    const user = userEvent.setup();
    await renderApp("/activity", { stream: { reconnect } });
    await vi.waitFor(() => {
      expect(connections).toHaveLength(1);
    });
    const requests: (string | null)[] = [];
    server.events.on("request:start", ({ request }) => {
      requests.push(request.headers.get("authorization"));
    });

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await vi.waitFor(() => {
      expect(connections[0]?.aborted).toBe(true);
    });
    await vi.advanceTimersByTimeAsync(1000);
    server.events.removeAllListeners();
    expect(connections).toHaveLength(1);
    expect(requests).toEqual([]);
  });

  test("replaces the first customer's stream with the second customer's", async () => {
    serveActivity();
    const { connections } = serveStream();
    const fake = fakeOidcClient(
      userOf({ subject: "julien-id", name: "Julien Simon" }),
    );
    await renderApp("/activity", { fake, stream: { reconnect } });
    await vi.waitFor(() => {
      expect(connections).toHaveLength(1);
    });

    act(() => {
      fake.load(userOf({ subject: "gina-id", name: "Gina Rossi" }));
    });

    await vi.waitFor(() => {
      expect(connections).toHaveLength(2);
    });
    expect(connections[0]?.aborted).toBe(true);
    expect(connections[1]?.authorization).toBe("Bearer token-of-gina-id");
  });

  test("keeps its stream when the same customer's token is renewed", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    serveActivity();
    const { connections } = serveStream();
    const fake = fakeOidcClient(userOf({ subject: "julien-id" }));
    await renderApp("/activity", { fake, stream: { reconnect } });
    await vi.waitFor(() => {
      expect(connections).toHaveLength(1);
    });

    act(() => {
      fake.load(userOf({ subject: "julien-id", token: "renewed" }));
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(connections).toHaveLength(1);
    expect(connections[0]?.aborted).toBe(false);
  });
});
