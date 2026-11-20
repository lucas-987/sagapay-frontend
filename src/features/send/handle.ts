export function normaliseHandle(text: string): string {
  return text.trim().replace(/^@/, "").toLowerCase();
}
