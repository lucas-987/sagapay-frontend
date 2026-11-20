import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderApp } from "../../test/render-app";
import { server } from "../../test/setup";
import { serveStream } from "../../test/stream-server";

const bob = {
  accountId: "00000000-0000-4000-a000-000000000002",
  displayName: "Bob Dupont",
};
const transferId = "7d1d2a3e-5a0e-4c7a-9a55-0c7a4b1f2e01";
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface Sent {
  key: string | null;
  body: unknown;
}

function walletOf(amount: string) {
  return {
    balance: { currency: "EUR", amount },
    available: { currency: "EUR", amount },
    held: { currency: "EUR", amount: "0.00" },
  };
}

function transferOf(status: string, failureReason?: string) {
  return {
    id: transferId,
    senderId: "julien-id",
    recipientId: bob.accountId,
    amount: { currency: "EUR", amount: "12.50" },
    status,
    createdAt: "2026-11-12T12:00:00Z",
    ...(failureReason === undefined ? {} : { failureReason }),
  };
}

function serveSendPage() {
  const reads = { wallet: 0 };
  server.use(
    http.get("*/v1/wallet", () => {
      reads.wallet += 1;
      return HttpResponse.json(walletOf("100.00"));
    }),
    http.get("*/v1/users/lookup", () => HttpResponse.json(bob)),
    http.get("*/v1/users/names", () =>
      HttpResponse.json({
        items: [{ accountId: bob.accountId, displayName: bob.displayName }],
      }),
    ),
  );
  return reads;
}

function serveDetail(respond: () => Response) {
  server.use(http.get(`*/v1/transfers/${transferId}`, respond));
}

function serveCreate(
  answers: (attempt: number) => Response | Promise<Response>,
) {
  const sent: Sent[] = [];
  server.use(
    http.post("*/v1/transfers", async ({ request }) => {
      sent.push({
        key: request.headers.get("idempotency-key"),
        body: await request.json(),
      });
      return answers(sent.length);
    }),
  );
  return sent;
}

const accepted = (status = "INITIATED") =>
  HttpResponse.json(transferOf(status), { status: 202 });

async function openSendPage(stream?: Parameters<typeof renderApp>[1]) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const user = userEvent.setup({ delay: null });
  await renderApp("/send", stream);
  await screen.findByText(/Available to send/);
  return user;
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { amount = "12.50", note = "" } = {},
) {
  await user.type(screen.getByRole("combobox", { name: "Recipient" }), "bob");
  await vi.advanceTimersByTimeAsync(300);
  await user.click(
    await screen.findByRole("option", { name: "Bob Dupont @bob" }),
  );
  await user.type(screen.getByRole("textbox", { name: "Amount" }), amount);
  if (note !== "") {
    await user.type(
      screen.getByRole("textbox", { name: "Note (optional)" }),
      note,
    );
  }
}

const sendButton = () => screen.getByRole("button", { name: "Send money" });

beforeEach(() => {
  vi.stubGlobal("jest", { advanceTimersByTime: vi.advanceTimersByTime });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("sending a transfer", () => {
  test("posts the exact request body with a UUID v4 idempotency key", async () => {
    serveSendPage();
    const sent = serveCreate(() => accepted());
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user, { amount: "12.50", note: "Dinner" });

    await user.click(sendButton());

    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).toStrictEqual({
      toUserId: bob.accountId,
      amount: { amount: "12.50", currency: "EUR" },
      note: "Dinner",
    });
    expect(sent[0]?.key).toMatch(uuidV4);
  });

  test("sends no note when none was written", async () => {
    serveSendPage();
    const sent = serveCreate(() => accepted());
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user);

    await user.click(sendButton());

    await vi.waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).toStrictEqual({
      toUserId: bob.accountId,
      amount: { amount: "12.50", currency: "EUR" },
    });
  });

  test("makes one request for two quick activations of Send", async () => {
    serveSendPage();
    const sent = serveCreate(async () => {
      await delay(100);
      return accepted();
    });
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user);

    await user.dblClick(sendButton());
    await vi.advanceTimersByTimeAsync(100);

    await screen.findByRole("list", { name: "Transfer progress" });
    expect(sent).toHaveLength(1);
  });

  test("disables Send while the request is pending", async () => {
    serveSendPage();
    serveCreate(async () => {
      await delay(100);
      return accepted();
    });
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user);

    await user.click(sendButton());

    expect(sendButton()).toBeDisabled();
    await vi.advanceTimersByTimeAsync(100);
  });

  test("renders the returned transfer and reads the wallet again after 202", async () => {
    const reads = serveSendPage();
    serveCreate(() => accepted("RESERVED"));
    serveDetail(() => HttpResponse.json(transferOf("RESERVED")));
    const user = await openSendPage();
    await fillForm(user);
    expect(reads.wallet).toBe(1);

    await user.click(sendButton());

    await screen.findByRole("list", { name: "Transfer progress" });
    await vi.waitFor(() => {
      expect(reads.wallet).toBe(2);
    });
    expect(
      screen.getByRole("link", { name: "View transfer details" }),
    ).toHaveAttribute("href", `/activity?transfer=${transferId}`);
  });
});

