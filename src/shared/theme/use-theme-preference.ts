import { useMediaQuery } from "@mui/material";
import type { PaletteMode } from "@mui/material";
import { useState } from "react";

const storageKey = "sagapay-theme";

function savedMode(): PaletteMode | undefined {
  try {
    const storedMode = window.localStorage.getItem(storageKey);
    return storedMode === "light" || storedMode === "dark"
      ? storedMode
      : undefined;
  } catch {
    return undefined;
  }
}

export function useThemePreference() {
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [selectedMode, setSelectedMode] = useState(savedMode);
  const mode = selectedMode ?? (systemDark ? "dark" : "light");

  function toggleMode() {
    const nextMode = mode === "dark" ? "light" : "dark";
    setSelectedMode(nextMode);
    try {
      window.localStorage.setItem(storageKey, nextMode);
    } catch {
      return;
    }
  }

  return { mode, toggleMode };
}
