export function remainingMs(deadline: string, nowMs: number): number {
  const left = Date.parse(deadline) - nowMs;
  return Number.isNaN(left) ? 0 : Math.max(0, left);
}

export function formatRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${String(Math.floor(seconds / 60))}:${rest}`;
}