function stepStates() {
  return within(screen.getByRole("list", { name: "Transfer progress" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

describe("the stepper", () => {
  test("shows a step only once the server confirmed it", async () => {
    serveSendPage();
    const { connections } = serveStream();
    serveCreate(() => accepted("INITIATED"));
    let status = "INITIATED";
    serveDetail(() => HttpResponse.json(transferOf(status)));
    const user = await openSendPage({ stream: {} });
    await vi.waitFor(() => {
      expect(connections).toHaveLength(1);
    });
    await fillForm(user);

    await user.click(sendButton());

    await screen.findByRole("list", { name: "Transfer progress" });
    expect(stepStates()).toStrictEqual([
      "Funds reserved Waiting",
      "Checking Waiting",
      "Sent Waiting",
    ]);

    status = "POSTED";
    act(() => {
      connections[0]?.push("transfer.posted", {
        transferId,
        senderId: "julien-id",
        recipientId: bob.accountId,
        amount: "12.50",
        currency: "EUR",
      });
    });

    await vi.waitFor(() => {
      expect(stepStates()).toStrictEqual([
        "Funds reserved Confirmed",
        "Checking Confirmed",
        "Sent Confirmed",
      ]);
    });
  });
});

describe("M5-S07", () => {
  test("A refused transfer shows the sender why it failed", async () => {
    serveSendPage();
    const { connections } = serveStream();
    serveCreate(() => accepted("INITIATED"));
    let failed = false;
    serveDetail(() =>
      HttpResponse.json(
        failed
          ? transferOf("FAILED", "INSUFFICIENT_FUNDS")
          : transferOf("INITIATED"),
      ),
    );
    const user = await openSendPage({ stream: {} });
    await vi.waitFor(() => {
      expect(connections).toHaveLength(1);
    });
    await fillForm(user, { amount: "90.00" });
    await user.click(sendButton());
    await screen.findByRole("list", { name: "Transfer progress" });

    failed = true;
    act(() => {
      connections[0]?.push("transfer.failed", {
        transferId,
        senderId: "julien-id",
        recipientId: bob.accountId,
        amount: "12.50",
        currency: "EUR",
        cause: "INSUFFICIENT_FUNDS",
      });
    });

    expect(
      await screen.findByText("The transfer failed: Insufficient funds"),
    ).toBeVisible();
    expect(
      screen.queryByRole("list", { name: "Transfer progress" }),
    ).not.toBeInTheDocument();
  });

  test("shows the cause when the transfer is already failed in its detail", async () => {
    serveSendPage();
    serveCreate(() => accepted("INITIATED"));
    serveDetail(() =>
      HttpResponse.json(transferOf("FAILED", "INSUFFICIENT_FUNDS")),
    );
    const user = await openSendPage();
    await fillForm(user);

    await user.click(sendButton());

    expect(
      await screen.findByText("The transfer failed: Insufficient funds"),
    ).toBeVisible();
  });
});

describe("an uncertain response", () => {
  test.each([
    [
      "a network error",
      () => HttpResponse.error(),
      async () => {
        await Promise.resolve();
      },
    ],
    [
      "a timeout",
      async () => {
        await delay("infinite");
        return accepted();
      },
      async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      },
    ],
  ])(
    "after %s, retry resends the same key and body and shows the transfer",
    async (_name, firstAnswer, elapse) => {
      serveSendPage();
      const sent = serveCreate((attempt) =>
        attempt === 1 ? firstAnswer() : accepted("RESERVED"),
      );
      serveDetail(() => HttpResponse.json(transferOf("RESERVED")));
      const user = await openSendPage();
      await fillForm(user, { note: "Dinner" });
      await user.click(sendButton());
      await elapse();

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "We could not confirm that your transfer was sent. Retrying sends the same payment, so it is paid once.",
      );
      expect(
        screen.queryByRole("list", { name: "Transfer progress" }),
      ).not.toBeInTheDocument();

      await user.click(within(alert).getByRole("button", { name: "Retry" }));

      await screen.findByRole("list", { name: "Transfer progress" });
      expect(sent).toHaveLength(2);
      expect(sent[1]).toStrictEqual(sent[0]);
      expect(sent[0]?.key).toMatch(uuidV4);
      expect(stepStates()).toStrictEqual([
        "Funds reserved Confirmed",
        "Checking Waiting",
        "Sent Waiting",
      ]);
    },
  );

  test("makes one request for two quick activations of Retry and disables it while pending", async () => {
    serveSendPage();
    const sent = serveCreate(async (attempt) => {
      if (attempt === 1) return HttpResponse.error();
      await delay(100);
      return accepted();
    });
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user);
    await user.click(sendButton());
    const retry = await screen.findByRole("button", { name: "Retry" });

    act(() => {
      retry.click();
      retry.click();
    });

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
    });
    await vi.advanceTimersByTimeAsync(100);
    await screen.findByRole("list", { name: "Transfer progress" });
    expect(sent).toHaveLength(2);
  });

  test("retries with the same key when Send is pressed again", async () => {
    serveSendPage();
    const sent = serveCreate((attempt) =>
      attempt === 1 ? HttpResponse.error() : accepted(),
    );
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user);
    await user.click(sendButton());
    await screen.findByRole("alert");

    await user.click(sendButton());

    await screen.findByRole("list", { name: "Transfer progress" });
    expect(sent[1]).toStrictEqual(sent[0]);
  });

  test.each([
    ["the amount", "amount"],
    ["the note", "note"],
  ])(
    "starts a new intent with a new key when %s is edited",
    async (_name, field) => {
      serveSendPage();
      const sent = serveCreate((attempt) =>
        attempt === 1 ? HttpResponse.error() : accepted(),
      );
      serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
      const user = await openSendPage();
      await fillForm(user);
      await user.click(sendButton());
      await screen.findByRole("alert");

      if (field === "amount") {
        const amount = screen.getByRole("textbox", { name: "Amount" });
        await user.clear(amount);
        await user.type(amount, "13.00");
      } else {
        await user.type(
          screen.getByRole("textbox", { name: "Note (optional)" }),
          "Dinner",
        );
      }

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await user.click(sendButton());
      await screen.findByRole("list", { name: "Transfer progress" });
      expect(sent).toHaveLength(2);
      expect(sent[1]?.key).toMatch(uuidV4);
      expect(sent[1]?.key).not.toBe(sent[0]?.key);
    },
  );

  test("starts a new intent with a new key when the recipient changes", async () => {
    serveSendPage();
    const sent = serveCreate((attempt) =>
      attempt === 1 ? HttpResponse.error() : accepted(),
    );
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user);
    await user.click(sendButton());
    await screen.findByRole("alert");
    const other = {
      accountId: "00000000-0000-4000-a000-000000000003",
      displayName: "Carla Roy",
    };
    server.use(http.get("*/v1/users/lookup", () => HttpResponse.json(other)));

    const recipient = screen.getByRole("combobox", { name: "Recipient" });
    await user.clear(recipient);
    await user.type(recipient, "carla");
    await vi.advanceTimersByTimeAsync(300);
    await user.click(
      await screen.findByRole("option", { name: "Carla Roy @carla" }),
    );
    await user.click(sendButton());

    await screen.findByRole("list", { name: "Transfer progress" });
    expect(sent[1]?.body).toStrictEqual({
      toUserId: other.accountId,
      amount: { amount: "12.50", currency: "EUR" },
    });
    expect(sent[1]?.key).not.toBe(sent[0]?.key);
  });
});

