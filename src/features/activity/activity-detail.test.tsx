import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import {
  customer,
  noah,
  olivia,
  serveNames,
  serveTransfers,
  transferBody,
} from "../../test/activity-server";
import { renderApp } from "../../test/render-app";
import { server } from "../../test/setup";

function serveDetail(id: string, body: Record<string, unknown>) {
  const requests: string[] = [];
  server.use(
    http.get(`*/v1/transfers/${id}`, () => {
      requests.push(id);
      return HttpResponse.json(body);
    }),
  );
  return requests;
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

describe("M5-S08", () => {
  test("A customer can open an earlier transfer", async () => {
    const lists = serveTransfers({
      "": {
        items: [
          transferBody({ id: "t-new", recipientId: olivia, amount: "120.00" }),
        ],
        nextCursor: "cursor-1",
      },
      "cursor-1": {
        items: [
          transferBody({
            id: "t-old",
            senderId: noah,
            recipientId: customer,
            amount: "45.00",
            createdAt: "2026-11-02T12:00:00Z",
            note: "Coffee and pastries",
          }),
        ],
        nextCursor: null,
      },
    });
    const names = serveNames({
      [olivia]: "Olivia Martin",
      [noah]: "Noah Williams",
    });
    server.use(
      http.get("*/v1/transfers/t-old", () =>
        HttpResponse.json({
          ...transferBody({
            id: "t-old",
            senderId: noah,
            recipientId: customer,
            amount: "45.00",
            createdAt: "2026-11-02T12:00:00Z",
            note: "Coffee and pastries",
          }),
          steps: [],
        }),
      ),
    );
    const user = userEvent.setup();
    await renderApp("/activity");

    await screen.findByRole("button", { name: /Olivia Martin/ });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await user.click(
      await screen.findByRole("button", { name: /Noah Williams/ }),
    );

    const drawer = await screen.findByRole("dialog", {
      name: "Transfer details",
    });
    expect(within(drawer).getByText("+45.00 EUR")).toBeVisible();
    expect(
      within(drawer).getByText("Received from Noah Williams"),
    ).toBeVisible();
    expect(within(drawer).getByText("Completed")).toBeVisible();
    expect(within(drawer).getByText("t-old")).toBeVisible();
    expect(within(drawer).getByText("2 Nov 2026, 12:00")).toBeVisible();
    expect(within(drawer).getByText("Coffee and pastries")).toBeVisible();
    expect(lists).toEqual([
      { cursor: null, limit: "20" },
      { cursor: "cursor-1", limit: "20" },
    ]);
    expect(names).toEqual([[olivia], [noah]]);
  });
});

test("opens a transfer from the list into the URL", async () => {
  serveTransfers({
    "": {
      items: [
        transferBody({
          id: "t1",
          recipientId: olivia,
          amount: "120.00",
          status: "FAILED",
          note: "Dinner",
        }),
      ],
      nextCursor: null,
    },
  });
  const names = serveNames({ [olivia]: "Olivia Martin" });
  const details = serveDetail("t1", {
    ...transferBody({
      id: "t1",
      recipientId: olivia,
      amount: "120.00",
      status: "FAILED",
      note: "Dinner",
    }),
    failureReason: "INSUFFICIENT_FUNDS",
    steps: [
      { at: "2026-11-12T12:00:01Z", step: "RESERVE", outcome: "FAILED" },
      { at: "2026-11-12T12:00:02Z", step: "RELEASE", outcome: "OK" },
    ],
  });
  const user = userEvent.setup();
  const { router } = await renderApp("/activity");

  await user.click(
    await screen.findByRole("button", { name: /Olivia Martin/ }),
  );
  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  expect(router.state.location.search).toBe("?transfer=t1");
  expect(
    await within(drawer).findByText("Sent to Olivia Martin"),
  ).toBeVisible();
  expect(details).toEqual(["t1"]);
  expect(names).toEqual([[olivia]]);
});

test("shows the amount, status and note of the opened transfer", async () => {
  serveTransfers({
    "": {
      items: [
        transferBody({
          id: "t1",
          recipientId: olivia,
          amount: "120.00",
          status: "FAILED",
          note: "Dinner",
        }),
      ],
      nextCursor: null,
    },
  });
  serveNames({ [olivia]: "Olivia Martin" });
  serveDetail("t1", {
    ...transferBody({
      id: "t1",
      recipientId: olivia,
      amount: "120.00",
      status: "FAILED",
      note: "Dinner",
    }),
    failureReason: "INSUFFICIENT_FUNDS",
    steps: [
      { at: "2026-11-12T12:00:01Z", step: "RESERVE", outcome: "FAILED" },
      { at: "2026-11-12T12:00:02Z", step: "RELEASE", outcome: "OK" },
    ],
  });
  const user = userEvent.setup();
  await renderApp("/activity");

  await user.click(
    await screen.findByRole("button", { name: /Olivia Martin/ }),
  );
  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  expect(await within(drawer).findByText("−120.00 EUR")).toBeVisible();
  expect(within(drawer).getByText("Failed")).toBeVisible();
  expect(within(drawer).getByText("Dinner")).toBeVisible();
});

test("shows the failure reason to the sender", async () => {
  serveTransfers({
    "": {
      items: [
        transferBody({
          id: "t1",
          recipientId: olivia,
          amount: "120.00",
          status: "FAILED",
          note: "Dinner",
        }),
      ],
      nextCursor: null,
    },
  });
  serveNames({ [olivia]: "Olivia Martin" });
  serveDetail("t1", {
    ...transferBody({
      id: "t1",
      recipientId: olivia,
      amount: "120.00",
      status: "FAILED",
      note: "Dinner",
    }),
    failureReason: "INSUFFICIENT_FUNDS",
    steps: [
      { at: "2026-11-12T12:00:01Z", step: "RESERVE", outcome: "FAILED" },
      { at: "2026-11-12T12:00:02Z", step: "RELEASE", outcome: "OK" },
    ],
  });
  const user = userEvent.setup();
  await renderApp("/activity");

  await user.click(
    await screen.findByRole("button", { name: /Olivia Martin/ }),
  );
  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  expect(await within(drawer).findByText("Insufficient funds")).toBeVisible();
});

test("shows the saga timeline to the sender", async () => {
  serveTransfers({
    "": {
      items: [
        transferBody({
          id: "t1",
          recipientId: olivia,
          amount: "120.00",
          status: "FAILED",
          note: "Dinner",
        }),
      ],
      nextCursor: null,
    },
  });
  serveNames({ [olivia]: "Olivia Martin" });
  serveDetail("t1", {
    ...transferBody({
      id: "t1",
      recipientId: olivia,
      amount: "120.00",
      status: "FAILED",
      note: "Dinner",
    }),
    failureReason: "INSUFFICIENT_FUNDS",
    steps: [
      { at: "2026-11-12T12:00:01Z", step: "RESERVE", outcome: "FAILED" },
      { at: "2026-11-12T12:00:02Z", step: "RELEASE", outcome: "OK" },
    ],
  });
  const user = userEvent.setup();
  await renderApp("/activity");

  await user.click(
    await screen.findByRole("button", { name: /Olivia Martin/ }),
  );
  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  const steps = within(
    await within(drawer).findByRole("list", { name: "Transfer timeline" }),
  ).getAllByRole("listitem");
  expect(steps.map((step) => step.textContent)).toEqual([
    "1Funds reserved12 Nov 2026, 12:00 · Failed",
    "2Funds released12 Nov 2026, 12:00 · Done",
  ]);
});

test("shows a generic label in the drawer when the name did not arrive", async () => {
  serveNames({});
  serveDetail(
    "t9",
    transferBody({ id: "t9", senderId: noah, recipientId: customer }),
  );
  serveTransfers({ "": { items: [], nextCursor: null } });
  await renderApp("/activity?transfer=t9");

  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  expect(await within(drawer).findByText("Received from Sender")).toBeVisible();
});

test("shows a loading status in the drawer while the detail is being read", async () => {
  serveNames({ [olivia]: "Olivia Martin" });
  serveTransfers({ "": { items: [], nextCursor: null } });
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get("*/v1/transfers/t9", async () => {
      await gate;
      return HttpResponse.json(transferBody({ id: "t9", recipientId: olivia }));
    }),
  );
  await renderApp("/activity?transfer=t9");

  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  expect(
    within(drawer).getByRole("status", { name: "Loading the transfer" }),
  ).toBeVisible();
  release();
  expect(
    await within(drawer).findByText("Sent to Olivia Martin"),
  ).toBeVisible();
});

