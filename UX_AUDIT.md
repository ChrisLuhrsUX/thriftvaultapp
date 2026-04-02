# ThriftVault UI/UX Audit

**Rating: 7/10**
**Date: 2026-04-02**

---

## Strengths

### Design system discipline
Real theme with tokens for colors, typography, spacing, radius, and shadows — used consistently. WCAG contrast audit completed. Color palette (cream/teal/terra/charcoal) is cohesive and feels distinctly "thrift" without being cliche.

### Typography pairing
Playfair Display for headings + DM Sans for body. Premium vintage feel while staying readable. Well-defined type scale with clear hierarchy.

### Interaction polish
Haptic feedback on tab switches and scan, frosted glass camera buttons, swipe-to-dismiss paywall, min 44px touch targets, `hitSlop` on tight elements.

### Information architecture
Flips/Closet/Hauls switcher separates intent (flip vs keep) — a genuine insight into how thrifters think. Scan flow (photo > AI result > buy & track / add to closet) is clear and linear.

### Tab bar
Elevated center scan button is the right call for a scan-first app. Well-executed with shadow and cream border ring.

---

## Weaknesses (post-launch improvements)

### Onboarding is generic
Three slides with giant Ionicons and text. No screenshots, illustrations, or brand personality. Looks like every Expo tutorial app's onboarding. For an app targeting thrift resellers, this is a missed opportunity to establish tone and trust.

### Empty states are weak
Zero items = icon + "No flips yet" + "Add manually" button. Most important screen for a new user and the least designed. No onboarding nudge toward scan flow, no visual example of a populated vault, no motivation.

### Profile page is a settings dump
List of stats and settings rows. No visual identity, no avatar/name, nothing personal. "Your Stats" and "Profit by store" cards are functional but visually identical. Should make users feel accomplished — currently flat.

### Scan result card is dense
Packs in: editable name, price, subtitle, handmade prompt, wrong-scan prompt, confidence indicator, 3 flip ideas, upcycle ideas, and 3 action buttons. Too much cognitive load for a moment where the user just wants "is this worth buying?"

### No visual differentiation in grid
Item cards are photo + name + profit. Unlisted and listed items look almost identical — just a tiny corner badge. Hard to scan 30+ items to find what needs attention.

### Dark mode lacks warmth
`vintageBlueDark` stays the same for contrast compliance (correct), but cream > `#1C1B1F` loses the warmth that defines the brand. Dark mode should feel like the same store at night, not a different store.

---

## Summary

Strong fundamentals — better than most indie apps. Design system, contrast work, and interaction details show real UX thinking. What's missing is the emotional/visual layer: illustrations, photography, motion, personality. Bones = 8, skin = 6. To compete with Flippd and get App Store featured, close the visual gap — especially onboarding and empty states.
