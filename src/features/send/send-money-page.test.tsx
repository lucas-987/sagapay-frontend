import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderApp } from "../../test/render-app";
import { server } from "../../test/setup";

const walletUrl = new URL("/v1/wallet", location.origin).toString();

const alice = {
  accountId: "00000000-0000-4000-a000-000000000001",
  displayName: "Alice Martin",
};
const bob = {
  accountId: "00000000-0000-4000-a000-000000000002",
  displayName: "Bob Dupont",
};

function serveWallet(available: string) {
  server.use(
    http.get(walletUrl, () =>
      HttpResponse.json({
        balance: { currency: "EUR", amount: available },
        available: { currency: "EUR", amount: available },
        held: { currency: "EUR", amount: "0.00" },
      }),
    ),
  );
}

function serveLookup(
  respond: (handle: string) => Response | Promise<Response>,
) {
  const handles: string[] = [];
  server.use(
    http.get("*/v1/users/lookup", ({ request }) => {
      const handle = new URL(request.url).searchParams.get("handle") ?? "";
      handles.push(handle);
      return respond(handle);
    }),
  );
  return handles;
}

function notFound() {
  return HttpResponse.json(
    { status: 404, code: "RECIPIENT_NOT_FOUND" },
    { status: 404, headers: { "content-type": "application/problem+json" } },
  );
}

function knownAccounts(handle: string) {
  if (handle === "alice") return HttpResponse.json(alice);
  if (handle === "bob") return HttpResponse.json(bob);
  return notFound();
}

async function openSendPage(available = "4285.50") {
  serveWallet(available);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const user = userEvent.setup({ delay: null });
  await renderApp("/send");
  await screen.findByText(/Available to send/);
  return user;
}

async function settleLookup(ms = 300) {
  await vi.advanceTimersByTimeAsync(ms);
}

async function chooseRecipient(
  user: ReturnType<typeof userEvent.setup>,
  handle: string,
  name: string,
) {
  await user.type(screen.getByRole("combobox", { name: "Recipient" }), handle);
  await settleLookup();
  await user.click(await screen.findByRole("option", { name }));
}

const sendButton = () => screen.getByRole("button", { name: "Send money" });
const amountField = () => screen.getByRole("textbox", { name: "Amount" });

beforeEach(() => {
  // Testing Library only advances fake timers for waitFor when it finds a
  // `jest` global exposing advanceTimersByTime.
  vi.stubGlobal("jest", { advanceTimersByTime: vi.advanceTimersByTime });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the send form", () => {
  test("labels every field and keeps the send control disabled at first", async () => {
    await openSendPage();

    expect(screen.getByRole("combobox", { name: "Recipient" })).toBeVisible();
    expect(amountField()).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Note (optional)" }),
    ).toBeVisible();
    expect(screen.getByText("Available to send: 4,285.50 EUR")).toBeVisible();
    expect(sendButton()).toBeDisabled();
  });

  test("keeps the send control disabled while the balance is unknown", async () => {
    server.use(
      http.get(walletUrl, async () => {
        await delay(1000);
        return HttpResponse.json({
          balance: { currency: "EUR", amount: "10.00" },
          available: { currency: "EUR", amount: "10.00" },
          held: { currency: "EUR", amount: "0.00" },
        });
      }),
    );
    serveLookup(knownAccounts);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const user = userEvent.setup({ delay: null });
    await renderApp("/send");

    expect(screen.getByText("Loading your balance…")).toBeVisible();
    await chooseRecipient(user, "alice", "Alice Martin @alice");
    await user.type(amountField(), "5.00");

    expect(sendButton()).toBeDisabled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await screen.findByText(/Available to send/)).toBeVisible();
    expect(sendButton()).toBeEnabled();
  });

  test("offers to read the balance again when it could not be loaded", async () => {
    let answers = 0;
    server.use(
      http.get(walletUrl, () => {
        answers += 1;
        return answers === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({
              balance: { currency: "EUR", amount: "10.00" },
              available: { currency: "EUR", amount: "10.00" },
              held: { currency: "EUR", amount: "0.00" },
            });
      }),
    );
    const user = userEvent.setup({ delay: null });
    await renderApp("/send");

    expect(
      await screen.findByText("Your balance could not be loaded."),
    ).toBeVisible();
    expect(sendButton()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByText("Available to send: 10.00 EUR"),
    ).toBeVisible();
  });
});

