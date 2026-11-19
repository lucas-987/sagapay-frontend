import { describe, expect, test, vi } from "vitest";
import { fakeOidcClient, userOf } from "../test/fake-oidc-client";
import {
  createAuthAdapter,
  safeReturnPath,
  type SessionEvent,
} from "./auth-adapter";

const julien = userOf({ subject: "julien-id", name: "Julien Simon" });

function recordedEvents(adapter: ReturnType<typeof createAuthAdapter>) {
  const events: SessionEvent[] = [];
  adapter.onEvent((event) => events.push(event));
  return events;
}

describe("initialization", () => {
  test("starts loading, then signed in with the stored customer", async () => {
    const adapter = createAuthAdapter(fakeOidcClient(julien).client);
    expect(adapter.getState()).toEqual({ status: "loading" });

    await adapter.initialize();

    expect(adapter.getState()).toEqual({
      status: "signed-in",
      subject: "julien-id",
      displayName: "Julien Simon",
    });
  });

  test("is signed out when nobody is stored", async () => {
    const adapter = createAuthAdapter(fakeOidcClient(null).client);

    await adapter.initialize();

    expect(adapter.getState()).toEqual({ status: "signed-out" });
  });

  test("is signed out when the stored token already expired", async () => {
    const stale = userOf({ subject: "julien-id", expiresAt: 1 });
    const adapter = createAuthAdapter(fakeOidcClient(stale).client);

    await adapter.initialize();

    expect(adapter.getState()).toEqual({ status: "signed-out" });
  });

  test("does not overwrite a customer who signed in while it was loading", async () => {
    const fake = fakeOidcClient(null);
    const adapter = createAuthAdapter(fake.client);
    const initializing = adapter.initialize();

    fake.load(julien);
    await initializing;

    expect(adapter.getState()).toEqual({
      status: "signed-in",
      subject: "julien-id",
      displayName: "Julien Simon",
    });
  });

  test.each([
    {
      claims: { subject: "s", name: "Julien Simon" },
      expected: "Julien Simon",
    },
    { claims: { subject: "s" }, expected: "Customer" },
  ])(
    "displays $expected for the claims $claims",
    async ({ claims, expected }) => {
      const adapter = createAuthAdapter(fakeOidcClient(userOf(claims)).client);

      await adapter.initialize();

      expect(adapter.getState()).toEqual({
        status: "signed-in",
        subject: "s",
        displayName: expected,
      });
    },
  );
});

describe("sign in", () => {
  test("redirects to Keycloak carrying the requested path as state", async () => {
    const fake = fakeOidcClient();
    const adapter = createAuthAdapter(fake.client);

    await adapter.signIn("/activity?page=2");

    expect(fake.client.signinRedirect.mock.calls).toEqual([
      [{ state: "/activity?page=2" }],
    ]);
  });

  test("returns the requested path once the callback is processed", async () => {
    const fake = fakeOidcClient();
    fake.client.signinCallback.mockImplementation(() => {
      fake.load(julien);
      return Promise.resolve(
        userOf({ subject: "julien-id", state: "/activity?page=2" }),
      );
    });
    const adapter = createAuthAdapter(fake.client);
    const url = "http://localhost:8088/auth/callback?code=c&state=s";

    const path = await adapter.completeSignIn(url);

    expect(path).toBe("/activity?page=2");
    expect(fake.client.signinCallback.mock.calls).toEqual([[url]]);
    expect(adapter.getState()).toEqual({
      status: "signed-in",
      subject: "julien-id",
      displayName: "Julien Simon",
    });
  });

  test("processes one callback url once", async () => {
    const fake = fakeOidcClient();
    fake.client.signinCallback.mockResolvedValue(
      userOf({ subject: "julien-id", state: "/send" }),
    );
    const adapter = createAuthAdapter(fake.client);
    const url = "http://localhost:8088/auth/callback?code=c&state=s";

    const first = await adapter.completeSignIn(url);
    const second = await adapter.completeSignIn(url);

    expect([first, second]).toEqual(["/send", "/send"]);
    expect(fake.client.signinCallback).toHaveBeenCalledTimes(1);
  });

  test("goes to the activity page when Keycloak's response is refused", async () => {
    const fake = fakeOidcClient();
    fake.client.signinCallback.mockRejectedValue(
      new Error("No matching state found in storage"),
    );
    const adapter = createAuthAdapter(fake.client);

    expect(await adapter.completeSignIn("http://x/auth/callback")).toBe(
      "/activity",
    );
  });

  test("goes to the activity page when the callback returns no customer", async () => {
    const fake = fakeOidcClient();
    const adapter = createAuthAdapter(fake.client);

    expect(await adapter.completeSignIn("http://x/auth/callback")).toBe(
      "/activity",
    );
  });
});

describe("safeReturnPath", () => {
  test.each([
    { value: "/activity", expected: "/activity" },
    { value: "/send", expected: "/send" },
    { value: "/activity?page=2#top", expected: "/activity?page=2#top" },
    { value: undefined, expected: "/activity" },
    { value: null, expected: "/activity" },
    { value: 42, expected: "/activity" },
    { value: "", expected: "/activity" },
    { value: "activity", expected: "/activity" },
    { value: "https://evil.example/", expected: "/activity" },
    { value: "//evil.example/", expected: "/activity" },
    { value: "/\\evil.example/", expected: "/activity" },
    { value: "/\t/evil.example/", expected: "/activity" },
    { value: "/auth/callback?code=c", expected: "/activity" },
    { value: "javascript:alert(1)", expected: "/activity" },
  ])("maps $value to $expected", ({ value, expected }) => {
    expect(safeReturnPath(value)).toBe(expected);
  });
});

