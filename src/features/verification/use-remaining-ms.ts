import { useEffect, useState } from "react";
import { remainingMs } from "./remaining-time";

export function useRemainingMs(deadline: string): number {
  const [now, setNow] = useState(() => Date.now());
  const left = remainingMs(deadline, now);

  useEffect(() => {
    if (left === 0) return;
    const timeout = setTimeout(
      () => {
        setNow(Date.now());
      },
      left % 1000 || 1000,
    );
    return () => {
      clearTimeout(timeout);
    };
  }, [left, now]);

  return left;
}
