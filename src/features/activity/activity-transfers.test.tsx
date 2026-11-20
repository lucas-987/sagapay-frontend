import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { renderApp } from "../../test/render-app";
import { server } from "../../test/setup";

import {
  customer,
  emma,
  noah,
  olivia,
  serveNames,
  serveTransfers,
  transferBody,
} from "../../test/activity-server";
function rowOf(name: string | RegExp) {
  return screen.getByRole("button", { name });
}

beforeEach(() => {
  server.use(
    http.get("*/v1/wallet", () =>
      HttpResponse.json({
        balance: { currency: "EUR", amount: "5.00" },
        available: { currency: "EUR", amount: "4.00" },
        held: { currency: "EUR", amount: "1.00" },
      }),
    ),
  );
});

test.each([
  {
    name: "a sent transfer shows the recipient",
    fixture: {
      id: "t1",
      senderId: customer,
      recipientId: olivia,
      amount: "120.00",
      status: "SCREENING",
    },
    person: "Olivia Martin",
    subtitle: "Sent",
    amount: "−120.00 EUR",
    status: "Checking",
  },
  {
    name: "a received transfer shows the sender",
    fixture: {
      id: "t1",
      senderId: noah,
      recipientId: customer,
      amount: "1045.50",
      status: "BLOCKED",
    },
    person: "Noah Williams",
    subtitle: "Received",
    amount: "+1,045.50 EUR",
    status: "Verification needed",
  },
])(
  "lists $name with its amount, status and date",
  async ({ fixture, person, subtitle, amount, status }) => {
    serveTransfers({
      "": { items: [transferBody(fixture)], nextCursor: null },
    });
    serveNames({ [olivia]: "Olivia Martin", [noah]: "Noah Williams" });
    await renderApp("/activity");

    const row = within(
      await screen.findByRole("button", { name: new RegExp(person) }),
    );
    expect(row.getByText(person)).toBeVisible();
    expect(row.getByText(subtitle)).toBeVisible();
    expect(row.getByText(amount)).toBeVisible();
    expect(row.getByText(status)).toBeVisible();
    expect(row.getByText("12 Nov 2026")).toBeVisible();
  },
);

test("lists the transfers in the order the server sends them, newest first", async () => {
  serveTransfers({
    "": {
      items: [
        transferBody({ id: "t1", amount: "3.00" }),
        transferBody({ id: "t2", amount: "2.00" }),
        transferBody({ id: "t3", amount: "1.00" }),
      ],
      nextCursor: null,
    },
  });
  serveNames({ [olivia]: "Olivia Martin" });
  await renderApp("/activity");

  await screen.findAllByRole("button", { name: /Olivia Martin/ });
  const rows = screen
    .getAllByRole("button", { name: /Olivia Martin/ })
    .map((row) => within(row).getByText(/EUR/).textContent);
  expect(rows).toEqual(["−3.00 EUR", "−2.00 EUR", "−1.00 EUR"]);
});

test("asks for the names of the page once, with each other party's id once", async () => {
  serveTransfers({
    "": {
      items: [
        transferBody({ id: "t1", senderId: customer, recipientId: olivia }),
        transferBody({ id: "t2", senderId: customer, recipientId: olivia }),
        transferBody({ id: "t3", senderId: noah, recipientId: customer }),
        transferBody({ id: "t4", senderId: customer, recipientId: customer }),
      ],
      nextCursor: null,
    },
  });
  const names = serveNames({ [olivia]: "Olivia Martin" });
  await renderApp("/activity");

  await screen.findAllByRole("button", { name: /Olivia Martin/ });
  expect(names).toEqual([[olivia, noah, customer]]);
});

