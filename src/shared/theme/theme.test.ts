import { expect, test } from "vitest";
import { makeTheme } from "./theme";

test.each(["light", "dark"] as const)(
  "disables transitions and animations under reduced motion in %s mode",
  (mode) => {
    const theme = makeTheme(mode);

    expect(theme.components?.MuiCssBaseline?.styleOverrides).toHaveProperty(
      ["@media (prefers-reduced-motion: reduce)"],
      {
        "*, *::before, *::after": {
          animation: "none !important",
          transition: "none !important",
          scrollBehavior: "auto !important",
        },
      },
    );
  },
);