describe("token supply", () => {
  test("supplies the access token of the signed-in customer", async () => {
    const adapter = createAuthAdapter(fakeOidcClient(julien).client);

    expect(await adapter.getAccessToken()).toBe("token-of-julien-id");
  });

  test("supplies the renewed token as soon as the renewal loads it", async () => {
    const fake = fakeOidcClient(julien);
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();

    fake.load(userOf({ subject: "julien-id", token: "renewed" }));

    expect(await adapter.getAccessToken()).toBe("renewed");
  });

  test("supplies no token when nobody is signed in", async () => {
    const adapter = createAuthAdapter(fakeOidcClient(null).client);

    expect(await adapter.getAccessToken()).toBeNull();
  });

  test("supplies no token once the stored one expired", async () => {
    const stale = userOf({ subject: "julien-id", expiresAt: 1 });
    const adapter = createAuthAdapter(fakeOidcClient(stale).client);

    expect(await adapter.getAccessToken()).toBeNull();
  });
});

describe("renewal and expiry", () => {
  test("a renewal of the same customer changes no state and emits nothing", async () => {
    const fake = fakeOidcClient(julien);
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();
    const events = recordedEvents(adapter);

    fake.load(userOf({ subject: "julien-id", name: "Julien Simon" }));

    expect(events).toEqual([]);
    expect(adapter.getState()).toEqual({
      status: "signed-in",
      subject: "julien-id",
      displayName: "Julien Simon",
    });
  });

  test("a failed renewal signs the customer out and emits expired", async () => {
    const fake = fakeOidcClient(julien);
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();
    const events = recordedEvents(adapter);

    fake.failRenewal();

    expect(events).toEqual(["expired"]);
    expect(adapter.getState()).toEqual({ status: "signed-out" });
  });

  test("an expired token signs the customer out and emits expired", async () => {
    const fake = fakeOidcClient(julien);
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();
    const events = recordedEvents(adapter);

    fake.expire();

    expect(events).toEqual(["expired"]);
    expect(adapter.getState()).toEqual({ status: "signed-out" });
  });

  test("a failed renewal followed by the expiry emits expired once", async () => {
    const fake = fakeOidcClient(julien);
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();
    const events = recordedEvents(adapter);

    fake.failRenewal();
    fake.expire();

    expect(events).toEqual(["expired"]);
  });

  test("the expiry of nobody's token emits nothing", async () => {
    const fake = fakeOidcClient(null);
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();
    const events = recordedEvents(adapter);

    fake.expire();

    expect(events).toEqual([]);
  });

  test("another customer loaded in place of the first emits user-changed before the state changes", async () => {
    const fake = fakeOidcClient(julien);
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();
    const seen: unknown[] = [];
    adapter.onEvent(() => seen.push(adapter.getState()));

    fake.load(userOf({ subject: "gina-id", name: "Gina Rossi" }));

    expect(seen).toEqual([
      {
        status: "signed-in",
        subject: "julien-id",
        displayName: "Julien Simon",
      },
    ]);
    expect(adapter.getState()).toEqual({
      status: "signed-in",
      subject: "gina-id",
      displayName: "Gina Rossi",
    });
  });
});

describe("sign out", () => {
  test("emits signed-out, then leaves through Keycloak's end-session page", async () => {
    const fake = fakeOidcClient(julien);
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();
    const events = recordedEvents(adapter);

    await adapter.signOut();

    expect(events).toEqual(["signed-out"]);
    expect(fake.client.signoutRedirect).toHaveBeenCalledTimes(1);
    expect(adapter.getState()).toEqual({ status: "signing-out" });
  });

  test("clears the local session and signs out when Keycloak cannot be reached", async () => {
    const fake = fakeOidcClient(julien);
    fake.client.signoutRedirect.mockRejectedValue(new Error("offline"));
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();

    await adapter.signOut();

    expect(fake.client.removeUser).toHaveBeenCalledTimes(1);
    expect(adapter.getState()).toEqual({ status: "signed-out" });
    expect(await adapter.getAccessToken()).toBeNull();
  });
});

describe("subscriptions", () => {
  test("notifies state listeners of each change and stops after unsubscribe", async () => {
    const fake = fakeOidcClient(julien);
    const adapter = createAuthAdapter(fake.client);
    const listener = vi.fn();
    const unsubscribe = adapter.onChange(listener);

    await adapter.initialize();
    unsubscribe();
    fake.expire();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("stops notifying an event listener after unsubscribe", async () => {
    const fake = fakeOidcClient(julien);
    const adapter = createAuthAdapter(fake.client);
    await adapter.initialize();
    const listener = vi.fn();
    const unsubscribe = adapter.onEvent(listener);

    unsubscribe();
    fake.expire();

    expect(listener).not.toHaveBeenCalled();
  });
});
