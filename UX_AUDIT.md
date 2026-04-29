# ThriftVault UI/UX Audit

**Rating: 7.5/10**
**Date: 2026-04-29**

---

## Strengths

### Design system discipline
Real theme with tokens for colors, typography, spacing, radius, and shadows — used consistently. WCAG contrast audit completed. Color palette (cream/teal/terra/charcoal) is cohesive and feels distinctly "thrift" without being cliche.

### Typography pairing
Playfair Display for headings + DM Sans for body. Premium vintage feel while staying readable. Well-defined type scale with clear hierarchy.

### Interaction polish
Haptic feedback on tab switches, scan, and every Yes/No prompt (handmade, wrong-scan, red-flag). Frosted glass camera buttons, min 44px touch targets, `hitSlop` on tight elements. Spring animations on all modals (PaywallModal, scan history sheet, fullscreen image overlay). Full-screen image viewer with swipeable carousel, set-as-cover, save, and delete actions. Scan history sheet (swipe-to-dismiss) shows all previous scans with confidence + profit comparison.

### Camera capture flow
Live multi-photo capture: shutter stages up to 5 photos with `N/5` counter pill, camera stays live between shots, light haptic per shot. Auto-scan fires when count hits 5/5; user can scan earlier via dedicated scan button (only renders when staged > 0). Bottom row layout `[flip][shutter][scan]`. Aligns with native camera app expectations (capture → review → scan) instead of auto-scanning the first shot.

### Accessibility
Full accessibility pass completed: 37 → 169 attributes across 9 files. Covers `accessibilityLabel`, `accessibilityRole`, and `accessibilityState` on all interactive elements — chips carry `selected` state, toggles carry `expanded`, tab switcher uses `tab` role, plan cards and legal links are labeled. Sufficient for App Store review.

### Safety & trust layer
Red flag system: two channels — `authFlags` (luxury/designer authentication warnings) and `redFlags` (AI-generated artwork, all-over sublimation prints, AI-generated photos). Red flag banner appears at the top of the scan result card. Grid cards show a small red badge for flagged items. Placement is consistent across scan and detail screens. Now has a "Look fake to you?" Yes/No escape hatch inside the banner — tapping No drops the camera-box red border and renders the result as a normal scan card. Dismissal persists per-item via AsyncStorage and propagates to the vault grid (badge hides on dismissed items). Resolves the prior gap where users had no recourse when AI flagged a real item.

### Information architecture
Flips/Closet/Hauls switcher separates intent (flip vs keep) — a genuine insight into how thrifters think. Scan flow (photo > AI result > buy & track / add to closet) is clear and linear. Saved-for-later preserves prompt dismissal state across sessions. Confidence indicator (colored dot + label) gives users signal quality at a glance.

### Tab bar
Elevated center scan button is the right call for a scan-first app. Well-executed with shadow and cream border ring.

---

## Weaknesses (post-launch improvements)

### Onboarding is generic
Unchanged since initial build. Three slides with generic Ionicons (camera, folder-open, sparkles) and text. No screenshots, illustrations, or brand personality. The third slide surfaces pricing ($4.99/mo) before the user is invested — feels like a sales pitch before demonstrating value. For an app targeting thrift resellers, this is still a missed opportunity to establish tone and trust.

### Scan result card density has increased
The original audit flagged this; it has gotten worse. Subsequent sessions added confidence banner, red flags section, auth flags (collapsible), wrong-scan prompt, upcycle ideas (collapsible), staged photo strip, and now the red-flag "Look fake to you?" Yes/No row — all valid features, but the cumulative effect is a very long card. The primary action ("Buy & Track") is below the fold on most phones when any warning or prompt is present. Net: every false-positive recovery improvement comes at the cost of more vertical density. The next round of work in this area should be subtractive — collapsing or consolidating prompt rows so they don't all stack open at once.

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

Since the 4/26 refresh: the red-flag system gained an escape hatch (Yes/No dismissal that propagates from scan card to vault grid), the camera flow shifted from auto-scan-on-first-shot to a stage-up-to-5 + auto-scan-at-5/5 model that matches native camera UX, and several false-positive sources were tightened (duplicate modal, AI-photo detection, "AI confident in prior price" toast removed). All net wins. Score holds at 7.5/10 because the two highest-traffic surfaces — onboarding and the scan result card — are still the gating issues. Onboarding hasn't been touched. The scan card got more capable AND denser — every false-positive recovery feature added more vertical space. The next round of UX work should be subtractive on the scan card (collapse/consolidate prompts) and substantive on onboarding (illustrations, brand voice, value-before-pricing).
