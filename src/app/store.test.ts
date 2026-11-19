import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createAppStore } from "./store";

// Redux Toolkit looks the DevTools extension up when its module loads, so the
// fake extension is installed before any import.
const compose = vi.hoisted(() => {
  const fake = vi.fn(() => (createStore: unknown) => createStore);
  Object.defineProperty(window, "__REDUX_DEVTOOLS_EXTENSION_COMPOSE__", {
    value: fake,
  });
  return fake;
});

const session = { getAccessToken: () => Promise.resolve(null) };

beforeEach(() => {
  compose.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createAppStore", () => {
  test("does not connect Redux DevTools in production", () => {
    createAppStore({ session, production: true });

    expect(compose).not.toHaveBeenCalled();
  });

  test("connects Redux DevTools outside production", () => {
    createAppStore({ session, production: false });

    expect(compose).toHaveBeenCalledTimes(1);
  });

  test("is a production build when the build mode says so", () => {
    vi.stubEnv("PROD", true);

    createAppStore({ session });

    expect(compose).not.toHaveBeenCalled();
  });

  test("is not a production build when the build mode says otherwise", () => {
    vi.stubEnv("PROD", false);

    createAppStore({ session });

    expect(compose).toHaveBeenCalledTimes(1);
  });
});
