# Security Audit — 2026-04-30

Snapshot of safety and security findings against the ThriftVault codebase, plus the fixes applied in the same session. Pair this with [SAFETY.md](SAFETY.md) (agent guardrails + recovery playbooks). This doc is a point-in-time audit; rerun the methodology at the bottom before any major release or whenever the threat surface changes (new dependency, new key, new repo visibility).

## TL;DR

| Severity | Finding | Status |
|----------|---------|--------|
| Critical | Personal Apple ID email in committed `eas.json` on a public repo | Fixed (HEAD scrubbed; history retained) |
| Critical | `CLAUDE.md` + `SAFETY.md` leak D-U-N-S, Apple support correspondence, LLC details | Fixed (HEAD scrubbed; history retained) |
| High | `EXPO_PUBLIC_ANTHROPIC_API_KEY` ships in IPA; Anthropic does not support bundle-ID scoping | User action — set spend cap in `console.anthropic.com` |
| High | `EXPO_PUBLIC_GEMINI_API_KEY` may not be bundle-ID-scoped | User action — verify in Google Cloud Console |
| Medium | `.claude/settings.json` denied `npx`/`bunx` only; `pnpm`/`yarn` variants walked the fence | Fixed |
| Medium | `Sentry.init` did not explicitly set `sendDefaultPii: false`; no breadcrumb scrubber | Fixed |
| Medium | `package.json` `backup` script uses `git add -A` (catches anything ungitignored) | Open — pre-commit secret scan recommended |
| Low | `EXPO_PUBLIC_SENTRY_DSN` not configured | Open — already on `LAUNCH_OPS.md` |

## Repo state at audit time

- Remote: `https://github.com/ChrisLuhrsUX/thriftvaultapp.git`
- Visibility: **public** (verified via GitHub API, 2026-04-30)
- Default branch: `main`
- Stars / forks / PRs: 0 / 0 / 0

The public repo with zero audience is the deciding factor on most findings below — there is no community pressure to keep it public, so flipping to private resolves the historical-leak class of findings in one click. See [Recommendation: repo visibility](#recommendation-repo-visibility).

## Critical findings

### 1. Personal Apple ID email in `eas.json`

**Before:**

```20:24:eas.json
        "appleId": "chrisluhrsdesign@gmail.com",
        "ascAppId": "",
        "appleTeamId": ""
```

The repo is public. The email is the Apple Developer account login. Combined with leaked support-correspondence context (finding 2), this is high-quality spear-phishing material.

**Fix applied:** field removed from `eas.json`. EAS prompts at submit time, or set `EXPO_APPLE_ID` in shell / EAS Secret.

**Residual risk:** the email is still on every commit's author line (`git log -1 --format="%ae"` returns it). Removing from HEAD reduces casual exposure; full removal requires either history rewrite (denied by guardrails — correctly) or repo-private.

### 2. Business-state leaks in `CLAUDE.md` and `SAFETY.md`

**Before — `CLAUDE.md` Business State section listed:**

- D-U-N-S 145002422
- Specific Apple Dev Support correspondence (dates, content, founder confirmation, individual-to-org conversion in flight)
- LLC formation date, signing block, local Windows path `C:\Users\Chris\Downloads\ThriftVault\ThriftVault_LLC\`
- Annual overhead numbers and tax structure

**Before — `SAFETY.md` Backup discipline table listed:**

- D-U-N-S 145002422 (same number)

**Why this matters:** A spear-phisher emails the leaked Apple ID from a lookalike domain ("developer-support@apple.com.…"), references the real conversion request from 2026-04-29, references the real D-U-N-S, and references "your reply confirming sole founder of ThriftVault LLC." Every detail is real and verifiable. The probability of click-through is high.

**Fix applied:** specifics scrubbed from HEAD. Structural context kept (LLC exists, conversion in flight, iOS-first) so the agent retains useful project context. Identifiers tracked outside the repo.

**Residual risk:** historical commits (`c153366`, `f98ebc3`, `38029a3`, others) still contain the original text. Same residual-risk shape as finding 1.

## High findings

### 3. Anthropic key has no bundle-ID restriction

`EXPO_PUBLIC_*` keys are bundled into the IPA. This is documented and accepted (see `DEV_OPS.md:75`). The asymmetry between providers is the issue:

- **Gemini** supports iOS bundle-ID restriction in Google Cloud Console. A leaked Gemini key restricted to `com.thriftvault.app` is useless when called from a different `User-Agent` / referrer.
- **Anthropic** does not. A leaked Anthropic key bills your account from anywhere, on any model, until you rotate.

**Status:** open. User actions:

- [ ] `console.anthropic.com` → API Keys → set a daily and monthly hard cap on the key currently in `.env`. $50/day is plenty for normal usage; abuse hits the cap and surfaces fast.
- [ ] Long-term (post-launch): move Anthropic fallback server-side once a backend exists. Tracked implicitly in the no-backend architecture choice.

### 4. Gemini key bundle-ID restriction unverified

`SAFETY.md:59` says rotation should scope by iOS bundle ID, but the *current* key's restriction state cannot be verified from the codebase.

**Status:** open. User action:

- [ ] Google Cloud Console → APIs & Services → Credentials → click the Gemini key → Application restrictions → iOS apps → add bundle ID `com.thriftvault.app`. If already restricted, no-op.

## Medium findings

### 5. `.claude/settings.json` package-manager loophole

The deny list covered `npx`, `bunx`, and bare commands but missed `pnpm`, `pnpx`, `yarn`, and `yarn dlx`. A future agent that switches package manager (or one tricked into doing so) walks around the fence.

**Fix applied:** added `pnpm`/`pnpx`/`yarn`/`yarn dlx` variants for `expo prebuild` and all destructive migration tools (Prisma reset, Prisma `--force-reset`, Prisma `--accept-data-loss`, Sequelize `db:drop`, Sequelize `db:migrate:undo:all`, Knex `migrate:rollback --all`, drizzle-kit `drop`, typeorm `schema:drop`).

### 6. Sentry hardening

**Before:**

```23:28:app/_layout.tsx
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 0 : 0.2,
});
```

`@sentry/react-native` v7 defaults `sendDefaultPii` to `false`, so the prior config was *currently* fine — but the default has flipped between major versions before. UI breadcrumbs (`ui.input`, `ui.click`) can also capture text from `<TextInput>` fields where users type notes, store names, item names — none of which should leave the device.

**Fix applied:** explicit `sendDefaultPii: false` and a `beforeBreadcrumb` hook that redacts `ui.input` and `ui.click` breadcrumb message and value fields:

```23:36:app/_layout.tsx
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 0 : 0.2,
  sendDefaultPii: false,
  beforeBreadcrumb: (breadcrumb) => {
    // Strip user-typed text from UI breadcrumbs — notes/store/name fields can contain PII.
    if (breadcrumb.category === 'ui.input' || breadcrumb.category === 'ui.click') {
      if (breadcrumb.message) breadcrumb.message = '[redacted]';
      if (breadcrumb.data && 'value' in breadcrumb.data) breadcrumb.data.value = '[redacted]';
    }
    return breadcrumb;
  },
});
```

### 7. `npm run backup` uses `git add -A`

```10:10:package.json
    "backup": "git add -A && git commit -m \"backup\" && git push"
