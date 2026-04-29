# Safety

Source of truth for what an agent (Claude Code or any other) is and isn't allowed to do in this codebase, plus recovery playbooks for when something does go wrong. Hard enforcement lives in `.claude/settings.json` — this doc is the human-readable version of those rules and the fallback when something escapes them.

**Why this exists:** A founder running Cursor with Opus 4.6 lost a production database and backups in 9 seconds when the agent reached the underlying cloud API directly, bypassing Cursor's permission UI. The lesson generalizes: a permission fence the agent can walk around is decoration. The fence in this codebase is `.claude/settings.json`. The agent treats it as load-bearing and will not attempt to circumvent it.

## 1. Never (denied at the harness level)

These commands are blocked in `.claude/settings.json`. The agent will refuse them. If they need to run, the user runs them manually in their own terminal.

| Command | Why denied |
|---------|-----------|
| `eas submit*` | Sends a build to App Store Review — irreversible without "Reject Binary" / "Remove from sale" |
| `eas build --profile production*` | Produces an artifact intended for App Store; should always be a deliberate human act |
| `eas update --branch production*` | OTA push to live users — propagates in minutes |
| `npx expo prebuild*` (and variants) | Permanently breaks Expo Go for this project; transforms the repo's native folders |
| `git push --force*` / `-f` / `--force-with-lease` | Overwrites remote history; can wipe collaborator work and GH Pages |
| `git reset --hard*` | Discards uncommitted local work with no recycle bin |
| `git clean -f*` / `-fd*` | Wipes untracked files including `.env` |
| `git checkout -- .*` / `git checkout .*` | Same — discards working tree changes |
| `git branch -D*` | Force-deletes a branch even if unmerged |
| `git tag -d*` / `--delete*` | Removes release markers |
| `gh repo delete*` / `release delete*` / `pr close*` | Destructive on GitHub remote |
| `gcloud*`, `aws*`, `fastlane*`, `railway*`, `heroku*`, `firebase*`, `supabase*` | Cloud-write CLIs — direct API access is exactly the Cursor incident vector |

The user's global `~/.claude/settings.json` already denies `rm`, `mv`, `cp`, `sudo`, `curl`, `wget` and asks on `git push` / `git commit` — those are not duplicated here.

## 2. Confirm before running (ask matchers)

The agent will surface a confirmation prompt for each of these. Read the prompt carefully — one careless click on a destructive command produces the same outcome as the Cursor incident.

| Command | Why ask |
|---------|---------|
| `eas update*` (non-prod branches) | OTA pushes to dev/preview testers — bounded blast radius but still real |
| `eas build*` (non-prod profiles) | Uses build minutes; can produce TestFlight builds |
| `eas secret:create*` / `eas secret:delete*` | Modifies build-time secrets |
| `eas:*` (catch-all) | Anything else through the EAS CLI |
| `npm uninstall*` | Removing a package can break the build |
| `npm install -g*` | Global installs leak across projects |
| `npx expo install*` / `--fix` | Bumps Expo-ecosystem package versions |

## 3. Recovery playbooks

### `.env` loss

Every key is recoverable from its console. None of these are stored in git (correct).

1. **Gemini** (`EXPO_PUBLIC_GEMINI_API_KEY`) — `aistudio.google.com` → API keys → create new, scope by iOS bundle ID `com.thriftvault.app`.
2. **Anthropic** (`EXPO_PUBLIC_ANTHROPIC_API_KEY`) — `console.anthropic.com` → API keys.
3. **Sentry DSN** (`EXPO_PUBLIC_SENTRY_DSN`) — `sentry.io` → Settings → Projects → ThriftVault → Client Keys.
4. **Sentry auth token** (build-time, EAS Secret only — NEVER `EXPO_PUBLIC_*`) — `sentry.io` → Settings → Auth Tokens.
5. **RevenueCat** (`EXPO_PUBLIC_REVENUECAT_API_KEY`) — `app.revenuecat.com` → Project → API Keys → iOS public key.

Recovery steps: rebuild `.env` from the consoles → `npx expo start --clear` to flush the bundler cache → verify scan + paywall work.

If you've been backing up to 1Password (recommended), restore from there instead.

### Accidental `git push --force` to main

GitHub keeps the reflog briefly (~90 days for unreferenced commits). Steps:

1. Find the last good SHA: `git reflog show origin/main` or the GitHub web "View all branches".
2. From a known-good local clone: `git push origin <good-sha>:main --force` — manual, after verification, by the user (the agent is denied).
3. If the branch is protected and reflog is gone: contact GitHub Support within 90 days of the force-push.

### Accidental `eas submit`

1. **While in review** — App Store Connect → My Apps → ThriftVault → Build → "Reject Binary."
2. **After approval, before release** — Don't release. Archive the build.
3. **Already released** — App Store Connect → Pricing and Availability → "Remove from Sale." Existing users keep the version they have; new downloads blocked. Submit a corrected build.

### Accidental `npx expo prebuild`

This commits `ios/` and `android/` native folders into the project and modifies `app.json` / `package.json`.

1. **Uncommitted** — `git checkout -- ios/ android/ app.json package.json` and `git clean -fd ios/ android/` (manual — denied to agent).
2. **Committed but not pushed** — `git revert <prebuild-sha>` to create a revert commit.
3. **Pushed** — Same revert; verify Expo Go still loads after.

After any prebuild revert: delete `node_modules/`, `npm install`, `npx expo start --clear`.

### Accidental `AsyncStorage.clear()` in code

This is the highest-blast-radius local incident: every user's vault data is lost on next launch with no server backup.

- **Prevention** — `InventoryContext.tsx` and the `sanitizeSnapshot` rehydration path are load-bearing. Never add `AsyncStorage.clear()` calls outside of debug-only paths gated behind `__DEV__`.
- **If shipped to production** — There is no remote restore. Hotfix immediately via `eas update` (manual). Consider a one-time in-app migration that prompts users on next open.

### Bad OTA update reaches users

`eas update --branch production` (denied to agent — manual user action) ships in minutes. To roll back:

1. `eas update:list --branch production` — find the last-known-good update group.
2. `eas update:republish --group <id>` — republishes that group as the latest. (Manual.)

If the bug is bad enough to warrant pulling the app: App Store Connect → Pricing and Availability → "Remove from Sale" while you fix.

## 4. Backup discipline

| Asset | Where | Cadence |
|-------|-------|---------|
| Code | GitHub `origin/main` | Push at minimum daily during active dev; before any irreversible op |
| `.env` | 1Password (or equivalent) | On every key add/rotate |
| App Store Connect product config | Screenshots → `C:\Users\Chris\Downloads\ThriftVault\ThriftVault_LLC\` | Every product/price change |
| RevenueCat dashboard config | Screenshots same location | Every entitlement/offering change |
| Apple Developer identifiers (D-U-N-S 145002422, team ID, bundle ID `com.thriftvault.app`) | Stable doc next to LLC paperwork | Once at enrollment, then on any change |

## 5. API key rotation runbook

If any `EXPO_PUBLIC_*` key is exposed (leaked, abused, or rotated as policy):

1. **Create new key** in the respective console. Scope it (Gemini → iOS bundle ID `com.thriftvault.app`).
2. **Update `.env`** locally and `eas secret:create --scope project --name <KEY> --value <new>` for production.
3. **Push the new bundle**: `eas update --branch production --message "rotate <KEY>"` — manual, denied to agent.
4. **Revoke old key** in the console after the OTA update has propagated (~24h to be safe — users with backgrounded apps may not have updated yet).
5. **Log the rotation** in `CLAUDE.md` under the current session notes (date, which key, why).

## 6. When NOT to defer to the agent

These operations remain manual user actions, regardless of how mundane they seem:

- App Store Connect submissions of any kind
- OTA updates to the production branch
- `npx expo prebuild` (one-way door)
- Force pushes
- Hard resets
- Cloud-CLI write commands (gcloud, aws, fastlane, railway, etc.)
- Apple Developer / RevenueCat dashboard changes (these are web UI anyway, but if a CLI ever exists, treat as denied)
- Granting any new MCP server cloud-write authority without first reviewing the permission scope

The agent treats `.claude/settings.json` as load-bearing. The fence is real, not decoration.

## 7. Reading order for the agent

When the agent starts work that touches:
- Deployment, release, build infra
- Apple Developer / App Store Connect
- RevenueCat, Sentry, EAS
- Anything in `.env` or EAS Secrets
- API keys or rate limits

→ Read this file first. If a planned action isn't covered here, surface the question to the user before acting.
