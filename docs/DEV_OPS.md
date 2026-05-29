# Dev Ops

Engineering reference for building, testing, and shipping ThriftVault. Consulted at release time and when modifying infra. Operational cadence (what to monitor day-to-day) lives in `LAUNCH_OPS.md`.

## Versioning policy

Semantic versioning: `MAJOR.MINOR.PATCH`. Bumped in `app.json`.

| Change | Bump | Example |
|--------|------|---------|
| Bug fix only, no new behavior | PATCH | 1.0.0 → 1.0.1 |
| New feature, no breaking change | MINOR | 1.0.1 → 1.1.0 |
| Breaking UX change, schema migration | MAJOR | 1.1.0 → 2.0.0 |

Two version fields in `app.json`:
- **`version`**, user-visible (App Store listing). Bump per the table above.
- **`ios.buildNumber`**, Apple-internal, monotonic integer. Bump on **every** submission, even resubmits of the same `version`. Apple rejects duplicate build numbers within the same `version`.

Tag every public release: `git tag -a v1.0.0 -m "Initial App Store release"` then `git push --tags`.

## Branch strategy

Solo dev → `main` is fine. Two rules:

1. **Stop using "backup" commit messages.** Every commit message should answer "what does this enable / fix / change?", `fix: rescan respects altered-pants $180 ceiling` not `backup`. Recent log will be readable to future-you.
2. **Tag every release** so you can `git checkout v1.0.0` if you need to reproduce a customer-reported bug from that version.

If you ever bring on collaborators, switch to PR-based: feature branch → PR → squash-merge to `main`.

## EAS build profiles

Defined in `eas.json`. Use the right profile for the moment:

| Profile | Purpose | Distribution |
|---------|---------|--------------|
| `development` | Dev client for local iteration after prebuild | Internal, install on your physical iPhone |
| `preview` | TestFlight internal testing | Internal testers + you |
| `production` | App Store submission | Public |

Common commands:

```bash
# Install dev client on your iPhone (one-time after prebuild)
eas build --profile development --platform ios

# Build for TestFlight beta
eas build --profile preview --platform ios

# Build + submit to App Store
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

`ascAppId` and `appleTeamId` in `eas.json` need to be filled in once the Apple Developer Org account is live.

## Secrets management

**Never commit `.env`** (already gitignored, verify before each commit).

Local dev → `.env` file at project root with:
```
EXPO_PUBLIC_GEMINI_API_KEY=...
EXPO_PUBLIC_ANTHROPIC_API_KEY=...
EXPO_PUBLIC_SENTRY_DSN=...
EXPO_PUBLIC_REVENUECAT_API_KEY=...   # iOS public key from RevenueCat dashboard
```

Production builds → EAS Secrets (encrypted, baked into build):
```bash
eas secret:create --scope project --name EXPO_PUBLIC_GEMINI_API_KEY --value "..."
eas secret:list           # verify
eas secret:delete <id>    # rotate by deleting + recreating
```

**`EXPO_PUBLIC_*` keys are bundled and visible to anyone who unzips the IPA.** This is by design for client-side keys, but means:
- Use Google Cloud Console to scope the Gemini key by iOS bundle ID.
- Monitor Anthropic console for sustained spikes (could indicate someone pulled the key out of the bundle).
- Rotation flow if leaked: create new key → `eas secret:delete` old → `eas secret:create` new → `eas update --branch production` to push the rebuilt JS bundle to existing users → revoke old key.

The Sentry **auth token** (used for source-map upload during build, NOT the runtime DSN) lives in EAS Secrets as `SENTRY_AUTH_TOKEN`. Never `EXPO_PUBLIC_*` since it has write access to the Sentry org.

## Source maps to Sentry

Without uploaded source maps, Sentry stack traces are minified gibberish. The Expo Sentry integration uploads them automatically during `eas build` if:

1. `@sentry/react-native` is installed and wrapped in `_layout.tsx` (`Sentry.wrap(RootLayout)`).
2. The Sentry Expo plugin is auto-discovered via `@sentry/react-native` (no explicit `app.json` entry needed). Confirmed active on the 2026-05-27 dev build, where source-map upload was disabled via `SENTRY_DISABLE_AUTO_UPLOAD=true` in `eas.json:development.env`.
3. `SENTRY_AUTH_TOKEN` is set in EAS Secrets (still pending for production profile).
4. `EXPO_PUBLIC_SENTRY_DSN` is set in EAS Secrets (still pending for production profile; live in local `.env`).
5. `SENTRY_ORG` + `SENTRY_PROJECT` set in EAS Secrets on production profile (required for source-map upload, otherwise the build fails the way the 2026-05-27 dev build did before the disable-flag).

After each build, verify in Sentry → Settings → Projects → Source Maps that the new release shows up with maps attached.

## Pre-submit smoke test

Run on a physical iPhone (NOT simulator) before every `eas submit`. Apple will reject anything that doesn't survive these.

- [ ] Cold launch from springboard, no white flash, fonts load, status bar correct
- [ ] Onboarding (clear `tv_onboarding_done` and re-run), all 3 slides render, "Get Started" routes to `/(tabs)/`
- [ ] Camera scan: single-shot capture, single-photo result
- [ ] Camera scan: 2–5 photo multi-shot, auto-scan at 5/5
- [ ] Library scan: pick 1 photo and 3 photos
- [ ] Backgrounding mid-scan: lock phone for 5s, unlock, result still arrives
- [ ] Cancel mid-scan: button works, no zombie result
- [ ] Wrong-scan rescan: lower / higher correction toasts fire
- [ ] Handmade rescan: yes/no prompts, persisted dismissal
- [ ] Red-flag yes/no prompt: dismissal collapses banner
- [ ] Add scan to vault: photo persists across app restart
- [ ] Edit item: rename, change category, mark sold
- [ ] Delete item: confirm flow, removed from grid
- [ ] Hauls: create, add to, view detail
- [ ] Paywall: opens, plan selection works, RevenueCat sandbox purchase succeeds (use a sandbox Apple ID at `appleid.apple.com` → "Sandbox" tab; end-to-end flow verified once on 2026-05-27 with `chrisluhrsdesign+sandbox@gmail.com`)
- [ ] Restore Purchases button works
- [ ] Profile → Privacy + Terms links open `chrisluhrsux.github.io` URLs
- [ ] Force-quit + relaunch: vault, hauls, scan history all rehydrate

## TestFlight workflow

**Skipped for v1.0** per insufficient tester pool. Sentry crash reporting + the pre-submit smoke test below carry the load. Section kept for reference if a future release warrants beta testing.

Original use: TestFlight before every public submit. Costs nothing, catches what you missed.

1. `eas build --profile preview --platform ios`, wait ~15 min
2. `eas submit --profile preview --platform ios` (uploads to TestFlight, NOT public)
3. Wait for processing (~15 min). It appears in App Store Connect → TestFlight.
4. **Internal testing** (you, friends, family, up to 100 users, no Apple review):
   - Add testers' Apple IDs in App Store Connect → Users and Access
   - They install the TestFlight iOS app and accept invite
5. **External testing** (broader beta, up to 10,000 users, requires beta App Review ~24h):
   - Submit for beta review the first time only; subsequent builds in same version skip review
   - Run external for ≥1 week before public submit on a 1.0.0
   - For patch releases, internal-only is usually sufficient

## Release flow (from clean `main` to App Store)

```bash
# 1. Bump version
# Edit app.json: version (per semver) + ios.buildNumber (always +1)

