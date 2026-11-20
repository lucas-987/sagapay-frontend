import { expect, test, type Browser, type Page } from "@playwright/test";
import { passwordOf } from "./sagapay-session";

test.use({ trace: "off" });

async function openAs(
  browser: Browser,
  baseURL: string,
  username: "julien" | "gina",
  path: string,
): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto(path);
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(passwordOf(username));
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(path);
  return page;
}

async function availableCents(page: Page): Promise<number> {
  const wallet = page.getByRole("region", { name: "Your wallet" });
  const headline = await wallet
    .getByText(/^[\d,]+\.\d{2} EUR$/)
    .first()
    .innerText();
  return Math.round(Number(headline.replace(/[^\d.]/g, "")) * 100);
}

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
