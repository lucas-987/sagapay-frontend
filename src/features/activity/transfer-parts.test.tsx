import { ThemeProvider } from "@mui/material";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { makeTheme } from "../../shared/theme/theme";
import type { StatusTone } from "./transfer-logic";
import { StatusChip } from "./transfer-parts";

test.each<{ mode: "light" | "dark"; tone: StatusTone; color: string }>([
  { mode: "light", tone: "success", color: "rgb(255, 255, 255)" },
  { mode: "light", tone: "error", color: "rgb(255, 255, 255)" },
  { mode: "dark", tone: "error", color: "rgb(255, 255, 255)" },
  { mode: "dark", tone: "success", color: "rgb(38, 50, 56)" },
  { mode: "dark", tone: "warning", color: "rgb(38, 50, 56)" },
])(
  "draws a $tone chip's text as $color in the $mode theme",
  ({ mode, tone, color }) => {
    const { container } = render(
      <ThemeProvider theme={makeTheme(mode)}>
        <StatusChip label="Completed" tone={tone} />
      </ThemeProvider>,
    );

    expect(getComputedStyle(container.children[0] as Element).color).toBe(
      color,
    );
  },
);