test("does not ask again for an account known from the first page", async () => {
  serveTransfers({
    "": {
      items: [
        transferBody({ id: "t1", senderId: customer, recipientId: olivia }),
        transferBody({ id: "t2", senderId: noah, recipientId: customer }),
      ],
      nextCursor: "cursor-1",
    },
    "cursor-1": {
      items: [
        transferBody({
          id: "t3",
          senderId: customer,
          recipientId: olivia,
          amount: "7.00",
        }),
        transferBody({
          id: "t4",
          senderId: customer,
          recipientId: emma,
          amount: "8.00",
        }),
      ],
      nextCursor: null,
    },
  });
  const names = serveNames({
    [olivia]: "Olivia Martin",
    [noah]: "Noah Williams",
    [emma]: "Emma Laurent",
  });
  const user = userEvent.setup();
  await renderApp("/activity");

  await screen.findByRole("button", { name: /Noah Williams/ });
  await user.click(screen.getByRole("button", { name: "Load more" }));

  expect(
    await screen.findByRole("button", { name: /Emma Laurent/ }),
  ).toBeVisible();
  expect(screen.getAllByRole("button", { name: /Olivia Martin/ })).toHaveLength(
    2,
  );
  expect(names).toEqual([[olivia, noah], [emma]]);
});

test("does not ask the ledger when the page has no other party id", async () => {
  server.use(
    http.get("*/v1/transfers", () =>
      HttpResponse.json({
        items: [{ ...transferBody({ id: "t1" }), recipientId: undefined }],
        nextCursor: null,
      }),
    ),
  );
  const names = serveNames({});
  await renderApp("/activity");

  expect(await screen.findByText("Recipient")).toBeVisible();
  expect(names).toEqual([]);
});

test("explains the failure and reads the list again on retry", async () => {
  let attempts = 0;
  server.use(
    http.get("*/v1/transfers", () => {
      attempts += 1;
      return attempts === 1
        ? HttpResponse.json({ title: "Boom" }, { status: 500 })
        : HttpResponse.json({
            items: [transferBody({ id: "t1" })],
            nextCursor: null,
          });
    }),
  );
  serveNames({ [olivia]: "Olivia Martin" });
  const user = userEvent.setup();
  await renderApp("/activity");

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Your transfers could not be loaded.");

  await user.click(within(alert).getByRole("button", { name: "Try again" }));

  expect(
    await screen.findByRole("button", { name: /Olivia Martin/ }),
  ).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(attempts).toBe(2);
});

