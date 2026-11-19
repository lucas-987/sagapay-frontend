const decimal = /^(-?)(\d+)(\.\d+)?$/;

export function formatAmount(amount: string, currency: string): string {
  const parts = decimal.exec(amount);
  if (parts === null) return `${amount} ${currency}`;
  const [, sign = "", integer = "", fraction = ""] = parts;
  const grouped = integer.replace(/\B(?=(\d{3})+$)/g, ",");
  return `${sign}${grouped}${fraction} ${currency}`;
}