test("explains a failed detail read in the drawer and reads it again on retry", async () => {
  serveTransfers({ "": { items: [], nextCursor: null } });
  serveNames({ [olivia]: "Olivia Martin" });
  let attempts = 0;
  server.use(
    http.get("*/v1/transfers/t9", () => {
      attempts += 1;
      return attempts === 1
        ? HttpResponse.json({ title: "Boom" }, { status: 500 })
        : HttpResponse.json(transferBody({ id: "t9", recipientId: olivia }));
    }),
  );
  const user = userEvent.setup();
  await renderApp("/activity?transfer=t9");

  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  expect(
    await within(drawer).findByText("The transfer could not be loaded."),
  ).toBeVisible();

  await user.click(within(drawer).getByRole("button", { name: "Try again" }));

  expect(
    await within(drawer).findByText("Sent to Olivia Martin"),
  ).toBeVisible();
  expect(attempts).toBe(2);
});

test("closes the drawer with its button, clears the URL and returns focus to the row", async () => {
  serveTransfers({
    "": {
      items: [transferBody({ id: "t1", recipientId: olivia })],
      nextCursor: null,
    },
  });
  serveNames({ [olivia]: "Olivia Martin" });
  serveDetail("t1", transferBody({ id: "t1", recipientId: olivia }));
  const user = userEvent.setup();
  const { router } = await renderApp("/activity");
  const row = await screen.findByRole("button", { name: /Olivia Martin/ });

  await user.click(row);
  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  await user.click(
    within(drawer).getByRole("button", { name: "Close details" }),
  );

  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(router.state.location.search).toBe("");
  expect(row).toHaveFocus();
});

