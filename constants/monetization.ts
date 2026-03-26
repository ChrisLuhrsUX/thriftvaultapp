/**
 * Free trial before subscription paywall.
 * During trial the app behaves like Pro: same feature set as any paid plan
 * (unlimited AI scan, full vault, hauls, etc.). No partial "free tier" during trial.
 * Time-based (not scan-count) so the first shopping trip is never paywalled mid-haul.
 */
export const TRIAL_DURATION_DAYS = 30;

export interface PlanOption {
  id: string;
  label: string;
  price: string;
  period: string;
  perMonth: string;
  badge?: string;
}

export const PLANS: PlanOption[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$4.99',
    period: '/mo',
    perMonth: '$4.99/mo',
  },
  {
    id: 'season',
    label: 'Season Pass',
    price: '$9.99',
    period: '/ 3 mo',
    perMonth: '$3.33/mo',
    badge: 'Popular',
  },
  {
    id: 'annual',
    label: 'Annual',
    price: '$29.99',
    period: '/yr',
    perMonth: '$2.50/mo',
    badge: 'Best Value',
  },
];

export const DEFAULT_PLAN_ID = 'season';
