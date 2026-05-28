# Share-as-Image Card, Design Plan (9:16 story format)

**Status:** Approved 2026-05-08. Gated on RevenueCat prebuild milestone (MVP.md step 8). Implementation pairs with MVP.md step 10.

## Context

ThriftVault's existing share button (commented out at `app/detail.tsx:1590-1601`) shares text only via `buildShareMessage`. For a thrift app riding Depop / TikTok / Pinterest culture, text-alone is weak, these communities share visually. This upgrades to a composed 9:16 image card (Instagram Stories / TikTok / Reels native canvas) so users can share their flips, sales, and closet pieces as scroll-stopping images while keeping ThriftVault's branding intact.

The composed card requires `react-native-view-shot` (native module, not in Expo Go SDK 54). Per CLAUDE.md and POST_LAUNCH.md, prebuild is deliberately deferred until paired with RevenueCat. This feature ships alongside RevenueCat once Expo Go is dropped and dev client is in use.

**Outcome:** a Share menu item on item detail opens a preview sheet showing a designed 1080×1920 card (photo top 65%, info block bottom 35% on cream, ThriftVault watermark bottom-right). Three intent variants, active flip / sold flip / closet, each with appropriate copy and money handling. User confirms → native share sheet receives a JPG. Web stays on the existing text-share path.

## Prerequisites

- `npx expo prebuild` complete (MVP.md step 8)
- Dev client in use; Expo Go is dropped

## What's already wired (reuse, don't rewrite)