async function openNotePage() {
  serveLookup(knownAccounts);
  const user = userEvent.setup({ delay: null });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  serveWallet("100.00");
  await renderApp("/send");
  await screen.findByText(/Available to send/);
  await chooseRecipient(user, "alice", "Alice Martin @alice");
  await user.type(amountField(), "5.00");
  const note = screen.getByRole("textbox", { name: "Note (optional)" });
  await user.click(note);
  return { user, note };
}

describe("M5-S21", () => {
  test("A note of 200 characters is accepted", async () => {
    const { user, note } = await openNotePage();

    await user.paste("a".repeat(200));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(note).toBeValid();
    expect(sendButton()).toBeEnabled();
  });

  test("A note that is too long cannot be sent", async () => {
    const { user, note } = await openNotePage();

    await user.paste("a".repeat(201));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^The note can have at most 200 characters\.$/,
    );
    expect(note).toBeInvalid();
    expect(sendButton()).toBeDisabled();
  });
});

describe("the recipient lookup", () => {
  test("sends one lookup, 300 ms after the last keystroke", async () => {
    const handles = serveLookup(knownAccounts);
    const user = await openSendPage();

    await user.type(screen.getByRole("combobox", { name: "Recipient" }), "ali");
    await settleLookup(299);
    expect(handles).toEqual([]);
    await user.type(screen.getByRole("combobox", { name: "Recipient" }), "ce");
    await settleLookup(299);
    expect(handles).toEqual([]);
    await settleLookup(1);

    await vi.waitFor(() => {
      expect(handles).toEqual(["alice"]);
    });
  });

  test.each([
    { name: "a leading @", typed: "@alice" },
    { name: "capitals", typed: "ALICE" },
    { name: "surrounding spaces", typed: "  alice  " },
  ])("asks for the normalised handle despite $name", async ({ typed }) => {
    const handles = serveLookup(knownAccounts);
    const user = await openSendPage();

    await user.type(screen.getByRole("combobox", { name: "Recipient" }), typed);
    await settleLookup();

    await vi.waitFor(() => {
      expect(handles).toEqual(["alice"]);
    });
  });

  test.each([{ typed: "" }, { typed: "@" }, { typed: "   " }])(
    "sends no lookup for the field '$typed'",
    async ({ typed }) => {
      const handles = serveLookup(knownAccounts);
      const user = await openSendPage();

      await user.type(
        screen.getByRole("combobox", { name: "Recipient" }),
        typed === "" ? "x{Backspace}" : typed,
      );
      await settleLookup(1000);

      expect(handles).toEqual([]);
    },
  );

  test("offers the account found and selects it", async () => {
    serveLookup(knownAccounts);
    const user = await openSendPage();

    await chooseRecipient(user, "alice", "Alice Martin @alice");

    expect(screen.getByRole("combobox", { name: "Recipient" })).toHaveValue(
      "Alice Martin (@alice)",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("forgets the selection when the handle is edited", async () => {
    serveLookup(knownAccounts);
    const user = await openSendPage();
    await chooseRecipient(user, "alice", "Alice Martin @alice");
    await user.type(amountField(), "5.00");
    expect(sendButton()).toBeEnabled();

    await user.type(
      screen.getByRole("combobox", { name: "Recipient" }),
      "{Backspace}",
    );

    expect(sendButton()).toBeDisabled();
  });

  test("forgets the selection when the field is cleared", async () => {
    serveLookup(knownAccounts);
    const user = await openSendPage();
    await chooseRecipient(user, "alice", "Alice Martin @alice");
    await user.type(amountField(), "5.00");

    await user.click(screen.getByTitle("Clear"));

    expect(screen.getByRole("combobox", { name: "Recipient" })).toHaveValue("");
    expect(sendButton()).toBeDisabled();
  });

  test("ignores an answer for a handle no longer in the field", async () => {
    const handles = serveLookup(async (handle) => {
      if (handle === "bob") await delay(1000);
      return knownAccounts(handle);
    });
    const user = await openSendPage();
    const field = screen.getByRole("combobox", { name: "Recipient" });

    await user.type(field, "bob");
    await settleLookup();
    await vi.waitFor(() => {
      expect(handles).toEqual(["bob"]);
    });
    await user.clear(field);
    await user.type(field, "alice");
    await settleLookup();
    expect(await screen.findByRole("option")).toHaveAccessibleName(
      "Alice Martin @alice",
    );

    await settleLookup(1000);

    expect(handles).toEqual(["bob", "alice"]);
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveAccessibleName(
      "Alice Martin @alice",
    );
    expect(screen.queryByText("Bob Dupont")).toBeNull();
  });

  test("ignores an answer that arrives while a newer handle is being typed", async () => {
    const handles = serveLookup(async (handle) => {
      if (handle === "bob") await delay(1000);
      return knownAccounts(handle);
    });
    const user = await openSendPage();
    const field = screen.getByRole("combobox", { name: "Recipient" });
    await user.type(field, "bob");
    await settleLookup();

    await user.type(field, "x");
    await settleLookup(1000);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^No recipient found$/,
    );
    expect(screen.queryByRole("option")).toBeNull();
    expect(sendButton()).toBeDisabled();
    expect(handles).toEqual(["bob", "bobx"]);
  });

  test("shows a retryable message when the lookup fails, and keeps send disabled", async () => {
    let failing = true;
    const handles = serveLookup((handle) =>
      failing ? HttpResponse.error() : knownAccounts(handle),
    );
    const user = await openSendPage();
    await user.type(amountField(), "5.00");
    await user.type(
      screen.getByRole("combobox", { name: "Recipient" }),
      "alice",
    );
    await settleLookup();

    expect(
      within(await screen.findByRole("alert")).getByText(
        "The recipient could not be looked up.",
      ),
    ).toBeVisible();
    expect(sendButton()).toBeDisabled();

    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(
      await screen.findByRole("option", { name: "Alice Martin @alice" }),
    );

    expect(handles).toEqual(["alice", "alice"]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(sendButton()).toBeEnabled();
  });

  test("shows a retryable message when the answer lacks the account", async () => {
    serveLookup(() => HttpResponse.json({ displayName: "Nobody" }));
    const user = await openSendPage();

    await user.type(
      screen.getByRole("combobox", { name: "Recipient" }),
      "alice",
    );
    await settleLookup();

    expect(
      within(await screen.findByRole("alert")).getByText(
        "The recipient could not be looked up.",
      ),
    ).toBeVisible();
  });
});

describe("M5-S04", () => {
  test("An unknown handle cannot be selected", async () => {
    serveLookup(knownAccounts);
    const user = await openSendPage();
    await user.type(amountField(), "5.00");

    await user.type(
      screen.getByRole("combobox", { name: "Recipient" }),
      "@nobody",
    );
    await settleLookup();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^No recipient found$/,
    );
    expect(screen.getByRole("combobox", { name: "Recipient" })).toBeInvalid();
    expect(screen.queryByRole("option")).toBeNull();
    expect(sendButton()).toBeDisabled();
  });
});

describe("M5-S05", () => {
  test("An invalid amount cannot be sent", async () => {
    serveLookup(knownAccounts);
    const user = await openSendPage();
    await chooseRecipient(user, "alice", "Alice Martin @alice");

    await user.type(amountField(), "1.001");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^EUR amounts have at most 2 decimal places\.$/,
    );
    expect(amountField()).toBeInvalid();
    expect(sendButton()).toBeDisabled();
  });

  test.each([
    {
      name: "a comma separator",
      typed: "1,5",
      message: "Write the amount in digits with a dot, for example 12.50.",
    },
    {
      name: "an exponent",
      typed: "1e3",
      message: "Write the amount in digits with a dot, for example 12.50.",
    },
    {
      name: "zero",
      typed: "0.00",
      message: "The amount must be greater than zero.",
    },
    {
      name: "a negative amount",
      typed: "-5",
      message: "The amount must be greater than zero.",
    },
  ])("refuses $name inline", async ({ typed, message }) => {
    serveLookup(knownAccounts);
    const user = await openSendPage("100.00");
    await chooseRecipient(user, "alice", "Alice Martin @alice");

    await user.type(amountField(), typed);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(message)).toBeVisible();
    expect(sendButton()).toBeDisabled();
  });

  test("keeps send disabled and shows no error while the amount is empty", async () => {
    serveLookup(knownAccounts);
    const user = await openSendPage();
    await chooseRecipient(user, "alice", "Alice Martin @alice");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(sendButton()).toBeDisabled();
  });
});

describe("M5-S20", () => {
  test("An amount equal to the available funds is accepted", async () => {
    serveLookup(knownAccounts);
    const user = await openSendPage("100.00");
    await chooseRecipient(user, "alice", "Alice Martin @alice");

    await user.type(amountField(), "100.00");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(amountField()).toBeValid();
    expect(sendButton()).toBeEnabled();
  });

  test("An amount above the available funds cannot be sent", async () => {
    serveLookup(knownAccounts);
    const user = await openSendPage("100.00");
    await chooseRecipient(user, "alice", "Alice Martin @alice");

    await user.type(amountField(), "100.01");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^The amount is above your available balance of 100\.00 EUR\.$/,
    );
    expect(amountField()).toBeInvalid();
    expect(sendButton()).toBeDisabled();
  });
});