test("closes the drawer with Escape and returns focus to the row", async () => {
  serveTransfers({
    "": {
      items: [transferBody({ id: "t1", recipientId: olivia })],
      nextCursor: null,
    },
  });
  serveNames({ [olivia]: "Olivia Martin" });
  serveDetail("t1", transferBody({ id: "t1", recipientId: olivia }));
  const user = userEvent.setup();
  await renderApp("/activity");
  const row = await screen.findByRole("button", { name: /Olivia Martin/ });

  await user.click(row);
  await screen.findByRole("dialog", { name: "Transfer details" });
  await user.keyboard("{Escape}");

  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(row).toHaveFocus();
});

test("shows a saga step that has no instant or known outcome with what the server sent", async () => {
  serveTransfers({ "": { items: [], nextCursor: null } });
  serveNames({ [olivia]: "Olivia Martin" });
  serveDetail("t9", {
    ...transferBody({ id: "t9", recipientId: olivia }),
    steps: [{ step: "POST", outcome: "PARKED" }],
  });
  await renderApp("/activity?transfer=t9");

  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  const steps = await within(
    await within(drawer).findByRole("list", { name: "Transfer timeline" }),
  ).findAllByRole("listitem");
  expect(steps.map((step) => step.textContent)).toEqual(["1PostedPARKED"]);
});

