import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { server } from "../../test/setup";
import { renderApp } from "../../test/render-app";

const walletUrl = new URL("/v1/wallet", location.origin).toString();

function renderActivity() {
  server.use(
    http.get("*/v1/transfers", () =>
      HttpResponse.json({ items: [], nextCursor: null }),
    ),
  );
  return renderApp("/activity");
}

function walletBody({
  balance,
  available,
  held,
  currency = "EUR",
}: {
  balance: string;
  available: string;
  held: string;
  currency?: string;
}) {
  return {
    accountId: "00000000-0000-4000-a000-000000000010",
    currency,
    balance: { currency, amount: balance },
    available: { currency, amount: available },
    held: { currency, amount: held },
  };
}

test("shows a loading status while the wallet is being read", async () => {
  server.use(
    http.get(walletUrl, async () => {
      await delay(50);
      return HttpResponse.json(
        walletBody({ balance: "10.00", available: "10.00", held: "0.00" }),
      );
    }),
  );

  await renderActivity();

  expect(
    screen.getByRole("status", { name: "Loading your balance" }),
  ).toBeVisible();
  expect(
    within(
      await screen.findByRole("region", { name: "Your wallet" }),
    ).getAllByText("10.00 EUR"),
  ).toHaveLength(2);
});

test("shows the three amounts of the wallet exactly as the server sends them", async () => {
  server.use(
    http.get(walletUrl, () =>
      HttpResponse.json(
        walletBody({
          balance: "12345678901234567.80",
          available: "12345678901234567.70",
          held: "0.10",
        }),
      ),
    ),
  );

  await renderActivity();

  const wallet = within(
    await screen.findByRole("region", { name: "Your wallet" }),
  );
  expect(wallet.getByText("12,345,678,901,234,567.70 EUR")).toBeVisible();
  expect(wallet.getByText("Available balance")).toBeVisible();
  expect(wallet.getByText("12,345,678,901,234,567.80 EUR")).toBeVisible();
  expect(wallet.getByText("Total balance")).toBeVisible();
  expect(wallet.getByText("0.10 EUR")).toBeVisible();
  expect(wallet.getByText("Reserved for transfers")).toBeVisible();
  expect(
    screen.queryByRole("status", { name: "Loading your balance" }),
  ).toBeNull();
});

test("sends one request for the wallet with the bearer token", async () => {
  const seen: (string | null)[] = [];
  server.use(
    http.get(walletUrl, ({ request }) => {
      seen.push(request.headers.get("authorization"));
      return HttpResponse.json(
        walletBody({ balance: "1.00", available: "1.00", held: "0.00" }),
      );
    }),
  );

  await renderActivity();
  await screen.findByRole("region", { name: "Your wallet" });

  expect(seen).toEqual(["Bearer token-of-julien-id"]);
});

test("explains the failure and reads the wallet again on retry", async () => {
  let attempts = 0;
  server.use(
    http.get(walletUrl, () => {
      attempts += 1;
      return attempts === 1
        ? HttpResponse.json({ title: "Boom" }, { status: 500 })
        : HttpResponse.json(
            walletBody({ balance: "5.00", available: "4.00", held: "1.00" }),
          );
    }),
  );
  const user = userEvent.setup();
  await renderActivity();

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Your balance could not be loaded.");
  expect(screen.queryByRole("region", { name: "Your wallet" })).toBeNull();

  await user.click(within(alert).getByRole("button", { name: "Try again" }));

  expect(await screen.findByText("4.00 EUR")).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(attempts).toBe(2);
});

test.each([
  { name: "balance lacks its amount", field: "balance", part: "amount" },
  { name: "balance lacks its currency", field: "balance", part: "currency" },
  { name: "available lacks its amount", field: "available", part: "amount" },
  {
    name: "available lacks its currency",
    field: "available",
    part: "currency",
  },
  { name: "held lacks its amount", field: "held", part: "amount" },
  { name: "held lacks its currency", field: "held", part: "currency" },
  { name: "held is absent", field: "held", part: "all" },
])(
  "shows the failure state when the wallet's $name",
  async ({ field, part }) => {
    const full = walletBody({
      balance: "1.00",
      available: "1.00",
      held: "0.00",
    });
    const body =
      part === "all"
        ? { ...full, [field]: undefined }
        : {
            ...full,
            [field]: { currency: "EUR", amount: "1.00", [part]: undefined },
          };
    server.use(http.get(walletUrl, () => HttpResponse.json(body)));

    await renderActivity();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your balance could not be loaded.",
    );
  },
);

test("shows the failure state when the wallet request is refused", async () => {
  server.use(
    http.get(walletUrl, () => new HttpResponse(null, { status: 403 })),
  );

  await renderActivity();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your balance could not be loaded.",
  );
});
