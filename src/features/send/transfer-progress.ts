import type { TransferStatus } from "../activity";

export interface ProgressStep {
  label: string;
  reached: boolean;
}

const stepLabels = ["Funds reserved", "Checking", "Sent"] as const;

const reachedSteps: Partial<Record<TransferStatus, number>> = {
  INITIATED: 0,
  RESERVED: 1,
  SCREENING: 1,
  CLEARED: 2,
  BLOCKED: 1,
  POSTED: 3,
  SETTLED: 3,
};

export function progressOf(status: TransferStatus): ProgressStep[] {
  const reached = reachedSteps[status];
  if (reached === undefined) return [];
  return stepLabels.map((label, index) => ({
    label,
    reached: index < reached,
  }));
}
