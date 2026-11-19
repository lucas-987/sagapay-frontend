import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { findLowContrastText } from "./text-contrast";

const routes = [
  {
    path: "activity",
    label: "Activity",
    description: "Transfer activity is coming soon.",
  },
  {
    path: "send",
    label: "Send money",
    description: "Sending money is coming soon.",
  },
] as const;

const headerScreenshotStyle = fileURLToPath(
  new URL("./reference/header.css", import.meta.url),
);

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 960 },
] as const;

function navigation(page: Page) {
  return page.getByRole("navigation", { name: "Main navigation", exact: true });
}

function themeSwitch(page: Page, theme: "light" | "dark") {
  const nextTheme = theme === "light" ? "dark" : "light";
  return page.getByRole("button", {
    name: `Switch to ${nextTheme} theme`,
    exact: true,
  });
}

async function expectActivePage(page: Page, path: string, label: string) {
  await expect(page).toHaveURL(`/${path}`);
  await expect(
    page.getByRole("heading", { level: 1, name: label, exact: true }),
  ).toBeVisible();
  const activeLink = navigation(page).locator('[aria-current="page"]');
  await expect(activeLink).toHaveText([label]);
  await expect(activeLink).toHaveAttribute("href", `/${path}`);
}

async function expectKeyboardOrder(page: Page, controls: readonly Locator[]) {
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("button")).toHaveCount(1);
  await expect(banner.getByRole("link")).toHaveCount(2);

  const positions = [];
  for (const control of controls) {
    await expect(control).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Tab");
    await expect(control).toBeFocused();
    await expect(control).toHaveCSS("outline-style", "solid");
    await expect(control).toHaveCSS("outline-width", "2px");
    const foreground = await control.evaluate(
      (element) => getComputedStyle(element).color,
    );
    expect(foreground).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    await expect(control).toHaveCSS("outline-color", foreground);
    expect(
      await control.evaluate((element) => element.matches(":focus-visible")),
    ).toBe(true);
    positions.push(
      await control.evaluate((element) => {
        const { left, top, height } = element.getBoundingClientRect();
        return { left, centerY: top + height / 2 };
      }),
    );
  }

  for (let index = 1; index < positions.length; index += 1) {
    const previous = positions[index - 1];
    const current = positions[index];
    if (!previous || !current)
      throw new Error("A keyboard control has no visual position");
    expect(
      current.centerY > previous.centerY + 2 ||
        (Math.abs(current.centerY - previous.centerY) <= 2 &&
          current.left > previous.left),
    ).toBe(true);
  }
}

for (const { path, label } of routes) {
  test(`opens /${path} directly and keeps it on reload`, async ({ page }) => {
    const initialResponse = await page.goto(`/${path}`);
    expect(initialResponse?.status()).toBe(200);
    await expectActivePage(page, path, label);

    const reloadResponse = await page.reload();
    expect(reloadResponse?.status()).toBe(200);
    await expectActivePage(page, path, label);
  });
}

test("follows router links and restores Activity on browser Back", async ({
  page,
}) => {
  await page.goto("/");
  await expectActivePage(page, "activity", "Activity");
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);

  await navigation(page)
    .getByRole("link", { name: "Send money", exact: true })
    .click();
  await expectActivePage(page, "send", "Send money");
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);

  await navigation(page)
    .getByRole("link", { name: "Activity", exact: true })
    .click();
  await expectActivePage(page, "activity", "Activity");
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);

  await page.goBack();
  await expectActivePage(page, "send", "Send money");
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
  await page.goBack();
  await expectActivePage(page, "activity", "Activity");
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin);
});

test("reports text below WCAG AA beside compliant text", async ({ page }) => {
  await page.setContent(`
    <body style="background: linear-gradient(white, white)">
      <p style="color: #aaa">Low contrast</p>
      <p style="color: #000">High contrast</p>
    </body>
  `);

  const result = await findLowContrastText(page);
  expect(result.text).toEqual(["Low contrast", "High contrast"]);
  expect(result.violations).toEqual([
    {
      text: "Low contrast",
      ratio: expect.closeTo(2.323, 3),
      required: 4.5,
      foreground: "rgb(170, 170, 170)",
      background: [255, 255, 255],
    },
  ]);
});

test("keeps the chosen theme across reloads and switches it back", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/activity");

  await themeSwitch(page, "light").click();
  await expect(themeSwitch(page, "dark")).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");

  await page.reload();
  await expect(themeSwitch(page, "dark")).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");

  await themeSwitch(page, "dark").click();
  await expect(themeSwitch(page, "light")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await expect(themeSwitch(page, "light")).toBeVisible();
});

test("runs no shell animations or transitions when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/activity");
  await themeSwitch(page, "light").hover();
  await themeSwitch(page, "light").click();
  await expect(themeSwitch(page, "dark")).toBeVisible();

  const motion = await page.evaluate(() => ({
    animations: document.getAnimations().length,
    transitions: Array.from(document.querySelectorAll("#root *"))
      .flatMap((element) =>
        [null, "::before", "::after"].map((pseudo) =>
          getComputedStyle(element, pseudo),
        ),
      )
      .filter((style) =>
        style.transitionDuration
          .split(",")
          .some((time) => Number.parseFloat(time) > 0),
      )
      .map((style) => style.transitionDuration),
  }));
  expect(motion).toEqual({ animations: 0, transitions: [] });
});

test.describe("narrow header", () => {
  test.use({ colorScheme: "light", viewport: { width: 320, height: 700 } });

  test("keeps keyboard order aligned with its wrapped visual layout", async ({
    page,
  }) => {
    await page.goto("/activity");
    await expectKeyboardOrder(page, [
      navigation(page).getByRole("link", { name: "Activity", exact: true }),
      navigation(page).getByRole("link", { name: "Send money", exact: true }),
      themeSwitch(page, "light"),
    ]);
  });
});

for (const { name, width, height } of viewports) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`${name} ${theme}`, () => {
      test.use({
        colorScheme: theme,
        viewport: { width, height },
        reducedMotion: "reduce",
      });

      for (const { path, label, description } of routes) {
        test.describe(label, () => {
          test.beforeEach(async ({ page }) => {
            await page.goto(`/${path}`);
            await expectActivePage(page, path, label);
          });

          test("matches the reference header", async ({ page }) => {
            const header = page.getByRole("banner");
            const mask = header.locator("[data-account-summary]");
            await expect(mask).toBeVisible();
            await expect(header).toHaveScreenshot(
              `header-${path}-${theme}-${name}.png`,
              {
                mask: [mask],
                stylePath: headerScreenshotStyle,
                threshold: 0.15,
                maxDiffPixelRatio: 0.01,
              },
            );
          });

          test("has no axe violations", async ({ page }) => {
            const results = await new AxeBuilder({ page }).analyze();
            expect(results.violations).toEqual([]);
          });

          test("renders text at WCAG AA contrast", async ({ page }) => {
            const results = await findLowContrastText(page);
            expect(results.text).toEqual([
              "Activity",
              "Send money",
              ...(name === "desktop" ? ["Personal account"] : []),
              label,
              description,
            ]);
            expect(results.violations).toEqual([]);
          });

          test("keeps all shell controls in visible keyboard order", async ({
            page,
          }) => {
            await expectKeyboardOrder(page, [
              navigation(page).getByRole("link", {
                name: "Activity",
                exact: true,
              }),
              navigation(page).getByRole("link", {
                name: "Send money",
                exact: true,
              }),
              themeSwitch(page, theme),
            ]);
          });
        });
      }
    });
  }
}