describe("M5-S17", () => {
  test("An unknown transfer is reported as not found", async () => {
    serveTransfers({ "": { items: [], nextCursor: null } });
    server.use(
      http.get("*/v1/transfers/unknown", () =>
        HttpResponse.json(
          { title: "Not found", status: 404, code: "TRANSFER_NOT_FOUND" },
          {
            status: 404,
            headers: { "Content-Type": "application/problem+json" },
          },
        ),
      ),
    );
    const user = userEvent.setup();
    const { router } = await renderApp("/activity?transfer=unknown");

    const drawer = await screen.findByRole("dialog", {
      name: "Transfer details",
    });
    expect(
      await within(drawer).findByText("This transfer was not found."),
    ).toBeVisible();
    expect(
      within(drawer).queryByRole("button", { name: "Try again" }),
    ).toBeNull();

    await user.click(
      within(drawer).getByRole("button", { name: "Close details" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(router.state.location.search).toBe("");
  });

  test("shows a not-found message when the 404 carries no problem code", async () => {
    serveTransfers({ "": { items: [], nextCursor: null } });
    server.use(
      http.get(
        "*/v1/transfers/unknown",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    await renderApp("/activity?transfer=unknown");

    const drawer = await screen.findByRole("dialog", {
      name: "Transfer details",
    });
    expect(
      await within(drawer).findByText("This transfer was not found."),
    ).toBeVisible();
  });
});

describe("M5-S18", () => {
  test("Reloading a transfer's link reopens its details", async () => {
    const names = serveNames({ [olivia]: "Olivia Martin" });
    serveDetail(
      "t9",
      transferBody({ id: "t9", recipientId: olivia, amount: "9.00" }),
    );
    serveTransfers({ "": { items: [], nextCursor: null } });
    await renderApp("/activity?transfer=t9");

    const drawer = await screen.findByRole("dialog", {
      name: "Transfer details",
    });
    expect(
      await within(drawer).findByText("Sent to Olivia Martin"),
    ).toBeVisible();
    expect(within(drawer).getByText("−9.00 EUR")).toBeVisible();
    expect(names).toEqual([[olivia]]);
  });
});

describe("M5-S19", () => {
  test("A recipient is not shown why a transfer failed", async () => {
    serveTransfers({
      "": {
        items: [
          transferBody({
            id: "t1",
            senderId: noah,
            recipientId: customer,
            status: "FAILED",
          }),
        ],
        nextCursor: null,
      },
    });
    serveNames({ [noah]: "Noah Williams" });
    serveDetail("t1", {
      ...transferBody({
        id: "t1",
        senderId: noah,
        recipientId: customer,
        status: "FAILED",
      }),
      failureReason: null,
      steps: [],
    });
    const user = userEvent.setup();
    await renderApp("/activity");

    await user.click(
      await screen.findByRole("button", { name: /Noah Williams/ }),
    );

    const drawer = await screen.findByRole("dialog", {
      name: "Transfer details",
    });
    expect(
      await within(drawer).findByText("Received from Noah Williams"),
    ).toBeVisible();
    expect(within(drawer).getByText("Failed")).toBeVisible();
    expect(within(drawer).queryByText("Transfer timeline")).toBeNull();
    expect(within(drawer).queryByText("Reason")).toBeNull();
  });
});

test("shows the drawer of the selected transfer only, not the previous one, when the URL changes", async () => {
  serveTransfers({ "": { items: [], nextCursor: null } });
  serveNames({ [olivia]: "Olivia Martin", [noah]: "Noah Williams" });
  serveDetail("a", transferBody({ id: "a", recipientId: olivia }));
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get("*/v1/transfers/b", async () => {
      await gate;
      return HttpResponse.json(transferBody({ id: "b", recipientId: noah }));
    }),
  );
  const { router } = await renderApp("/activity?transfer=a");
  const drawer = await screen.findByRole("dialog", {
    name: "Transfer details",
  });
  await within(drawer).findByText("Sent to Olivia Martin");

  await act(() => router.navigate("/activity?transfer=b"));

  expect(
    within(drawer).getByRole("status", { name: "Loading the transfer" }),
  ).toBeVisible();
  expect(within(drawer).queryByText("Sent to Olivia Martin")).toBeNull();
  release();
  expect(
    await within(drawer).findByText("Sent to Noah Williams"),
  ).toBeVisible();
});