describe("a refused or failed request", () => {
  test.each([
    ["an uncertain response", () => HttpResponse.error()],
    [
      "IDEMPOTENCY_KEY_REUSED",
      () =>
        HttpResponse.json(
          { status: 422, code: "IDEMPOTENCY_KEY_REUSED" },
          {
            status: 422,
            headers: { "content-type": "application/problem+json" },
          },
        ),
    ],
    [
      "another failure",
      () => HttpResponse.json({ status: 500 }, { status: 500 }),
    ],
  ])(
    "hides the notice of %s once the form is edited",
    async (_name, answer) => {
      serveSendPage();
      serveCreate(answer);
      const user = await openSendPage();
      await fillForm(user);
      await user.click(sendButton());
      await screen.findByRole("alert");

      await user.type(
        screen.getByRole("textbox", { name: "Note (optional)" }),
        "Dinner",
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  test("reports IDEMPOTENCY_KEY_REUSED in the form and shows no transfer", async () => {
    serveSendPage();
    serveCreate(() =>
      HttpResponse.json(
        { status: 422, code: "IDEMPOTENCY_KEY_REUSED" },
        {
          status: 422,
          headers: { "content-type": "application/problem+json" },
        },
      ),
    );
    const user = await openSendPage();
    await fillForm(user);

    await user.click(sendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This payment was already sent with different details. Check your activity before sending again.",
    );
    expect(
      screen.queryByRole("list", { name: "Transfer progress" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View transfer details" }),
    ).not.toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  test("uses a new key for the send that follows a reused-key refusal", async () => {
    serveSendPage();
    const sent = serveCreate((attempt) =>
      attempt === 1
        ? HttpResponse.json(
            { status: 422, code: "IDEMPOTENCY_KEY_REUSED" },
            {
              status: 422,
              headers: { "content-type": "application/problem+json" },
            },
          )
        : accepted(),
    );
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user);
    await user.click(sendButton());
    await screen.findByRole("alert");

    await user.click(sendButton());

    await screen.findByRole("list", { name: "Transfer progress" });
    expect(sent[1]?.key).not.toBe(sent[0]?.key);
    expect(sent[1]?.body).toStrictEqual(sent[0]?.body);
  });

  test("lets the next send through after the key could not be generated", async () => {
    serveSendPage();
    const sent = serveCreate(() => accepted());
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user);
    vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
      throw new Error("no entropy");
    });

    await user.click(sendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The transfer could not be sent. Try again.",
    );
    expect(sent).toHaveLength(0);
    await user.click(sendButton());
    await screen.findByRole("list", { name: "Transfer progress" });
    expect(sent).toHaveLength(1);
  });

  test("reports any other failure and keeps the key for the next try", async () => {
    serveSendPage();
    const sent = serveCreate((attempt) =>
      attempt === 1 ? new HttpResponse(null, { status: 500 }) : accepted(),
    );
    serveDetail(() => HttpResponse.json(transferOf("INITIATED")));
    const user = await openSendPage();
    await fillForm(user);

    await user.click(sendButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The transfer could not be sent. Try again.",
    );
    await user.click(sendButton());
    await screen.findByRole("list", { name: "Transfer progress" });
    expect(sent[1]).toStrictEqual(sent[0]);
  });
});

describe("M5-S06", () => {
  test("Retrying an uncertain send produces one transfer", async () => {
    serveSendPage();
    const stored = new Map<string, ReturnType<typeof transferOf>>();
    let attempts = 0;
    server.use(
      http.post("*/v1/transfers", ({ request }) => {
        attempts += 1;
        const key = request.headers.get("idempotency-key") ?? "";
        const transfer = stored.get(key) ?? transferOf("RESERVED");
        stored.set(key, transfer);
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json(transfer, { status: 202 });
      }),
      http.get("*/v1/transfers", () =>
        HttpResponse.json({ items: [...stored.values()], nextCursor: null }),
      ),
    );
    serveDetail(() => HttpResponse.json(transferOf("RESERVED")));
    const user = await openSendPage();
    await fillForm(user);
    await user.click(sendButton());
    await user.click(
      within(await screen.findByRole("alert")).getByRole("button", {
        name: "Retry",
      }),
    );
    await screen.findByRole("list", { name: "Transfer progress" });

    await user.click(screen.getByRole("link", { name: "Back to activity" }));

    const rows = await screen.findAllByRole("button", { name: /Bob Dupont/ });
    expect(rows).toHaveLength(1);
    expect(stored.size).toBe(1);
    expect(attempts).toBe(2);
  });
});