test("keeps the loaded transfers and retries the next page when it fails", async () => {
  let secondPageAttempts = 0;
  server.use(
    http.get("*/v1/transfers", ({ request }) => {
      if (new URL(request.url).searchParams.get("cursor") === null) {
        return HttpResponse.json({
          items: [transferBody({ id: "t1" })],
          nextCursor: "cursor-1",
        });
      }
      secondPageAttempts += 1;
      return secondPageAttempts === 1
        ? HttpResponse.json({ title: "Boom" }, { status: 500 })
        : HttpResponse.json({
            items: [transferBody({ id: "t2", amount: "2.00" })],
            nextCursor: null,
          });
    }),
  );
  serveNames({ [olivia]: "Olivia Martin" });
  const user = userEvent.setup();
  await renderApp("/activity");

  await screen.findByRole("button", { name: /Olivia Martin/ });
  await user.click(screen.getByRole("button", { name: "Load more" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("More transfers could not be loaded.");
  expect(screen.getAllByRole("button", { name: /Olivia Martin/ })).toHaveLength(
    1,
  );

  await user.click(within(alert).getByRole("button", { name: "Try again" }));

  expect(await screen.findByText("−2.00 EUR")).toBeVisible();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("shows a disabled loading control while the next page is being read", async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get("*/v1/transfers", async ({ request }) => {
      if (new URL(request.url).searchParams.get("cursor") === null) {
        return HttpResponse.json({
          items: [transferBody({ id: "t1" })],
          nextCursor: "cursor-1",
        });
      }
      await gate;
      return HttpResponse.json({
        items: [transferBody({ id: "t2", amount: "2.00" })],
        nextCursor: null,
      });
    }),
  );
  serveNames({ [olivia]: "Olivia Martin" });
  const user = userEvent.setup();
  await renderApp("/activity");

  await screen.findByRole("button", { name: /Olivia Martin/ });
  await user.click(screen.getByRole("button", { name: "Load more" }));

  expect(
    await screen.findByRole("button", { name: "Loading more…" }),
  ).toBeDisabled();
  release();
  expect(await screen.findByText("−2.00 EUR")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Loading more…" })).toBeNull();
});

test("does not ask again for the ids of a failed names request when the next page loads", async () => {
  serveTransfers({
    "": {
      items: [transferBody({ id: "t1", recipientId: olivia })],
      nextCursor: "cursor-1",
    },
    "cursor-1": {
      items: [
        transferBody({ id: "t2", recipientId: olivia, amount: "2.00" }),
        transferBody({ id: "t3", recipientId: emma, amount: "3.00" }),
      ],
      nextCursor: null,
    },
  });
  const asked: string[][] = [];
  server.use(
    http.get("*/v1/users/names", ({ request }) => {
      asked.push(new URL(request.url).searchParams.getAll("ids"));
      return HttpResponse.json({ title: "Boom" }, { status: 500 });
    }),
  );
  const user = userEvent.setup();
  await renderApp("/activity");

  await user.click(await screen.findByRole("button", { name: "Load more" }));

  expect(await screen.findByText("−3.00 EUR")).toBeVisible();
  expect(screen.getAllByText("Recipient")).toHaveLength(3);
  await waitFor(() => {
    expect(asked).toEqual([[olivia], [emma]]);
  });
});

test("asks for the names of a page with 51 other parties in two requests of 50 and 1", async () => {
  const parties = Array.from(
    { length: 51 },
    (_, index) =>
      `00000000-0000-4000-a000-${String(index + 100).padStart(12, "0")}`,
  );
  serveTransfers({
    "": {
      items: parties.map((id, index) =>
        transferBody({ id: `t${String(index)}`, recipientId: id }),
      ),
      nextCursor: null,
    },
  });
  const names = serveNames({ [parties[50] ?? ""]: "Last Party" });
  await renderApp("/activity");

  expect(await screen.findByText("Last Party")).toBeVisible();
  expect(names).toEqual([parties.slice(0, 50), [parties[50]]]);
});

describe("M5-S14", () => {
  test("A transfer stays listed when the other party's name is missing from the answer", async () => {
    serveTransfers({
      "": {
        items: [
          transferBody({ id: "t1", senderId: customer, recipientId: olivia }),
          transferBody({ id: "t2", senderId: noah, recipientId: customer }),
        ],
        nextCursor: null,
      },
    });
    serveNames({});
    await renderApp("/activity");

    expect(await screen.findByText("Recipient")).toBeVisible();
    expect(within(rowOf(/Received/)).getByText("Sender")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /EUR/ })).toHaveLength(2);
  });

  test("A transfer stays listed when the other party's name could not be fetched", async () => {
    serveTransfers({
      "": {
        items: [
          transferBody({ id: "t1", senderId: customer, recipientId: olivia }),
          transferBody({ id: "t2", senderId: noah, recipientId: customer }),
        ],
        nextCursor: null,
      },
    });
    let attempts = 0;
    server.use(
      http.get("*/v1/users/names", () => {
        attempts += 1;
        return HttpResponse.json({ title: "Boom" }, { status: 500 });
      }),
    );
    await renderApp("/activity");

    expect(await screen.findByText("Recipient")).toBeVisible();
    expect(screen.getByText("Sender")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /EUR/ })).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(attempts).toBe(1);
  });
});

describe("M5-S15", () => {
  test("A customer with no transfers sees an empty activity", async () => {
    serveTransfers({ "": { items: [], nextCursor: null } });
    await renderApp("/activity");

    expect(await screen.findByText("You have no transfers yet.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  test("shows the empty state when the answer carries no items", async () => {
    server.use(http.get("*/v1/transfers", () => HttpResponse.json({})));
    await renderApp("/activity");

    expect(await screen.findByText("You have no transfers yet.")).toBeVisible();
  });
});

describe("M5-S16", () => {
  test("The last page of activity offers no further loading", async () => {
    serveTransfers({
      "": {
        items: [transferBody({ id: "t1", amount: "1.00" })],
        nextCursor: "cursor-1",
      },
      "cursor-1": {
        items: [transferBody({ id: "t2", amount: "2.00" })],
        nextCursor: null,
      },
    });
    serveNames({ [olivia]: "Olivia Martin" });
    const user = userEvent.setup();
    await renderApp("/activity");

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByText("−2.00 EUR")).toBeVisible();
    expect(screen.getByText("−1.00 EUR")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
