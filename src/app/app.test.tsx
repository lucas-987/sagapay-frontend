import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { appRoutes } from "./app-routes";
import { RootErrorBoundary } from "./root-error-boundary";

function renderApp(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

function emulateColorScheme(dark: boolean) {
  const target = new EventTarget();
  const mediaQuery = "(prefers-color-scheme: dark)";
  const systemScheme = {
    media: mediaQuery,
    matches: dark,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  vi.stubGlobal("matchMedia", (query: string) => ({
    ...systemScheme,
    get matches() {
      return query === mediaQuery && systemScheme.matches;
    },
  }));

  return (nextDark: boolean) => {
    systemScheme.matches = nextDark;
    target.dispatchEvent(new Event("change"));
  };
}

beforeEach(() => {
  localStorage.clear();
  emulateColorScheme(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each([
  { path: "/activity", active: "Activity", other: "Send money" },
  { path: "/send", active: "Send money", other: "Activity" },
])(
  "displays the $active outlet and marks its navigation link current",
  async ({ path, active, other }) => {
    renderApp(path);

    const nav = within(
      screen.getByRole("navigation", { name: "Main navigation" }),
    );
    expect(nav.getAllByRole("link")).toEqual([
      nav.getByRole("link", { name: "Activity" }),
      nav.getByRole("link", { name: "Send money" }),
    ]);
    expect(nav.getByRole("link", { name: "Activity" })).toHaveAttribute(
      "href",
      "/activity",
    );
    expect(nav.getByRole("link", { name: "Send money" })).toHaveAttribute(
      "href",
      "/send",
    );
    expect(nav.getByRole("link", { name: active })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(nav.getByRole("link", { name: other })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      await within(screen.getByRole("main")).findByRole("heading", {
        level: 1,
        name: active,
      }),
    ).toBeVisible();
  },
);

test("redirects the index route to Activity", async () => {
  const { router } = renderApp("/");

  expect(
    await screen.findByRole("heading", { level: 1, name: "Activity" }),
  ).toBeVisible();
  expect(router.state.location.pathname).toBe("/activity");
  expect(router.state.historyAction).toBe("REPLACE");
});

test("keeps the navigation available and explains an unknown route", async () => {
  renderApp("/missing");

  expect(screen.getByRole("link", { name: "Activity" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Send money" })).toBeVisible();
  expect(
    await screen.findByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
  expect(
    screen.getByText("Choose Activity or Send money from the navigation."),
  ).toBeVisible();
});

test.each([
  { systemDark: false, switchTo: "dark" },
  { systemDark: true, switchTo: "light" },
])(
  "uses the system scheme and offers to switch to $switchTo without a saved choice",
  ({ systemDark, switchTo }) => {
    emulateColorScheme(systemDark);

    renderApp("/activity");

    expect(
      screen.getByRole("button", { name: `Switch to ${switchTo} theme` }),
    ).toBeVisible();
  },
);

test("updates to the system color scheme while using the default", () => {
  const changeColorScheme = emulateColorScheme(false);
  renderApp("/activity");

  act(() => {
    changeColorScheme(true);
  });

  expect(
    screen.getByRole("button", { name: "Switch to light theme" }),
  ).toBeVisible();
});

test.each([
  { systemDark: false, first: "dark", next: "light" },
  { systemDark: true, first: "light", next: "dark" },
])(
  "remembers a selection of the $first theme when the app remounts",
  async ({ systemDark, first, next }) => {
    emulateColorScheme(systemDark);
    const user = userEvent.setup();
    const { unmount } = renderApp("/activity");

    await user.click(
      screen.getByRole("button", { name: `Switch to ${first} theme` }),
    );

    expect(
      screen.getByRole("button", { name: `Switch to ${next} theme` }),
    ).toBeVisible();
    expect(localStorage.getItem("sagapay-theme")).toBe(first);
    unmount();
    renderApp("/activity");

    expect(
      screen.getByRole("button", { name: `Switch to ${next} theme` }),
    ).toBeVisible();
  },
);

test("ignores an unsupported saved theme", () => {
  localStorage.setItem("sagapay-theme", "sepia");

  renderApp("/activity");

  expect(
    screen.getByRole("button", { name: "Switch to dark theme" }),
  ).toBeVisible();
});

test("keeps the theme usable if theme storage is unavailable", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Storage unavailable", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage unavailable", "SecurityError");
  });
  const user = userEvent.setup();
  renderApp("/activity");

  await user.click(
    screen.getByRole("button", { name: "Switch to dark theme" }),
  );

  expect(
    screen.getByRole("button", { name: "Switch to light theme" }),
  ).toBeVisible();
});

function FailingScreen(): never {
  throw new Error("Private error details");
}

test("shows fixed route recovery copy and retains navigation after a render failure", async () => {
  const expectedError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  const router = createMemoryRouter(
    appRoutes.map((route) => ({
      ...route,
      children: route.children?.map((child) =>
        child.path === "activity"
          ? { ...child, Component: FailingScreen }
          : child,
      ),
    })),
    { initialEntries: ["/activity"] },
  );
  const user = userEvent.setup();
  render(<RouterProvider router={router} />);

  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: "This page could not be displayed",
    }),
  ).toBeVisible();
  expect(
    screen.getByText("Choose another page from the navigation."),
  ).toBeVisible();
  expect(screen.queryByText("Private error details")).not.toBeInTheDocument();
  expect(expectedError).toHaveBeenCalled();
  await user.click(screen.getByRole("link", { name: "Send money" }));
  expect(
    await screen.findByRole("heading", { level: 1, name: "Send money" }),
  ).toBeVisible();
});

test("shows fixed application recovery copy when the layout fails", () => {
  const expectedError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  const router = createMemoryRouter(
    appRoutes.map((route) => ({ ...route, Component: FailingScreen })),
    { initialEntries: ["/activity"] },
  );

  render(<RouterProvider router={router} />);

  expect(
    screen.getByRole("heading", { level: 1, name: "SagaPay could not start" }),
  ).toBeVisible();
  expect(screen.getByText("Reload the page to try again.")).toBeVisible();
  expect(screen.queryByText("Private error details")).not.toBeInTheDocument();
  expect(expectedError).toHaveBeenCalled();
});

test("renders the application while there is no root error", () => {
  render(
    <RootErrorBoundary>
      <h1>Activity</h1>
    </RootErrorBoundary>,
  );

  expect(
    screen.getByRole("heading", { level: 1, name: "Activity" }),
  ).toBeVisible();
});

test("shows fixed application recovery copy after an error outside the router", () => {
  const expectedError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  render(
    <RootErrorBoundary>
      <FailingScreen />
    </RootErrorBoundary>,
  );

  expect(
    screen.getByRole("heading", { level: 1, name: "SagaPay could not start" }),
  ).toBeVisible();
  expect(screen.getByText("Reload the page to try again.")).toBeVisible();
  expect(screen.queryByText("Private error details")).not.toBeInTheDocument();
  expect(expectedError).toHaveBeenCalled();
});
