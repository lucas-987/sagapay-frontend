import { expect, test } from "@playwright/test";
import { seededWallet, seedSession } from "./seeded-session";

const olivia = "00000000-0000-4000-a000-000000000001";

const creditedTransfer = {
  id: "7d1d2a3e-5a0e-4c7a-9a55-0c7a4b1f2e01",
  senderId: olivia,
  recipientId: "seeded-customer",
  amount: { currency: "EUR", amount: "25.00" },
  status: "POSTED",
  createdAt: "2026-11-12T12:00:00Z",
};

test.describe("M5-S13", () => {
  test("Activity catches up with a transfer completed while disconnected", async ({
    page,
  }) => {
    await seedSession(page);
    let served = {
      wallet: seededWallet,
      items: [] as object[],
    };
    let networkBlocked = true;
    let blockedAttempts = 0;
    await page.route("**/v1/wallet", (route) =>
      route.fulfill({ json: served.wallet }),
    );
    await page.route("**/v1/transfers?*", (route) =>
      route.fulfill({ json: { items: served.items, nextCursor: null } }),
    );
    await page.route("**/v1/users/names?*", (route) =>
      route.fulfill({
        json: { items: [{ accountId: olivia, displayName: "Olivia Martin" }] },
      }),
    );
    await page.route("**/v1/stream/activity", (route) => {
      if (networkBlocked) {
        blockedAttempts += 1;
        return route.abort("connectionrefused");
      }
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: ": open\n\n",
      });
    });

    await page.goto("/activity");
    const wallet = page.getByRole("region", { name: "Your wallet" });
    await expect(wallet).toContainText("4,285.50 EUR");
    await expect.poll(() => blockedAttempts).toBeGreaterThan(0);

    served = {
      wallet: {
        ...seededWallet,
        balance: { currency: "EUR", amount: "4430.50" },
        available: { currency: "EUR", amount: "4310.50" },
      },
      items: [creditedTransfer],
    };
    networkBlocked = false;

    await expect(
      page.getByRole("button", { name: /Olivia Martin/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(wallet).toContainText("4,310.50 EUR");
  });
});
