import { expect, test } from "@playwright/test";
import { passwordOf } from "./sagapay-session";

test.describe("M5-S01", () => {
  test("A customer signs in and returns to their requested page", async ({
    page,
  }) => {
    await page.goto("/activity");

    await page.getByLabel(/username/i).fill("julien");
    await page
      .getByLabel("Password", { exact: true })
      .fill(passwordOf("julien"));
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(page).toHaveURL("/activity");
    await expect(
      page.getByRole("heading", { level: 1, name: "Activity", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("banner")).toContainText("Julien Simon");
    const wallet = page.getByRole("region", { name: "Your wallet" });
    await expect(wallet).toBeVisible();
    await expect(wallet.getByText("Available balance")).toBeVisible();
    await expect(wallet.getByText(/^[\d,]+\.\d{2} EUR$/)).toHaveCount(3);
  });
});
