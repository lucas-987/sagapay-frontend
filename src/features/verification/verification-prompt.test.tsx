import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  customer,
  noah,
  serveNames,
  serveTransfers,
  transferBody,
} from "../../test/activity-server";
import { Countdown } from "./countdown";
import { renderApp } from "../../test/render-app";
import { server } from "../../test/setup";

const id = "t-held";
const start = "2026-11-20T10:00:00Z";
const deadline = "2026-11-20T10:02:00Z";

interface Detail {
  senderId?: string;
  recipientId?: string;
  status?: string;
  confirmationDeadline?: string | null;
}

interface Confirm {
  body: unknown;
  authorization: string | null;
}

function serveHeld(detail: () => Detail = () => ({})) {
  const reads = { detail: 0 };
  const list = transferBody({ id, status: "BLOCKED", amount: "500.00" });
  serveTransfers({ "": { items: [list], nextCursor: null } });
  serveNames({
    "00000000-0000-4000-a000-000000000001": "Olivia Martin",
    [noah]: "Noah Williams",
  });
  server.use(
    http.get("*/v1/wallet", () =>
      HttpResponse.json({
        balance: { currency: "EUR", amount: "900.00" },
        available: { currency: "EUR", amount: "400.00" },
        held: { currency: "EUR", amount: "500.00" },
      }),
    ),
    http.get(`*/v1/transfers/${id}`, () => {
      reads.detail += 1;
      const { confirmationDeadline = deadline, ...rest } = detail();
      return HttpResponse.json({
        ...transferBody({ id, status: "BLOCKED", amount: "500.00", ...rest }),
        confirmationDeadline,
        steps: [],
      });
    }),
  );
  return reads;
}

function serveConfirm(answer: (attempt: number) => Response) {
  const confirms: Confirm[] = [];
  server.use(
    http.post(`*/v1/transfers/${id}/confirm`, async ({ request }) => {
      confirms.push({
        body: await request.json(),
        authorization: request.headers.get("authorization"),
      });
      return answer(confirms.length);
    }),
  );
  return confirms;
}

const problem = (status: number, code: string) =>
  HttpResponse.json(
    { type: "about:blank", status, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );

async function renderHeld() {
  const view = await renderApp(`/activity?transfer=${id}`);
  await screen.findByRole("region", { name: "Verification required" });
  return view;
}

async function openHeld() {
  await renderHeld();
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

const prompt = () =>
  screen.getByRole("region", { name: "Verification required" });
const timer = () =>
  within(prompt()).getByRole("timer", { name: "Time left to verify" });
const codeField = () =>
  within(prompt()).getByRole("textbox", { name: "Verification code" });
const confirmButton = () =>
  within(prompt()).getByRole("button", { name: "Confirm transfer" });

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

describe("M5-S10", () => {
  test("A wrong verification code leaves the prompt open", async () => {
    serveHeld();
    const confirms = serveConfirm(() =>
      problem(422, "INVALID_VERIFICATION_CODE"),
    );
    const user = await openHeld();
    await vi.advanceTimersByTimeAsync(10_000);

    await user.type(codeField(), "wrong-code");
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^That code is incorrect[.] Try again[.]$/,
    );
    expect(confirms).toStrictEqual([
      {
        body: { verificationToken: "wrong-code" },
        authorization: "Bearer token-of-julien-id",
      },
    ]);
    expect(codeField()).toBeEnabled();
    expect(confirmButton()).toBeEnabled();
    expect(timer()).toHaveTextContent("1:50");
  });
});

describe("M5-S11", () => {
  test("A customer cannot confirm an expired transfer", async () => {
    serveHeld();
    const confirms = serveConfirm(() => problem(410, "VERIFICATION_EXPIRED"));
    const user = await openHeld();

    await user.type(codeField(), "late-code");
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Verification expired, transfer cancelled[.]$/,
    );
    expect(confirmButton()).toBeDisabled();
    expect(codeField()).toBeDisabled();
    expect(confirms).toHaveLength(1);
  });
});

