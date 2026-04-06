/** Format a dollar amount with commas, no decimals. e.g. 1234 → "$1,234" */
export function formatMoney(value: number): string {
  const abs = Math.abs(Math.round(value));
  return '$' + abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format with leading sign. e.g. 1234 → "+$1,234", -50 → "-$50" */
export function formatMoneyWithSign(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (rounded >= 0 ? '+' : '-') + '$' + abs;
}
