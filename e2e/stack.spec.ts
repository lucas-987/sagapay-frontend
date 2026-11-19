import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test } from "@playwright/test";
import { signIn } from "./sagapay-session";

test.use({ trace: "off" });

// The gateway's stream sends a comment line at a fixed interval of 15 s; waiting
// slightly longer proves the proxy keeps an idle stream open across a heartbeat.
const heartbeatWaitMs = 16_000;
// Ids and starting balance of the sample accounts that the ledger seeds for the
// `julien` and `gina` identities; the transfer below moves a small amount from
// one to the other, so each run consumes a little of julien's balance.
const julienAccountId = "00000000-0000-4000-a000-000000000010";
const ginaAccountId = "00000000-0000-4000-a000-000000000007";

for (const [path, heading] of [
  ["/activity", "Activity"],
  ["/send", "Send money"],
] as const) {
  test(`serves the built SPA at ${path} on direct entry and reload`, async ({
    page,
  }) => {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page).toHaveURL(path);
    await expect(
      page.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();

    expect((await page.reload())?.status()).toBe(200);
    await expect(page).toHaveURL(path);
    await expect(
      page.getByRole("heading", { level: 1, name: heading, exact: true }),
    ).toBeVisible();
  });
}

test("proxies the gateway's bearer challenge", async ({ request }) => {
  const response = await request.get("/v1/wallet");
  expect(response.status()).toBe(401);
  expect(response.headers()["www-authenticate"]).toBe("Bearer");
});

test("proxies the bare /v1 path to the gateway", async ({ request }) => {
  const response = await request.get("/v1");
  expect(response.status()).toBe(401);
  expect(response.headers()["www-authenticate"]).toBe("Bearer");
});

test("keeps a path that only starts with /v1 in the SPA", async ({
  request,
}) => {
  const response = await request.get("/v1x");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/html");
  expect(await response.text()).toContain("<title>SagaPay</title>");
});

test("falls back to the SPA shell on a nested unknown path", async ({
  request,
}) => {
  const response = await request.get("/activity/2024/unknown");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/html");
  expect(await response.text()).toContain("<title>SagaPay</title>");
});

test("serves the built script with its JavaScript type", async ({
  request,
}) => {
  const shell = await (await request.get("/")).text();
  const script = /<script[^>]* src="([^"]+\.js)"/.exec(shell)?.[1];
  if (!script) throw new Error("The served shell references no script");
  const response = await request.get(script);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/javascript");
});

async function* readFrames(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  try {
    for (
      let chunk = await reader.read();
      !chunk.done;
      chunk = await reader.read()
    ) {
      buffer += decoder.decode(chunk.value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      yield* frames;
    }
  } finally {
    reader.releaseLock();
  }
}

test("forwards uncached activity frames immediately and survives an idle heartbeat", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(75_000);
  if (!baseURL) throw new Error("Set SAGAPAY_BASE_URL for the browser stack");

  const senderId = julienAccountId;
  const recipientId = ginaAccountId;
  const amount = { amount: "1.23", currency: "EUR" };
  const bearer = `Bearer ${await signIn(page, baseURL, "julien")}`;
  const controller = new AbortController();
  const openDeadline = setTimeout(() => {
    controller.abort(
      new Error("Activity stream did not open within five seconds"),
    );
  }, 5_000);

  try {
    const response = await fetch(new URL("/v1/stream/activity", baseURL), {
      headers: { Accept: "text/event-stream", Authorization: bearer },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50_000)]),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(
      /^text\/event-stream(?:;|$)/,
    );
    // The gateway's default security headers; the proxy adds nothing to them
    // and must not turn on its own buffering or length framing.
    expect(response.headers.get("cache-control")).toBe(
      "no-cache, no-store, max-age=0, must-revalidate",
    );
    expect(response.headers.get("x-accel-buffering")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    if (!response.body) throw new Error("Activity response had no body");
    const frames = readFrames(response.body);
    expect((await frames.next()).value).toMatch(/^: ?open$/);
    clearTimeout(openDeadline);

    const [heartbeat] = await Promise.all([
      frames.next(),
      delay(heartbeatWaitMs, undefined, { signal: controller.signal }),
    ]);
    expect(heartbeat.value).toMatch(/^: ?ping$/);

    const transfer = await page.request.post("/v1/transfers", {
      headers: { Authorization: bearer, "Idempotency-Key": randomUUID() },
      data: { toUserId: recipientId, amount },
    });
    expect(transfer.status()).toBe(202);
    const receipt: unknown = await transfer.json();
    if (
      typeof receipt !== "object" ||
      receipt === null ||
      !("id" in receipt) ||
      typeof receipt.id !== "string"
    ) {
      throw new Error("The transfer response did not include its id");
    }

    let event;
    do {
      event = (await frames.next()).value;
    } while (event && /^: ?ping$/.test(event));
    if (!event) throw new Error("The stream ended before the transfer event");
    const lines = event.split(/\r?\n/);
    expect(lines.find((line) => line.startsWith("event:"))).toMatch(
      /^event: ?transfer\.posted$/,
    );
    expect(lines.find((line) => line.startsWith("id:"))).toMatch(
      /^id: ?[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/,
    );
    const data: unknown = JSON.parse(
      lines.find((line) => line.startsWith("data:"))?.slice(5) ?? "",
    );
    expect(data).toEqual({
      transferId: receipt.id,
      senderId,
      recipientId,
      amount: "1.2300",
      currency: "EUR",
    });
  } finally {
    clearTimeout(openDeadline);
    controller.abort();
  }
});
