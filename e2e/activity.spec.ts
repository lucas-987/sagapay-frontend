import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedSession } from "./seeded-session";

const olivia = "00000000-0000-4000-a000-000000000001";
const transferId = "7d1d2a3e-5a0e-4c7a-9a55-0c7a4b1f2e01";

const transfer = {
  id: transferId,
  senderId: "seeded-customer",
  recipientId: olivia,
  amount: { currency: "EUR", amount: "120.00" },
  note: "Dinner last night",
  status: "POSTED",
  createdAt: "2026-11-12T12:00:00Z",
};

test.beforeEach(async ({ page }) => {
  await seedSession(page);
  await page.route("**/v1/transfers?*", (route) =>
    route.fulfill({ json: { items: [transfer], nextCursor: null } }),
  );
  await page.route(`**/v1/transfers/${transferId}`, (route) =>
    route.fulfill({
      json: {
        ...transfer,
        steps: [{ at: "2026-11-12T12:00:01Z", step: "RESERVE", outcome: "OK" }],
      },
    }),
  );
  await page.route("**/v1/users/names?*", (route) =>
    route.fulfill({
      json: { items: [{ accountId: olivia, displayName: "Olivia Martin" }] },
    }),
  );
});

test("opens and closes the transfer drawer from the keyboard and restores focus", async ({
  page,
}) => {
  await page.goto("/activity");
  const row = page.getByRole("button", { name: /Olivia Martin/ });
  await row.focus();

  await page.keyboard.press("Enter");

  const drawer = page.getByRole("dialog", { name: "Transfer details" });
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(`/activity?transfer=${transferId}`);
  await expect(drawer.getByText("Sent to Olivia Martin")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.keyboard.press("Escape");

  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL("/activity");
  await expect(row).toBeFocused();
});

test("reopens the drawer when the page with a transfer in its URL is reloaded", async ({
  page,
}) => {
  await page.goto(`/activity?transfer=${transferId}`);
  const drawer = page.getByRole("dialog", { name: "Transfer details" });
  await expect(drawer.getByText("Sent to Olivia Martin")).toBeVisible();

  await page.reload();

  await expect(drawer.getByText("Sent to Olivia Martin")).toBeVisible();
});

test("has no axe violation with transfers listed", async ({ page }) => {
  await page.goto("/activity");
  await expect(
    page.getByRole("button", { name: /Olivia Martin/ }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
