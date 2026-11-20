import { Typography, useMediaQuery } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { formatRemaining } from "./remaining-time";

const urgentSeconds = 10;
const pulse = keyframes`
  50% { opacity: 0.55; }
`;

export function Countdown({ remainingMs }: { remainingMs: number }) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const urgent = remainingMs > 0 && remainingMs <= urgentSeconds * 1000;
  return (
    <Typography
      role="timer"
      aria-label="Time left to verify"
      variant="h5"
      color={urgent ? "error" : "text.primary"}
      sx={{
        fontVariantNumeric: "tabular-nums",
        animation:
          urgent && !reducedMotion
            ? `${pulse} 1s ease-in-out infinite`
            : "none",
      }}
    >
      {formatRemaining(remainingMs)}
    </Typography>
  );
}
