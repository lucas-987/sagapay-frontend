import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderApp } from "../../test/render-app";
import { server } from "../../test/setup";
import { serveStream } from "../../test/stream-server";

const bob = {
  accountId: "00000000-0000-4000-a000-000000000002",
  displayName: "Bob Dupont",
};
const transferId = "7d1d2a3e-5a0e-4c7a-9a55-0c7a4b1f2e01";
const start = "2026-11-20T10:00:00Z";
const deadline = "2026-11-20T10:02:00Z";

function transferOf(status: string, confirmationDeadline?: string) {
  return {
    id: transferId,
    senderId: "julien-id",
    recipientId: bob.accountId,
    amount: { currency: "EUR", amount: "500.00" },
    status,
    createdAt: "2026-11-20T09:59:00Z",
    ...(confirmationDeadline === undefined ? {} : { confirmationDeadline }),
  };
}

function blockedEvent(withDeadline: boolean) {
  return {
    transferId,
    senderId: "julien-id",
    recipientId: bob.accountId,
    amount: "500.00",
    currency: "EUR",
    ...(withDeadline ? { confirmationDeadline: deadline } : {}),
  };
}

function serveSend(detail: { current: () => Response }) {
  server.use(
    http.get("*/v1/wallet", () =>
      HttpResponse.json({
        balance: { currency: "EUR", amount: "900.00" },
        available: { currency: "EUR", amount: "900.00" },
        held: { currency: "EUR", amount: "0.00" },
      }),
    ),
    http.get("*/v1/users/lookup", () => HttpResponse.json(bob)),
    http.get("*/v1/users/names", () => HttpResponse.json({ items: [bob] })),
    http.post("*/v1/transfers", () =>
      HttpResponse.json(transferOf("RESERVED"), { status: 202 }),
    ),
    http.get(`*/v1/transfers/${transferId}`, () => detail.current()),
  );
}

async function sendHeldTransfer(detail: { current: () => Response }) {
  const { connections } = serveStream();
  serveSend(detail);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await renderApp("/send", { stream: {} });
  await vi.waitFor(() => {
    expect(connections).toHaveLength(1);
  });
  await screen.findByText(/Available to send/);
  await user.type(screen.getByRole("combobox", { name: "Recipient" }), "bob");
  await vi.advanceTimersByTimeAsync(300);
  await user.click(
    await screen.findByRole("option", { name: "Bob Dupont @bob" }),
  );
  await user.type(screen.getByRole("textbox", { name: "Amount" }), "500.00");
  await user.click(screen.getByRole("button", { name: "Send money" }));
  await screen.findByRole("list", { name: "Transfer progress" });
  const connection = connections[0];
  if (connection === undefined) throw new Error("The stream did not open.");
  return { user, connection };
}

const prompt = () =>
  screen.queryByRole("region", { name: "Verification required" });

beforeEach(() => {
  vi.stubGlobal("jest", { advanceTimersByTime: vi.advanceTimersByTime });
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
    now: new Date(start),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the verification prompt of a sent transfer", () => {
  test.each([
    ["with its deadline", true],
    ["without its deadline", false],
  ])(
    "opens with the deadline of the detail on a blocked event %s",
    async (_name, withDeadline) => {
      const detail = {
        current: () => HttpResponse.json(transferOf("RESERVED")),
      };
      const { connection } = await sendHeldTransfer(detail);
      expect(prompt()).not.toBeInTheDocument();

      detail.current = () => HttpResponse.json(transferOf("BLOCKED", deadline));
      act(() => {
        connection.push("transfer.blocked", blockedEvent(withDeadline));
      });

      const region = await screen.findByRole("region", {
        name: "Verification required",
      });
      expect(
        within(region).getByRole("timer", { name: "Time left to verify" }),
      ).toHaveTextContent("2:00");
    },
  );

  test.each(["POSTED", "FAILED"])(
    "is not reopened by a blocked event received after the transfer is %s",
    async (status) => {
      const detail = {
        current: () =>
          HttpResponse.json(
            status === "FAILED"
              ? {
                  ...transferOf("FAILED"),
                  failureReason: "VERIFICATION_EXPIRED",
                }
              : transferOf("POSTED"),
          ),
      };
      const { connection } = await sendHeldTransfer(detail);

      act(() => {
        connection.push("transfer.blocked", blockedEvent(true));
      });
      await vi.advanceTimersByTimeAsync(500);

      expect(prompt()).not.toBeInTheDocument();
    },
  );

  test("is not reopened by a duplicate blocked event after the confirmation", async () => {
    const detail = {
      current: () => HttpResponse.json(transferOf("BLOCKED", deadline)),
    };
    const { user, connection } = await sendHeldTransfer(detail);
    act(() => {
      connection.push("transfer.blocked", blockedEvent(true), "event-1");
    });
    await screen.findByRole("region", { name: "Verification required" });
    server.use(
      http.post(`*/v1/transfers/${transferId}/confirm`, () => {
        detail.current = () => HttpResponse.json(transferOf("POSTED"));
        return HttpResponse.json(transferOf("CLEARED"), { status: 202 });
      }),
    );

    await user.type(
      screen.getByRole("textbox", { name: "Verification code" }),
      "code",
    );
    await user.click(screen.getByRole("button", { name: "Confirm transfer" }));
    await vi.waitFor(() => {
      expect(prompt()).not.toBeInTheDocument();
    });
    act(() => {
      connection.push("transfer.blocked", blockedEvent(true), "event-1");
    });
    await vi.advanceTimersByTimeAsync(500);

    expect(prompt()).not.toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Transfer progress" }),
    ).toHaveTextContent("Sent Confirmed");
  });
});
