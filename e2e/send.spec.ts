import { expect, test } from "@playwright/test";
import { availableCents, openAs } from "./stack-customers";

test.use({ trace: "off" });

test.describe("M5-S03", () => {
  test("Both customers see a completed transfer and their updated wallets", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    if (!baseURL) throw new Error("Set SAGAPAY_BASE_URL for the browser stack");
    const gina = await openAs(browser, baseURL, "gina", "/activity");
    const julien = await openAs(browser, baseURL, "julien", "/activity");
    const ginaBefore = await availableCents(gina);
    const julienBefore = await availableCents(julien);
    await julien.getByRole("link", { name: "Send money" }).first().click();
    await expect(julien).toHaveURL("/send");

    await julien.getByRole("combobox", { name: "Recipient" }).fill("gina");
    const option = julien.getByRole("option", { name: /@gina$/ });
    const ginaName = (await option.innerText()).split("\n")[0] ?? "";
    await option.click();
    await julien.getByRole("textbox", { name: "Amount" }).fill("1.00");
    await julien.getByRole("button", { name: "Send money" }).click();

    await expect(
      julien.getByRole("list", { name: "Transfer progress" }),
    ).toContainText("Sent Confirmed");
    await julien.getByRole("link", { name: "View transfer details" }).click();
    const drawer = julien.getByRole("dialog", { name: "Transfer details" });
    await expect(drawer.getByText(`Sent to ${ginaName}`)).toBeVisible();
    await expect(drawer.getByText("Completed")).toBeVisible();
    await expect(
      gina.getByRole("button", { name: /Julien Simon/ }).first(),
    ).toContainText("Completed");
    await expect.poll(() => availableCents(julien)).toBe(julienBefore - 100);
    await expect.poll(() => availableCents(gina)).toBe(ginaBefore + 100);
  });
});
