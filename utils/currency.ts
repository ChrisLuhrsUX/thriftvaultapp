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

/**
 * Round a price to a clean display number with tier-aware granularity:
 * <$200 → $5, <$500 → $10, <$1000 → $25, ≥$1000 → $50.
 * Floors at $5 so positive inputs never display as $0.
 */
export function roundDisplayPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 200) return Math.max(Math.round(value / 5) * 5, 5);
  if (value < 500) return Math.round(value / 10) * 10;
  if (value < 1000) return Math.round(value / 25) * 25;
  return Math.round(value / 50) * 50;
}