```

`git add -A` stages anything not in `.gitignore`. `.env` is correctly ignored today. But add a future secret file (`eas.local.json`, `.env.production`, `serviceAccount.json`) and forget to ignore it, and one `npm run backup` pushes it to a public repo with the message "backup".

**Status:** open. Recommendation: pin the script to specific paths, or add a pre-commit hook that greps staged content for known secret prefixes. Quick form for a Husky-free repo:

```bash
# .git/hooks/pre-commit (chmod +x)
if git diff --cached --no-color | grep -E 'AIza[0-9A-Za-z_-]{35}|sk-ant-[A-Za-z0-9_-]+|sk-proj-[A-Za-z0-9_-]+|appl_[A-Za-z0-9]+|goog_[A-Za-z0-9]+'; then
  echo "Refusing to commit — likely API key in staged diff"
  exit 1
fi
```

`.git/hooks/` is local-only; for shared enforcement, move to a tracked `.husky/` setup post-launch.

## Low findings

### 8. `EXPO_PUBLIC_SENTRY_DSN` not in `.env`

Crash reporting is inert until the DSN is set. Already on `LAUNCH_OPS.md:71`. Not a security issue — visibility issue. Set before TestFlight.

### 9. Confirmed clean — listed for the record

These are not findings; they are paths I verified are safe so a future audit doesn't redo the same work.

- `.env` is gitignored (`.gitignore:47`) and was never committed. Verified `git log -S"AIza"` and `git log -S"sk-ant"` against full history — both empty.
- No `AsyncStorage.clear()` anywhere in the codebase. Only safe per-key `removeItem` calls for `tv_pending_scan` (transient) and `tv_prompt_dismissed_${id}` (per-item flag).
- `setInventory([])` only called from the init-when-empty path in `InventoryContext.tsx`. No bulk-clear paths.
- `dangerouslySetInnerHTML` in `app/+html.tsx:22` injects a static CSS string with no interpolation.
- All `Linking.openURL` calls use hardcoded URLs (privacy/terms on GH Pages, mailto, App Store). No user-input concatenation.
- `Math.random()` for snapshot IDs in `app/(tabs)/scan.tsx:1293` is local-only and timestamp-prefixed; not a security path.
- No `eval`, `new Function`, `setTimeout(string)`, or other dynamic-code paths.
- `app.json` permission strings are accurate. `ITSAppUsesNonExemptEncryption: false` is correct for HTTPS-only with no custom crypto.
- Privacy manifest declares only `CA92.1` (UserDefaults for AsyncStorage) — accurate, no over-disclosure.
- No `EXPO_PUBLIC_*` key (other than DSN) is used in non-bundle code paths where a non-public alternative exists.

## Recommendation: repo visibility

The most leverage available right now: **make the repo private until launch.**

| Action | Resolves | Effort |
|--------|----------|--------|
| Repo private | Findings 1 + 2 historical leaks; finding 3/4 reduced exposure | One click, reversible |
| Scrub HEAD only (done) | Findings 1 + 2 going forward | Done |
| Force-push history rewrite | Findings 1 + 2 fully | Denied by guardrails — manual user op only |

Path: GitHub repo → Settings → General → Danger Zone → Change visibility → Make private. Re-public when launch announcement is ready and any historical leaks have been rotated/staled (Apple Dev correspondence is time-bounded; D-U-N-S doesn't change but is publicly searchable anyway).

If you keep it public, also configure per-repo author email so future commits don't leak personal Gmail:

```bash
cd thriftvaultapp
git config user.email "46426899+ChrisLuhrsUX@users.noreply.github.com"
```

(Existing commits stay as-is. Run inside the repo — local config only, does not touch global.)

## Action checklist

Status as of 2026-04-30 13:14 ET.

### Done in this audit
- [x] Remove `appleId` from `eas.json`
- [x] Scrub `CLAUDE.md` Business State of D-U-N-S, Apple support correspondence dates, LLC paperwork details, local Windows path
- [x] Scrub `SAFETY.md` D-U-N-S reference
- [x] Add `pnpm`, `pnpx`, `yarn`, `yarn dlx` deny matchers to `.claude/settings.json` for `expo prebuild` and all destructive migration tools
- [x] Add explicit `sendDefaultPii: false` and `beforeBreadcrumb` PII scrubber to `Sentry.init`

### Open — user action
- [ ] Decide on repo visibility (private until launch is the recommended default)
- [ ] Set Anthropic per-key spend cap at `console.anthropic.com`
- [ ] Verify Gemini key has iOS bundle-ID restriction `com.thriftvault.app` in Google Cloud Console
- [ ] (If staying public) configure per-repo `user.email` to GitHub noreply
- [ ] Wire `EXPO_PUBLIC_SENTRY_DSN` before TestFlight
- [ ] Optional: add `.git/hooks/pre-commit` secret-scan grep, or move to Husky post-launch

## Methodology — rerun before each major release

What this audit checked. Save this list; rerun the same checks before TestFlight, before each App Store submission, and after any new dependency or new EAS Secret.

1. **Repo visibility check.**
   ```bash
   curl -s https://api.github.com/repos/<owner>/<repo> | grep visibility
   ```
2. **Tracked secret files.** Confirm `.env` and any new `.env.*` are in `.gitignore` and not tracked:
   ```bash
   git check-ignore -v .env
   git ls-files | grep -i "\.env"
   ```
3. **Historical secret check.** For each known secret prefix, scan the full history:
   ```bash
   git log --all --source --remotes --oneline -S"AIza"
   git log --all --source --remotes --oneline -S"sk-ant"
   git log --all --source --remotes --oneline -S"appl_"
   ```
4. **Public-file PII check.** For all tracked Markdown and JSON files, search for identifiers you don't want exposed (D-U-N-S, EIN, personal emails, support-thread content, local paths):
   ```bash
   git ls-files "*.md" "*.json" | xargs grep -E -l "your-d-u-n-s|your-ein|your-email"
   ```
5. **`EXPO_PUBLIC_*` audit.** Every key prefixed `EXPO_PUBLIC_` ships in the IPA. For each one, document the scoping or rate-limit posture in the rotation runbook (`SAFETY.md` section 6).
6. **Destructive-pattern grep.** Confirm no new `AsyncStorage.clear`, `removeItem('tv_inv')`, `multiRemove`, bulk `setInventory([])`, or directory-level `FileSystem.deleteAsync` in production paths:
   ```bash
   rg -n "AsyncStorage\.(clear|removeItem|multiRemove)" --type ts --type tsx
   rg -n "setInventory\(\[\]\)|FileSystem\.deleteAsync" --type ts --type tsx
   ```
7. **Dynamic-code grep.**
   ```bash
   rg -n "eval\(|new Function|Function\(['\"]" --type ts --type tsx
   ```
8. **Sentry config check.** Confirm `sendDefaultPii: false` and a breadcrumb scrubber exist in `app/_layout.tsx`.
9. **Guardrail coverage check.** Diff `.claude/settings.json` against any new package managers, ORMs, or cloud CLIs added since the last audit. Each new tool with a destructive subcommand needs a `npx` / `pnpm` / `yarn` matcher set.
10. **Linking + URL audit.** Every `Linking.openURL` and `WebBrowser.openBrowserAsync` call should use a hardcoded URL. No user-input concatenation:
    ```bash
    rg -n "Linking\.openURL|WebBrowser\.openBrowserAsync" --type ts --type tsx
    ```

## See also

- [SAFETY.md](SAFETY.md) — agent guardrails, recovery playbooks, code-level destructive patterns
- [LAUNCH_OPS.md](LAUNCH_OPS.md) — pre-launch checklist (Sentry DSN wiring lives there)
- [DEV_OPS.md](DEV_OPS.md) — secrets management, build-time vs runtime keys
- [`.claude/settings.json`](.claude/settings.json) — hard-enforced deny/ask matchers