# 2. Type check
npx tsc --noEmit
# Should be clean except known pre-existing errors

# 3. Commit + tag
git add app.json
git commit -m "chore: bump version to 1.0.1 build 5"
git tag -a v1.0.1 -m "Patch: scan card spacing, altered-shorts clamp"
git push && git push --tags

# 4. Build for App Store
eas build --profile production --platform ios
# Wait ~15-20 min

# 5. Smoke test the same commit via dev client first (TestFlight skipped for v1.0)
# eas build --profile development --platform ios   # if not already on this commit
# Install via QR and test on phone for 30+ min real usage

# 6. Submit to App Store
eas submit --profile production --platform ios

# 7. In App Store Connect, fill in:
#    - "What's New in This Version" (changelog)
#    - Screenshots if changed
#    - Submit for Review

# 8. Wait 1-24h for Apple review
# 9. When Approved: "Manual" release toggle → "Release This Version" when ready
```

## Local dev workflow

**Current state (post-prebuild as of 2026-05-27):** Expo Go no longer works for this app. RevenueCat's native module (`react-native-purchases`) isn't bundled in Expo Go. Dev client is built and installed on iPhone 13.

```bash
cd C:\Users\Chris\Downloads\ThriftVault\thriftvaultapp
npx expo start --dev-client
# Open ThriftVault dev client on phone (NOT Expo Go), it auto-connects on same Wi-Fi
# w = web preview still works (camera + RevenueCat stubbed on web)
```

### When to rebuild the dev client

JS / TSX / prompt / style edits never need a rebuild, just save the file and Fast Refresh hits the phone. Re-run `eas build --profile development --platform ios` only when:

- Adding a new native dependency (`npm install something-with-native-code`)
- Editing `app.json` `plugins` array
- Changing the app icon (bundled natively)

After the rebuild finishes, reinstall via the new QR. Existing data on the phone survives the reinstall.

### Dev client mental model

Think of the dev client as "Expo Go but custom-built for your app, with RevenueCat baked in." Everything else stays the same: same physical phone, same Wi-Fi network as the Windows machine.

## Hotfix paths

Same as `LAUNCH_OPS.md`, with the technical detail:

**JS-only bug** (component logic, prompt text, styling, regex):
```bash
# Test the fix locally first
eas update --branch production --message "fix: clamp altered-shorts to $120"
# Ships in ~5 min, no Apple review, hits all users on next app open
```

**Native / config bug** (permissions, plugins, native dependencies, app.json):
- Requires full `eas build` + `eas submit` cycle. 1–24h Apple review.
- If critical: request "Expedited Review" in App Store Connect (use sparingly, they keep score).

**Rollback an OTA update:**
```bash
eas update:list --branch production           # find a known-good update ID
eas update:republish --group <id>             # republish a previous group
```

**Pull a bad release:**
- App Store Connect → My Apps → ThriftVault → Pricing and Availability → "Remove from sale"
- Existing users keep their installed version. New downloads blocked. Re-enable when fixed.

## What to do if Apple rejects

Common rejection reasons + fixes:

| Reason | Fix |
|--------|-----|
| Missing privacy policy URL | Already have `chrisluhrsux.github.io/.../privacy-policy.html`, paste it in App Store Connect |
| Missing Restore Purchases | Already implemented in `PaywallModal.tsx`, point reviewer to Profile → Manage Subscription |
| Missing sample login | N/A, no auth in app |
| Crash on launch in their environment | Look at the crash log they attach; fix; resubmit |
| Subscription terms not visible | Already shown in PaywallModal; reference in reply |
| Misleading metadata | Edit screenshots / description; resubmit |

Reply professionally in App Store Connect → Resolution Center. Most rejections are recoverable in <24h.
