import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { fakeOidcClient, userOf } from "../test/fake-oidc-client";
import { renderApp } from "../test/render-app";
import { server } from "../test/setup";

const walletUrl = new URL("/v1/wallet", location.origin).toString();

function walletOf(amount: string) {
  return {
    balance: { currency: "EUR", amount },
    available: { currency: "EUR", amount },
    held: { currency: "EUR", amount: "0.00" },
  };
}

describe("M5-S02", () => {
  test("Signing out closes access to the previous customer's activity", async () => {
    server.use(
      http.get(walletUrl, () => HttpResponse.json(walletOf("4285.50"))),
    );
    const user = userEvent.setup();
    const { application } = await renderApp("/activity");
    expect(
      within(
        await screen.findByRole("region", { name: "Your wallet" }),
      ).getAllByText("4,285.50 EUR"),
    ).toHaveLength(2);
    expect(
      Object.keys(application.store.getState().gatewayApi.queries),
    ).toEqual(["getWallet(undefined)"]);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(screen.queryByRole("heading", { name: "Activity" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Your wallet" })).toBeNull();
    expect(screen.queryByText(/4,285\.50/)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Signing you out…");
    expect(application.store.getState().gatewayApi.queries).toEqual({});
  });
});

describe("a second customer after the first", () => {
  const gina = userOf({ subject: "gina-id", name: "Gina Rossi" });

  test.each([
    {
      how: "signs in in place of the first",
      beforeObserving: () => Promise.resolve(),
    },
    {
      how: "signs in after the first signed out",
      beforeObserving: async () => {
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "Account menu" }));
        await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
      },
    },
  ])(
    "shows nothing of the first customer, even briefly, when the second $how",
    async ({ beforeObserving }) => {
      server.use(
        http.get(walletUrl, async ({ request }) => {
          const second =
            request.headers.get("authorization") === "Bearer token-of-gina-id";
          if (second) await delay(60);
          return HttpResponse.json(walletOf(second ? "7.00" : "111.00"));
        }),
      );
      const fake = fakeOidcClient(
        userOf({ subject: "julien-id", name: "Julien Simon" }),
      );
      await renderApp("/activity", { fake });
      await screen.findByRole("region", { name: "Your wallet" });
      await beforeObserving();
      const snapshots: string[] = [];
      const observer = new MutationObserver(() => {
        snapshots.push(document.body.textContent);
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      act(() => {
        fake.load(gina);
      });
      expect(
        within(
          await screen.findByRole("region", { name: "Your wallet" }),
        ).getAllByText("7.00 EUR"),
      ).toHaveLength(2);
      observer.disconnect();

      expect(snapshots.length).toBeGreaterThan(0);
      expect(
        snapshots.filter(
          (text) => text.includes("111.00") || text.includes("Julien Simon"),
        ),
      ).toEqual([]);
      expect(document.body).not.toHaveTextContent("111.00");
      expect(screen.getByRole("banner")).toHaveTextContent("Gina Rossi");
    },
  );
});