- `app/detail.tsx:67-78` `buildShareMessage(item)`, 3 intent text variants. Keep as text fallback.
- `app/detail.tsx:80-99` `isUserCanceledShareError(e)`, handles iOS/Android cancel substrings. Reuse for both image + text paths.
- `app/detail.tsx:688-726` `handleShare()`, native + web wiring. Extend (don't rewrite) so web stays on text path and native opens the new preview sheet.
- `app/detail.tsx:1590-1601` Share button UI (commented). Uncomment + add no-photo guard.
- `components/PaywallModal.tsx:48-99` modal animation: `animationType="none"` + `Animated.spring(translateY, { tension: 55, friction: 11 })` enter; `Animated.timing(toValue: 700, duration: 240)` dismiss; pan dismiss at `g.dy > 80 || g.vy > 0.5`. Mirror exactly for the preview sheet.
- `utils/currency.ts` `formatMoney`, `formatMoneyWithSign`, `roundDisplayPrice`, reuse for card numbers.
- Theme tokens: `cream`, `charcoal`, `vintageBlueDark`, `profit`, `mauve`, `surfaceVariant`. Fonts (`PlayfairDisplay_700Bold`, `DMSans_400Regular`, `DMSans_600SemiBold`) loaded globally in `app/_layout.tsx:46-51`.
- `assets/logo/thriftvault_logo_v2.png`, watermark source.

## New files (4)

### `components/ShareCard.tsx`

Forward-ref'd `View` rendering the 1080×1920 card. Mounted off-screen by parent; ref passed to `captureRef`.

**Props:** `{ item: Item; variant: 'activeFlip' | 'soldFlip' | 'closet' }`

**Layout:**
- Container `View`, `width: 1080, height: 1920, backgroundColor: theme.colors.cream`. (Off-screen positioning is parent's responsibility, not ShareCard's.)
- **Photo region** (top): `width: 1080, height: 1248` (65%). `<Image source={{ uri: photoUri }} resizeMode="cover" />` full-bleed.
- **Info block** (bottom 35%): `padding: 80` top/sides, `paddingBottom: 64`. Contents:
  - **Name**, Playfair 700, `fontSize: 72`, `lineHeight: 80`, `color: charcoal`, `numberOfLines: 2`, `ellipsizeMode: 'tail'`.
  - **Tag chips row** (`marginTop: 32`), small DMSans 600 28px chips on `surfaceVariant` bg, `radius.full`. Active/sold flip = `[Category] [Store]`. Closet = `[Category]` only.
  - **Variant block** (`marginTop: 24`):
    - `activeFlip`: hero price `formatMoney(roundDisplayPrice(item.resale))` in DMSans 600 88px `vintageBlueDark`; caption "target resale" DMSans 400 28px `mauve`.
    - `soldFlip`: hero price `formatMoney(item.soldPrice)` in DMSans 600 88px `profit`; caption `"sold on " + item.platform` DMSans 400 28px `mauve`. Profit pill `formatMoneyWithSign(soldPrice - paid)` only when profit > 0 (losses stay private).
    - `closet`: sub line "From my closet" DMSans 400 36px `charcoalSoft`. **No money rendered.** (Matches existing text composer at `detail.tsx:71`.)
  - **Watermark**, `position: absolute, bottom: 64, right: 80, opacity: 0.85`. Logo `<Image source={require('@/assets/logo/thriftvault_logo_v2.png')} style={{ width: 56, height: 56 }} />` + "ThriftVault" Playfair 700 32px `mauve`.

**Inline px sizes (not theme typography tokens):** theme tokens are sized for ~390px UI canvas; the 1080px capture canvas needs ~3× sizes. Adding `displayMega`/`heroPrice` tokens for one consumer = premature abstraction. Inline only inside `ShareCard.tsx` with a top-of-file comment explaining.

**Theme rule:** all colors via `theme.colors.*` (per `feedback_no_hardcoded_colors.md`).

### `components/ShareCardPreviewSheet.tsx`

Bottom sheet that previews the card before share. Recommended over direct-share because (1) capture is async (~100–400ms image preload + render commit) and the sheet animation hides that latency, (2) designer-led app, previewing the artifact builds trust, (3) graceful failure path (text fallback CTA).

**Props:**
```ts
{ visible: boolean; item: Item | null; variant: ShareVariant; sharing: boolean;
  onClose: () => void; onShare: () => void; onShareText: () => void }
```

**Pattern (mirror `PaywallModal.tsx:48-99` exactly):**
- `Modal animationType="none" transparent`
- `SHEET_OFFSCREEN = 700`, enter spring `tension: 55, friction: 11`
- Dismiss `Animated.timing toValue: 700, duration: 240` then `onClose()`
- Pan responder dismiss when `g.dy > 80 || g.vy > 0.5`
- Backdrop `theme.colors.overlayHeavy`; sheet `cream` with top corners `radius.xl`

**Content:**
- Drag handle (existing pattern)
- Title `theme.typography.h2` "Share as image"
- Card thumbnail, scaled-down `<ShareCard>` via `transform: [{ scale: 0.28 }]` wrapped to ~280×497 portrait, with `shadows.md`
- Primary CTA "Share image", `vintageBlueDark` bg, white text, height 56, radius 28. Disabled + `<ActivityIndicator>` while `sharing === true`.
- Secondary text "Share as text instead", calls `onShareText` (closes sheet, opens existing native text share).

### `utils/captureShareCard.ts`

Single-function wrapper around `captureRef`. Centralizes resolution + format decisions.

```ts
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

/** Capture a 1080×1920 share card View to a JPG file URI. */
export async function captureShareCard(viewRef: RefObject<View>): Promise<string> {
  return captureRef(viewRef, {
    format: 'jpg',
    quality: 0.92,
    width: 1080,
    height: 1920,
    result: 'tmpfile',
  });
}
```

**Decisions:** 1080×1920 (smaller looks soft after IG/TikTok upscale). JPG 0.92 (~250–500 KB; PNG offers no advantage since cream block is opaque, no transparency needed).

### `utils/shareItemImage.ts`

Orchestrator. No try/catch, callers own user-facing toasts and fallbacks.

```ts
import * as Sharing from 'expo-sharing';
import { Image } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import type { Item } from '@/types/inventory';
import { captureShareCard } from './captureShareCard';

export type ShareVariant = 'activeFlip' | 'soldFlip' | 'closet';

export function deriveShareVariant(item: Item): ShareVariant {
  if (item.intent === 'closet') return 'closet';
  if (item.status === 'sold' && item.soldPrice != null) return 'soldFlip';
  return 'activeFlip';
}

export function getPrimaryPhoto(item: Item): string | null {
  if (item.photos?.length) return item.photos[0];
  return item.img || null;
}

/** Preload http(s) photos. file:// and content:// are already on disk. */
export async function prefetchSharePhoto(uri: string, timeoutMs = 4000): Promise<boolean> {
  if (!/^https?:\/\//i.test(uri)) return true;
  return Promise.race([
    Image.prefetch(uri).then(() => true).catch(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs)),
  ]);
}

/** Capture + native share sheet. Caller handles fallback. */
export async function shareItemImage(viewRef: RefObject<View>, item: Item): Promise<void> {
  const uri = await captureShareCard(viewRef);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing not available');
  await Sharing.shareAsync(uri, {
    dialogTitle: item.name,
    mimeType: 'image/jpeg',
    UTI: 'public.jpeg',
  });
}
```

## Files to modify

### `app/detail.tsx`

**Imports**, add `ShareCard`, `ShareCardPreviewSheet`, the share-orchestrator helpers. Keep `Share` import (line 25) for the text fallback path inside the new flow.

**State** (alongside existing `useState`):
```ts
const [shareSheetVisible, setShareSheetVisible] = useState(false);
const [sharing, setSharing] = useState(false);
const shareCardRef = useRef<View>(null);
```

**Replace `handleShare` (`688-726`)**, keep `buildShareMessage` and `isUserCanceledShareError` unchanged. New flow:

- Web: keep existing `navigator.share` / clipboard text path verbatim
- Native: fire `prefetchSharePhoto(getPrimaryPhoto(item))` then `setShareSheetVisible(true)`

**Add two new callbacks:**
- `handleShareImage`, `await shareItemImage(shareCardRef, item)`. On `isUserCanceledShareError`, close cleanly. On any other error, fall back to existing `Share.share(text)` path. `finally` resets `sharing` + `shareSheetVisible`.
- `handleShareText`, closes preview, opens native text share via existing `Share.share` pattern.

**Uncomment + guard share button (`1590-1601`):**
```tsx
{getPrimaryPhoto(item) && (
  <Pressable
    style={styles.itemMenuItem}
    onPress={() => { closeItemMenu(); handleShare(); }}
    accessibilityLabel="Share"
    accessibilityRole="button"
  >
    <AppIcon name="share-outline" size={20} color={theme.colors.charcoal} />
    <Text style={styles.itemMenuItemText}>Share</Text>
  </Pressable>
)}
```

**Mount off-screen card + preview sheet** at the bottom of the screen tree (sibling to existing modals near `~1617`):
```tsx
{(shareSheetVisible || sharing) && item ? (
  <View
    pointerEvents="none"
    style={{ position: 'absolute', top: -10000, left: -10000, width: 1080, height: 1920 }}
    collapsable={false}
  >
    <ShareCard ref={shareCardRef} item={item} variant={deriveShareVariant(item)} />
  </View>
) : null}

<ShareCardPreviewSheet
  visible={shareSheetVisible}
  item={item}
  variant={item ? deriveShareVariant(item) : 'activeFlip'}
  sharing={sharing}
  onClose={() => setShareSheetVisible(false)}
  onShare={handleShareImage}
  onShareText={handleShareText}
/>
```

**`collapsable={false}` is critical**, Android otherwise flattens the wrapper and `captureRef` fails to find a backing native view. Most common view-shot gotcha.

### `package.json`

After prebuild, run: `npx expo install react-native-view-shot expo-sharing`. Don't pin guessed versions, let Expo resolve SDK 54 / RN 0.81 compatible releases. Both autolink (no `app.json` plugin entries needed).

## Layout decisions (rationale)

| Decision | Choice | Why |
|---|---|---|
| Aspect ratio | 9:16 captured at 1080×1920 | Native canvas for IG Stories/Reels, TikTok, Snap. Smaller looks soft after compositor upscale. |
| Photo treatment | Full-bleed top 65% (1080×1248), `resizeMode="cover"` | Photo is the hero of thrift content. Square/centered crops waste vertical space. 35% info band is editorial counterweight. |
| Active flip info | Tags + `formatMoney(roundDisplayPrice(resale))` in `vintageBlueDark`, "target resale" caption | Mirrors detail screen vocabulary; rounded prices feel aspirational. |
| Sold flip info | Tags + `formatMoney(soldPrice)` in `profit`, "sold on {platform}" caption, profit pill only when > 0 | Wins are shareable; losses private. |
| Closet info | Category chip only, "From my closet" sub. **No $.** | Closet ≠ commerce. Matches existing text composer behavior. |
| Watermark | Tiny logo + Playfair wordmark, bottom-right, 0.85 opacity | Recognizable, not screaming. Hero footer band would compete with content. |
| Typography | Inline px sizes inside `ShareCard.tsx` (Playfair 700 72px name, DMSans 600 88px price) | Theme tokens sized for 390px UI canvas; 1080px capture needs ~3× sizes. Avoid token sprawl for one consumer. |
| Format | JPG quality 0.92 | ~4–6× smaller than equivalent PNG; no transparency benefit. |

## Render-then-capture pattern

```
[user taps Share]
  ↓
handleShare()
  ├── prefetchSharePhoto(photo)           [fire-and-forget; sheet animation hides latency]
  └── setShareSheetVisible(true)          [mounts off-screen ShareCard + opens sheet]
  ↓
sheet animates in (~250ms); photo decodes; layout commits
  ↓
[user taps "Share image"]
  ↓
handleShareImage()
  ├── captureRef(shareCardRef, { width: 1080, height: 1920, format: 'jpg', quality: 0.92 })
  ├── Sharing.isAvailableAsync()
  └── Sharing.shareAsync(uri, { dialogTitle, mimeType, UTI })
  ↓
native share sheet → user picks app or cancels
```

**Off-screen technique:** `position: 'absolute', top: -10000, left: -10000` (real laid-out painted view, just outside viewport). NOT `opacity: 0` (Android black frame mid-capture) and NOT `display: 'none'` (removes from layout, breaks captureRef).

**Pitfalls handled:**
- **Font race**, `useFonts` in `_layout.tsx:46-51` already gates all rendering. No extra guard needed.
- **Image decode race**, `prefetchSharePhoto` fires on Share tap; by the time user taps "Share image" (~1–3s later), http(s) photos have decoded. file:// and content:// decode is instant. If capture fails anyway, text fallback fires.
- **Layout commit race**, mounting the off-screen card on `shareSheetVisible` flip gives ~250ms of animation cover for layout commit before any tap can land on the CTA.
- **Memory**, only mount when `shareSheetVisible || sharing`; unmount on close. No 1080×1920 view in memory during normal use.

## Edge cases

| Case | Handling |
|---|---|
| `getPrimaryPhoto(item) === null` | Hide Share menu item entirely (`{getPrimaryPhoto(item) && ...}` guard). |
| Sold flip with `soldPrice == null` | `deriveShareVariant` falls through to `activeFlip` (its check requires `soldPrice != null`). |
| Closet with `paid > 0` | `closet` variant hides $ regardless. Privacy. |
| Web platform | `handleShare` returns early into existing `navigator.share` text path. No capture. |
| Photos from `ph://` / `content://` / `file://` / `http(s)` | All work with RN `Image`; capture only sees the JPG output. |
| User cancels native share sheet | `Sharing.shareAsync` rejects with cancellation error; `isUserCanceledShareError` handles it; sheet closes silently. |
| Capture failure | Catch in `handleShareImage` falls back to `Share.share(text)`. User still gets a share sheet. |
| `Sharing.isAvailableAsync() === false` | Orchestrator throws; caller falls back to text. |
| Long name (50+ chars) | Card name uses `numberOfLines={2}` + `ellipsizeMode: 'tail'`. |
| Dark mode | Card uses theme tokens, captures dark when user is in dark mode. Acceptable (matches in-app). v2 could force light if needed. |

## Critical files

- `app/detail.tsx` (modify)
- `components/ShareCard.tsx` (new)
- `components/ShareCardPreviewSheet.tsx` (new)
- `utils/captureShareCard.ts` (new)
- `utils/shareItemImage.ts` (new)
- `package.json` (add deps post-prebuild)

## Execution sequence

1. RevenueCat prebuild already complete (MVP.md step 8).
2. `npx expo install react-native-view-shot expo-sharing`.
3. Create `ShareCard.tsx`, `ShareCardPreviewSheet.tsx`, `captureShareCard.ts`, `shareItemImage.ts`.
4. Modify `detail.tsx` (imports, state, replace `handleShare`, add `handleShareImage` + `handleShareText`, uncomment + guard menu button, mount off-screen card + preview sheet).
5. Verification matrix on iOS dev client first, then Android dev client.

## Verification

**Functional matrix:**
- [ ] Active flip with one photo → Share → preview shows card → "Share image" → IG Stories receives 1080×1920 JPG with name + target resale legible
- [ ] Active flip with multi-photo → first photo used
- [ ] Sold flip with `soldPrice` set + profit > 0 → preview shows sold price (`profit` color) + profit pill
- [ ] Sold flip with profit ≤ 0 → no profit pill, just sold price
- [ ] Closet with `paid > 0` → no $ on card anywhere
- [ ] Closet with `paid = 0` → no $
- [ ] Item with no photo → Share menu item hidden
- [ ] 50+ char name → truncates 2 lines with ellipsis, info block doesn't overflow

**Platform matrix:**
- [ ] iOS dev client: native share sheet opens with image; save-to-camera-roll works; IG handoff works
- [ ] Android dev client: native share sheet opens with image; IG/TikTok handoff works; no black frame in capture
- [ ] Web: Share triggers `navigator.share` / clipboard text only, no preview sheet, no regression

**Cancellation:**
- [ ] Swipe down preview sheet → no state leak; share button works on next tap
- [ ] Backdrop tap preview → same
- [ ] Cancel native share sheet (iOS + Android) → no toast, no error log

**Fallback:**
- [ ] Force capture failure (bogus ref temporarily) → text fallback fires
- [ ] "Share as text instead" CTA → closes preview, opens native text share

**Visual:**
- [ ] Card in IG Stories at full screen, typography legible, photo crisp, watermark visible but unobtrusive
- [ ] Card in TikTok preview, same
- [ ] Camera roll save → opens at correct 1080×1920
- [ ] Light + dark theme cards both render correctly (or decision made to force light)

**Performance:**
- [ ] Tap Share → preview visible within sheet animation
- [ ] Tap "Share image" → native share sheet appears within ~300ms iPhone 13, ~500ms mid-tier Android
- [ ] No memory growth after repeat share/dismiss cycles
