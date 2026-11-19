import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { fakeOidcClient, userOf } from "../test/fake-oidc-client";
import { julien, renderApp } from "../test/render-app";

const callbackUrl = (query: string) =>
  new URL(`/auth/callback${query}`, location.origin).href;

beforeEach(() => {
  localStorage.clear();
});

describe("protected routes", () => {
  test.each([
    { requested: "/activity", state: "/activity" },
    { requested: "/send?draft=1#amount", state: "/send?draft=1#amount" },
    { requested: "/missing", state: "/missing" },
  ])(
    "sends a signed-out customer to sign in from $requested, carrying that path",
    async ({ requested, state }) => {
      const { fake } = await renderApp(requested, {
        fake: fakeOidcClient(null),
      });

      await waitFor(() => {
        expect(fake.client.signinRedirect.mock.calls).toEqual([[{ state }]]);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Signing you in…");
      expect(screen.queryByRole("navigation")).toBeNull();
      expect(screen.queryByRole("main")).toBeNull();
    },
  );

  test("shows the page to a signed-in customer without redirecting", async () => {
    const { fake } = await renderApp("/activity");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Activity" }),
    ).toBeVisible();
    expect(fake.client.signinRedirect).not.toHaveBeenCalled();
  });

  test("waits for the stored session before deciding", async () => {
    const fake = fakeOidcClient(julien);
    let release: () => void = () => undefined;
    fake.client.getUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve(julien);
          };
        }),
    );
    const pending = renderApp("/activity", { fake });
    await waitFor(() => {
      expect(fake.client.getUser).toHaveBeenCalled();
    });
    expect(fake.client.signinRedirect).not.toHaveBeenCalled();

    release();
    await pending;

    expect(await screen.findByRole("main")).toBeVisible();
    expect(fake.client.signinRedirect).not.toHaveBeenCalled();
  });
});

describe("sign-in callback", () => {
  test("returns the customer to the page they requested", async () => {
    const fake = fakeOidcClient(null);
    fake.client.signinCallback.mockImplementation(() => {
      fake.load(julien);
      return Promise.resolve(userOf({ subject: "julien-id", state: "/send" }));
    });

    const { router } = await renderApp("/auth/callback?code=c&state=s", {
      fake,
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/send");
    });
    expect(fake.client.signinCallback.mock.calls).toEqual([
      [callbackUrl("?code=c&state=s")],
    ]);
    expect(router.state.historyAction).toBe("REPLACE");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Send money" }),
    ).toBeVisible();
  });

  test.each([
    { name: "an absolute url", state: "https://evil.example/steal" },
    { name: "a protocol-relative url", state: "//evil.example/steal" },
    { name: "no state", state: undefined },
  ])("goes to /activity when the callback carries $name", async ({ state }) => {
    const fake = fakeOidcClient(null);
    fake.client.signinCallback.mockImplementation(() => {
      fake.load(julien);
      return Promise.resolve(userOf({ subject: "julien-id", state }));
    });

    const { router } = await renderApp("/auth/callback?code=c&state=s", {
      fake,
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/activity");
    });
    expect(router.state.location.search).toBe("");
  });

  test("goes to /activity when Keycloak's response is missing its state", async () => {
    const fake = fakeOidcClient(julien);
    fake.client.signinCallback.mockRejectedValue(
      new Error("No state in response"),
    );

    const { router } = await renderApp("/auth/callback?code=c", { fake });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/activity");
    });
  });
});

describe("shell identity", () => {
  test("shows the signed-in customer's name and no placeholder", async () => {
    await renderApp("/activity");

    const header = await screen.findByRole("banner");
    expect(header).toHaveTextContent("Julien Simon");
    expect(header).not.toHaveTextContent("Jordan Davis");
  });

  test("signing out leaves through Keycloak and shows no page", async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp("/activity");

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(fake.client.signoutRedirect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Signing you out…");
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(fake.client.signinRedirect).not.toHaveBeenCalled();
  });
});

describe("renewal failure", () => {
  test("sends the customer to sign in again with the page they were on", async () => {
    const { fake } = await renderApp("/send?draft=1");
    await screen.findByRole("main");

    fake.failRenewal();

    await waitFor(() => {
      expect(fake.client.signinRedirect.mock.calls).toEqual([
        [{ state: "/send?draft=1" }],
      ]);
    });
    expect(screen.queryByRole("main")).toBeNull();
  });
});
