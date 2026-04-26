# ThriftVault UI/UX Audit

**Rating: 7.5/10**
**Date: 2026-04-26**

---

## Strengths

### Design system discipline
Real theme with tokens for colors, typography, spacing, radius, and shadows — used consistently. WCAG contrast audit completed. Color palette (cream/teal/terra/charcoal) is cohesive and feels distinctly "thrift" without being cliche.

### Typography pairing
Playfair Display for headings + DM Sans for body. Premium vintage feel while staying readable. Well-defined type scale with clear hierarchy.

### Interaction polish
Haptic feedback on tab switches and scan, frosted glass camera buttons, min 44px touch targets, `hitSlop` on tight elements. Spring animations on all modals (PaywallModal, scan history sheet, fullscreen image overlay). Full-screen image viewer with swipeable carousel, set-as-cover, save, and delete actions. Multi-photo staging with thumbnail strip and per-photo remove. Scan history sheet (swipe-to-dismiss) shows all previous scans with confidence + profit comparison.

### Accessibility
Full accessibility pass completed: 37 → 169 attributes across 9 files. Covers `accessibilityLabel`, `accessibilityRole`, and `accessibilityState` on all interactive elements — chips carry `selected` state, toggles carry `expanded`, tab switcher uses `tab` role, plan cards and legal links are labeled. Sufficient for App Store review.

### Safety & trust layer
Red flag system added post-audit. Two distinct channels: `authFlags` (luxury/designer authentication warnings) and `redFlags` (AI-generated artwork, all-over sublimation prints, AI-generated photos). Red flag banner appears at the top of the scan result card — non-collapsible, high-contrast. Grid cards show a small red badge for flagged items. Placement is consistent across scan and detail screens.

### Information architecture
Flips/Closet/Hauls switcher separates intent (flip vs keep) — a genuine insight into how thrifters think. Scan flow (photo > AI result > buy & track / add to closet) is clear and linear. Saved-for-later preserves prompt dismissal state across sessions. Confidence indicator (colored dot + label) gives users signal quality at a glance.

### Tab bar
Elevated center scan button is the right call for a scan-first app. Well-executed with shadow and cream border ring.

---

## Weaknesses (post-launch improvements)

### Onboarding is generic
Unchanged since initial build. Three slides with generic Ionicons (camera, folder-open, sparkles) and text. No screenshots, illustrations, or brand personality. The third slide surfaces pricing ($4.99/mo) before the user is invested — feels like a sales pitch before demonstrating value. For an app targeting thrift resellers, this is still a missed opportunity to establish tone and trust.

### Scan result card density has increased
The original audit flagged this; it has gotten worse. Subsequent sessions added confidence banner, red flags section, auth flags (collapsible), wrong-scan prompt, upcycle ideas (collapsible), and staged photo strip — all valid features, but the cumulative effect is a very long card. The primary action ("Buy & Track") is now below the fold on most phones when any warning or prompt is present. Users who don't scroll will miss it.

### Action discoverability in scan
Related to density: with red flags + confidence + handmade prompt + wrong-scan prompt + ideas all visible, "Buy & Track" requires significant scrolling to reach. The most important action in the app is the least reachable in its most-used state.

### Profile page lacks depth
Partially improved — "Upgrade to Pro" button moved above the fold. But stats are still read-only rows with no drill-down. "Best Single Flip" shows a dollar amount but not which item. "Profit by Store" list is height-capped and scrollable but doesn't link to filtered inventory. Feels like a dashboard that shows numbers without helping users act on them.

### Grid differentiation is limited
~~Listed and Unlisted look identical~~ — fixed: Unlisted badge now uses muted warm-grey so the three states are visually distinct (Unlisted = grey, Listed = teal, Sold = green). Red flag badge is still small; a more prominent treatment would further help at 30+ items.

### Empty states are inconsistent
~~Hauls empty state is weaker~~ — fixed: Hauls now has an inline "New Haul" CTA button matching the Flips/Closet pattern. Remaining gap: scan history sheet has no empty state, but it's only reachable with multiple scans so impact is low.

### Dark mode lacks warmth
~~Fixed~~: Pushed all dark mode surface and text tokens toward amber/Edison-bulb warmth. Backgrounds shifted from neutral warm-brown to deeper amber (`cream #211A14`, `surface #2C221A`, `surfaceVariant #372C22`). Primary text shifted from grey-white to warm ivory (`charcoal #EDE7DF`). Dividers and blush tones follow. Brand teal unchanged — contrast ratios all remain ≥14:1 WCAG AA.

---

## Summary

The app has shipped meaningful work since the April 2 audit: accessibility, the red flag system, modal animations, scan history, and paywall polish all moved the needle. The bones remain strong. What pulled the score up half a point is the safety/trust layer and accessibility — real differentiators for App Store positioning. What's keeping it from 8+ is that the two highest-traffic moments — onboarding and the scan result — still have unresolved issues. Onboarding hasn't been touched. The scan card has gotten more capable but harder to use. The next point of improvement comes from those two screens: a more illustrated onboarding and a scan result that surfaces the primary CTA without requiring a full scroll.
