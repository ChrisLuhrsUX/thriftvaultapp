# Launch Ops

Solo-dev maintenance schedule for ThriftVault iOS. First time launching an app — this is the working playbook for daily/weekly cadence, hotfix paths, and annual obligations.

## Dashboards & inboxes

Bookmark these. Daily-checklist items below assume you can pull them up in <30 seconds.

| Tool | URL / location | What it tells you |
|------|---------------|-------------------|
| Sentry | sentry.io → ThriftVault project | Native crashes, JS errors, ANRs |
| App Store Connect | appstoreconnect.apple.com | Sales, ratings, reviews, sub conversions |
| RevenueCat | app.revenuecat.com | Trial starts, paid conversions, refunds, churn |
| Gemini API | aistudio.google.com → API quota | Daily request count vs 1500 free-tier ceiling |
| Anthropic console | console.anthropic.com | Claude fallback burn (only fires when Gemini fails) |
| Email | thriftvaultapp@gmail.com | User support, App Review feedback |
| GitHub | github.com/ChrisLuhrsUX/thriftvaultapp | Code, issues, GH Pages legal docs |

## Phase 1 — Launch day → end of week 1 (daily, 20–40 min)

**Morning checklist (run in order):**

- [ ] Sentry: any new crash signature? Group by frequency. Fix the top one same-day.
- [ ] App Store Connect → Sales and Trends: installs, day-1 retention.
- [ ] App Store Connect → Ratings and Reviews: reply to every review (the first 50 set tone + SEO).
- [ ] RevenueCat: trial starts, refund requests.
- [ ] Gemini API console: daily quota burn. Spike = users found you. If it's hitting 1000+/day, plan billing setup.
- [ ] Anthropic console: Claude fallback usage. Sustained non-zero = Gemini reliability issue.
- [ ] Inbox: 24h response SLA on user email.

**Why daily this week:** the first crash is usually the worst (everything you didn't catch in TestFlight surfaces in hours). The first reviews shape your Search rank for weeks.

## Phase 2 — Weeks 2–4 (every 2–3 days, ~20 min)

- [ ] Sentry: triage new crashes; resolve known ones.
- [ ] Reviews: reply to anything ≤3 stars.
- [ ] RevenueCat: first cohort is approaching day-30 trial→paid. Watch the conversion rate — this is your business model's first real signal.
- [ ] Bundle bug fixes into a `v1.0.1` release end of week 2.

## Phase 3 — Months 2–3 (weekly, ~30 min)

- [ ] Submit a patch release every 1–2 weeks. Don't go silent — App Store ranking decays.
- [ ] RevenueCat → Charts → Cohorts: churn by cohort.
- [ ] `expo-doctor` and `npm audit` for security advisories.
- [ ] Re-evaluate Gemini cost vs scan volume. Claude fallback is ~$0.017/scan, only fires when both Gemini tiers fail.

## Phase 4 — Steady state (monthly, ~1 hr)

- [ ] Plan a small feature release (one POST_LAUNCH.md item per month is a healthy pace).
- [ ] Review subscription metrics: MRR, ARPU, churn by cohort.
- [ ] Skim App Review guideline updates (Apple shifts them ~quarterly).
- [ ] Check ratings: average <4.0 = UX investigation needed.

## Hotfix paths

| Bug type | Path | Time to ship |
|----------|------|--------------|
| JS / React Native code bug | `eas update --branch production` (OTA) | minutes |
| Native module / permissions / RevenueCat config | `eas build --profile production` → `eas submit` | 1–24h Apple review |
| Critical / data loss | Submit + request "Expedited review" in App Store Connect | hours |

**Rollback:**
- JS bundle: `eas update --branch production --message "rollback" --republish` to a previous commit.
- Whole release: App Store Connect → "Remove from sale" — existing users keep prior version, new installs blocked. Use this when a release breaks badly.

## Pre-launch infra (blocks launch, not part of maintenance)

These come from `MVP.md`. Knock them out before submitting v1.0.

- [ ] Apple Individual → Org conversion (emailed Apple Dev Support 2026-04-26)
- [ ] Wire `EXPO_PUBLIC_SENTRY_DSN` (currently inert; crash reporting won't fire without it)
- [ ] RevenueCat 9-step infra sequence (Paid Apps agreement, 3 ASC products, dashboard, `npm install react-native-purchases`, `app.json` plugin, `.env` key, `npx expo prebuild`, dev client / TestFlight)
- [ ] `eas.json`: fill `ascAppId` + `appleTeamId` once Org is live
- [ ] 1024×1024 PNG icon export → update `app.json` icon/splash/favicon paths

## Annual obligations

| When | What | Cost / action |
|------|------|---------------|
| 2027-03-28 | Apple Developer renewal | $99 (auto-renew if enabled) |
| April 1 each year | TN LLC annual report | $300 |
| April 1 each year | TN minimum franchise tax | $100 |
| April 15 each year | TN excise tax | 6.5% of net earnings |
| Q1 each year | Federal income tax on LLC distributions (Schedule C if single-member; K-1 if multi) | varies |
| Mid-2026 onward | Evaluate Expo SDK upgrade (locked to 54 per memory; pressure begins when 56/57 drops 54 from EAS) | dev time |

Set calendar reminders for April 1 — TN charges late fees and the LLC can be administratively dissolved if you miss the report two years running.

## ThriftVault-specific watchouts

- **Gemini API key is in the bundle** (`EXPO_PUBLIC_*` is public by design). If you see abuse, rotate the key, push an OTA update, and scope the new key by app bundle ID in Google Cloud Console.
- **Claude API key same**: also bundled. Same rotation flow.
- **No backend** = no server-side rate limit. Abuse mitigation is bundle-ID scoping + RevenueCat entitlement check (only paid users hit AI scan in production).
- **Local-only data** = a corrupted `tv_inv` AsyncStorage write loses a user's vault. The `sanitizeSnapshot` rehydration path is load-bearing — be careful editing `InventoryContext.tsx`.
- **iOS minimum 15.1**: don't bump higher unless a dependency forces it; cuts off iPhone 6s/7/8/X users who paid you.

## Routine reading

- [POST_LAUNCH.md](POST_LAUNCH.md) — feature backlog
- [MVP.md](MVP.md) — pre-launch checklist
- [ANDROID.md](ANDROID.md) — Android port plan (post-iOS-launch)
- [UX_AUDIT.md](UX_AUDIT.md) — last UX self-review (refresh quarterly)
- [STORE_LISTING.md](STORE_LISTING.md) — App Store copy + screenshots source of truth
