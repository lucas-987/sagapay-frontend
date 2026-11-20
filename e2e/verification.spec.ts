import { expect, test } from "@playwright/test";
import { openAs } from "./stack-customers";

test.use({ trace: "off" });

function verificationCode(): string {
  const code = process.env.SAGAPAY_FRAUD_VERIFICATION_CODE;
  if (!code) {
    throw new Error(
      "Set SAGAPAY_FRAUD_VERIFICATION_CODE for the browser stack",
    );
  }
  return code;
}

test.describe("M5-S09", () => {
  test("Only the sender can see the live confirmation deadline and verify the transfer", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    if (!baseURL) throw new Error("Set SAGAPAY_BASE_URL for the browser stack");
    const code = verificationCode();
    const julien = await openAs(browser, baseURL, "julien", "/activity");
    const gina = await openAs(browser, baseURL, "gina", "/send");

    await gina.getByRole("combobox", { name: "Recipient" }).fill("julien");
    await gina.getByRole("option", { name: /@julien$/ }).click();
    await gina.getByRole("textbox", { name: "Amount" }).fill("500.00");
    await gina.getByRole("button", { name: "Send money" }).click();

    const prompt = gina.getByRole("region", { name: "Verification required" });
    await expect(
      prompt.getByRole("timer", { name: "Time left to verify" }),
    ).toHaveText(/^\d+:\d{2}$/);
    await julien.getByRole("button", { name: /Verification needed/ }).click();
    const drawer = julien.getByRole("dialog", { name: "Transfer details" });
    await expect(drawer.getByText("Verification needed")).toBeVisible();
    await expect(
      julien.getByRole("region", { name: "Verification required" }),
    ).toHaveCount(0);
    await expect(julien.getByRole("timer")).toHaveCount(0);
    await expect(
      julien.getByRole("button", { name: "Confirm transfer" }),
    ).toHaveCount(0);

    await prompt.getByRole("textbox", { name: "Verification code" }).fill(code);
    await prompt.getByRole("button", { name: "Confirm transfer" }).click();

    await expect(
      gina.getByRole("list", { name: "Transfer progress" }),
    ).toContainText("Sent Confirmed");
    await expect(prompt).toHaveCount(0);
    await expect(drawer.getByText("Completed")).toBeVisible();
  });
});
