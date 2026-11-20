import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useSession } from "./session-context";

function Probe() {
  useSession();
  return null;
}

test("refuses to be used outside a session provider", () => {
  const expectedError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  expect(() => render(<Probe />)).toThrow(
    "useSession needs a SessionProvider.",
  );

  expectedError.mockRestore();
});
