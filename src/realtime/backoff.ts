export interface BackoffOptions {
  initialDelayMs: number;
  maxDelayMs: number;
  random?: () => number;
}

export function createBackoff({
  initialDelayMs,
  maxDelayMs,
  random = Math.random,
}: BackoffOptions) {
  let bound = initialDelayMs;
  return {
    next(): number {
      const delay = bound / 2 + (random() * bound) / 2;
      bound = Math.min(bound * 2, maxDelayMs);
      return delay;
    },
    reset() {
      bound = initialDelayMs;
    },
  };
}