describe("M5-S12", () => {
  test("Reloading a held transfer restores its remaining confirmation time", async () => {
    serveHeld();
    const { unmount } = await renderHeld();
    expect(timer()).toHaveTextContent("2:00");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(timer()).toHaveTextContent("1:30");

    unmount();
    await renderHeld();

    expect(timer()).toHaveTextContent("1:30");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(timer()).toHaveTextContent("1:29");
  });
});

describe("the verification prompt", () => {
  test("sends the trimmed code to the confirm endpoint and waits for the server's state", async () => {
    let state = "BLOCKED";
    const reads = serveHeld(() => ({ status: state }));
    const confirms = serveConfirm(() => {
      state = "CLEARED";
      return HttpResponse.json(
        transferBody({ id, status: "CLEARED", amount: "500.00" }),
        { status: 202 },
      );
    });
    const user = await openHeld();
    const before = reads.detail;

    await user.type(codeField(), "  right-code  ");
    await user.click(confirmButton());

    await vi.waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Verification required" }),
      ).not.toBeInTheDocument();
    });
    expect(confirms.map(({ body }) => body)).toStrictEqual([
      { verificationToken: "right-code" },
    ]);
    expect(reads.detail).toBe(before + 1);
    expect(screen.getByText("Checked")).toBeVisible();
  });

  test("shows the acceptance and blocks a second confirmation while the transfer is still held", async () => {
    serveHeld();
    const confirms = serveConfirm(() =>
      HttpResponse.json(transferBody({ id, status: "BLOCKED" }), {
        status: 202,
      }),
    );
    const user = await openHeld();

    await user.type(codeField(), "right-code");
    await user.click(confirmButton());

    expect(
      await screen.findByText(
        "Code accepted. Your transfer is being completed.",
      ),
    ).toBeVisible();
    expect(confirmButton()).toBeDisabled();
    expect(confirms).toHaveLength(1);
  });

  test("closes and shows the current state on 409", async () => {
    let state = "BLOCKED";
    serveHeld(() => ({ status: state }));
    serveConfirm(() => {
      state = "POSTED";
      return problem(409, "TRANSFER_NOT_BLOCKED");
    });
    const user = await openHeld();

    await user.type(codeField(), "code");
    await user.click(confirmButton());

    await vi.waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Verification required" }),
      ).not.toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("dialog")).getByText("Completed"),
    ).toBeVisible();
  });

  test("closes the prompt on 409 even while the detail still says held", async () => {
    serveHeld();
    serveConfirm(() => problem(409, "TRANSFER_NOT_BLOCKED"));
    const user = await openHeld();

    await user.type(codeField(), "code");
    await user.click(confirmButton());

    await vi.waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Verification required" }),
      ).not.toBeInTheDocument();
    });
  });

  test("reports an unknown transfer on 404 and disables confirm", async () => {
    serveHeld();
    serveConfirm(() => problem(404, "TRANSFER_NOT_FOUND"));
    const user = await openHeld();

    await user.type(codeField(), "code");
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^This transfer was not found[.]$/,
    );
    expect(confirmButton()).toBeDisabled();
  });

  test("keeps the prompt open and asks to try again after another failure", async () => {
    serveHeld();
    serveConfirm(() => new HttpResponse(null, { status: 500 }));
    const user = await openHeld();

    await user.type(codeField(), "code");
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^The code could not be checked[.] Try again[.]$/,
    );
    expect(confirmButton()).toBeEnabled();
  });

  test.each([
    ["empty", ""],
    ["blank", "   "],
  ])("refuses an %s code without a request", async (_name, typed) => {
    serveHeld();
    const confirms = serveConfirm(() =>
      problem(422, "INVALID_VERIFICATION_CODE"),
    );
    const user = await openHeld();

    if (typed !== "") await user.type(codeField(), typed);
    await user.click(confirmButton());

    expect(
      await screen.findByText("Enter the verification code."),
    ).toBeVisible();
    expect(codeField()).toBeInvalid();
    expect(confirms).toHaveLength(0);
  });

  test("disables confirm when the countdown reaches zero and sends nothing", async () => {
    serveHeld();
    const confirms = serveConfirm(() => problem(410, "VERIFICATION_EXPIRED"));
    const user = await openHeld();
    await user.type(codeField(), "code");

    await vi.advanceTimersByTimeAsync(119_000);
    expect(timer()).toHaveTextContent("0:01");
    expect(confirmButton()).toBeEnabled();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(timer()).toHaveTextContent("0:00");
    expect(confirmButton()).toBeDisabled();
    expect(codeField()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /^The confirmation time is over[.] Waiting for the final state of the transfer[.]$/,
    );
    expect(confirms).toHaveLength(0);
  });

  test("ticks at each whole second of a deadline with milliseconds", async () => {
    serveHeld(() => ({ confirmationDeadline: "2026-11-20T10:02:00.250Z" }));
    await openHeld();
    expect(timer()).toHaveTextContent("2:01");

    await vi.advanceTimersByTimeAsync(250);
    expect(timer()).toHaveTextContent("2:00");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(timer()).toHaveTextContent("1:59");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(timer()).toHaveTextContent("1:58");
  });

  test("counts down to a deadline written with another offset", async () => {
    serveHeld(() => ({ confirmationDeadline: "2026-11-20T12:01:00+02:00" }));
    await openHeld();

    expect(timer()).toHaveTextContent("1:00");
  });

  test("shows no prompt to the recipient", async () => {
    serveHeld(() => ({
      senderId: noah,
      recipientId: customer,
      confirmationDeadline: null,
    }));
    await renderApp(`/activity?transfer=${id}`);

    const drawer = await screen.findByRole("dialog");
    await within(drawer).findByText("Received from Noah Williams");
    expect(
      screen.queryByRole("region", { name: "Verification required" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm transfer" }),
    ).not.toBeInTheDocument();
  });

  test("shows no prompt to the recipient even when a deadline is present", async () => {
    serveHeld(() => ({ senderId: noah, recipientId: customer }));
    await renderApp(`/activity?transfer=${id}`);

    const drawer = await screen.findByRole("dialog");
    await within(drawer).findByText("Received from Noah Williams");
    expect(
      screen.queryByRole("region", { name: "Verification required" }),
    ).not.toBeInTheDocument();
  });

  test("shows no prompt for a held transfer without a deadline", async () => {
    serveHeld(() => ({ confirmationDeadline: null }));
    await renderApp(`/activity?transfer=${id}`);

    const drawer = await screen.findByRole("dialog");
    await within(drawer).findByText("Verification needed");
    expect(
      screen.queryByRole("region", { name: "Verification required" }),
    ).not.toBeInTheDocument();
  });

  test.each(["POSTED", "FAILED", "CLEARED", "SCREENING"])(
    "shows no prompt for a %s transfer that still carries a deadline",
    async (status) => {
      serveHeld(() => ({ status }));
      await renderApp(`/activity?transfer=${id}`);

      const drawer = await screen.findByRole("dialog");
      await within(drawer).findByText(/Sent to/);
      expect(
        screen.queryByRole("region", { name: "Verification required" }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("the prompt of another transfer", () => {
  const other = "t-other";

  test("starts afresh when the drawer returns to another held transfer, already loaded, after a 409", async () => {
    serveHeld();
    server.use(
      http.get(`*/v1/transfers/${other}`, () =>
        HttpResponse.json({
          ...transferBody({
            id: other,
            status: "BLOCKED",
            amount: "70.00",
          }),
          confirmationDeadline: "2026-11-20T10:01:00Z",
          steps: [],
        }),
      ),
    );
    serveConfirm(() => problem(409, "TRANSFER_NOT_BLOCKED"));
    const { router } = await renderApp(`/activity?transfer=${other}`);
    await screen.findByRole("region", { name: "Verification required" });
    await act(() => router.navigate(`/activity?transfer=${id}`));
    await screen.findByText("Sent to Olivia Martin");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(codeField(), "code-of-the-first");
    await user.click(confirmButton());
    await vi.waitFor(() => {
      expect(
        screen.queryByRole("region", { name: "Verification required" }),
      ).not.toBeInTheDocument();
    });

    await act(() => router.navigate(`/activity?transfer=${other}`));

    expect(
      await screen.findByRole("region", { name: "Verification required" }),
    ).toBeVisible();
    expect(timer()).toHaveTextContent("1:00");
    expect(codeField()).toHaveValue("");
    expect(codeField()).toBeEnabled();
    expect(confirmButton()).toBeEnabled();
  });
});

describe("the confirm call", () => {
  test("sends one request when the confirm button is pressed again while the first is pending", async () => {
    serveHeld();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const confirms: unknown[] = [];
    server.use(
      http.post(`*/v1/transfers/${id}/confirm`, async ({ request }) => {
        confirms.push(await request.json());
        await gate;
        return problem(422, "INVALID_VERIFICATION_CODE");
      }),
    );
    const user = await openHeld();
    await user.type(codeField(), "code");

    await user.click(confirmButton());
    await vi.waitFor(() => {
      expect(confirmButton()).toBeDisabled();
    });
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime, pointerEventsCheck: 0 })
      .click(confirmButton());
    release();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^That code is incorrect[.] Try again[.]$/,
    );
    expect(confirms).toStrictEqual([{ verificationToken: "code" }]);
  });

  test("keeps the focus in the code field when the code is sent with Enter and refused", async () => {
    serveHeld();
    serveConfirm(() => problem(422, "INVALID_VERIFICATION_CODE"));
    const user = await openHeld();

    await user.type(codeField(), "wrong-code{Enter}");

    await screen.findByRole("alert");
    expect(codeField()).toHaveFocus();
  });

  test("asks to try again and keeps the prompt enabled after a network failure", async () => {
    serveHeld();
    serveConfirm(() => HttpResponse.error());
    const user = await openHeld();

    await user.type(codeField(), "code");
    await user.click(confirmButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^The code could not be checked[.] Try again[.]$/,
    );
    expect(codeField()).toBeEnabled();
    expect(confirmButton()).toBeEnabled();
  });
});

describe("the urgency of the countdown", () => {
  test.each([
    ["at exactly 10 seconds", 10_000, { animationDuration: "1s" }],
    ["just above 10 seconds", 10_001, { animationName: "none" }],
    ["at zero", 0, { animationName: "none" }],
  ])("pulses %s left: %s", (_name, remainingMs, style) => {
    render(<Countdown remainingMs={remainingMs} />);

    expect(screen.getByRole("timer")).toHaveStyle(style);
  });
});

describe("the countdown", () => {
  function stubReducedMotion(reduced: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: reduced && query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  }

  test("pulses in its last seconds", async () => {
    stubReducedMotion(false);
    serveHeld(() => ({ confirmationDeadline: "2026-11-20T10:00:05Z" }));
    await openHeld();

    expect(timer()).toHaveStyle({ animationDuration: "1s" });
  });

  test("does not animate when reduced motion is requested", async () => {
    stubReducedMotion(true);
    serveHeld(() => ({ confirmationDeadline: "2026-11-20T10:00:05Z" }));
    await openHeld();

    expect(timer()).toHaveStyle({ animationName: "none" });
  });

  test("does not animate before its last seconds", async () => {
    stubReducedMotion(false);
    serveHeld();
    await openHeld();

    expect(timer()).toHaveStyle({ animationName: "none" });
  });
});
