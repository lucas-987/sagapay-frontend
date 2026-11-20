import { type Browser, type Page, expect } from "@playwright/test";
import { passwordOf } from "./sagapay-session";

export async function openAs(
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

export async function availableCents(page: Page): Promise<number> {
  const wallet = page.getByRole("region", { name: "Your wallet" });
  const headline = await wallet
    .getByText(/^[\d,]+\.\d{2} EUR$/)
    .first()
    .innerText();
  return Math.round(Number(headline.replace(/[^\d.]/g, "")) * 100);
}
