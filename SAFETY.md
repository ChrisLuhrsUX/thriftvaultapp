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
| `psql*`, `mysql*`, `mysqldump*`, `mongo*`, `mongosh*`, `mongodump*`, `mongorestore*`, `redis-cli*`, `sqlite3*` | Database CLIs — connection-string-in-env + interactive shell can run `DROP`, `TRUNCATE`, `DELETE` against live data. ThriftVault has no backend today, but these are denied prophylactically. |
| `prisma migrate reset*` (and `npx`/`bunx` variants) | Drops the database and re-runs every migration — the literal "wiped during migration" failure mode. |
| `prisma db push --force-reset*` / `--accept-data-loss*` (and `npx` variants) | Same destruction with friendlier flag name. Always denied. |
| `sequelize-cli db:drop*`, `db:migrate:undo:all*` (and `npx` variants) | Drop database / undo all migrations. |
| `knex migrate:rollback --all*` (and `npx` variant) | Reverts every migration; can leave the DB in a state that makes data unrecoverable. |
| `drizzle-kit drop*` (and `npx` variant) | Drops schema. |
| `typeorm schema:drop*` (and `npx` variant) | Drops schema. |
| `node -e *` / `--eval *` / `-p *` / `--print *` | Inline Node script execution. The Cursor-incident shape: agent reaches a cloud API directly via `fetch()` from inline JS, bypassing every Bash CLI denylist. Always denied; legitimate uses are essentially zero in this codebase. |

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
| `prisma migrate*`, `prisma db push*` (and `npx` variants) | Non-destructive migration ops still touch live schema; review each call. |
| `knex migrate*`, `sequelize-cli db:migrate*` (and `npx` variants) | Same — apply migrations is intentional, not casual. |
| `drizzle-kit*`, `typeorm migration:*` (and `npx` variants) | Same. |

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

### Database wiped or migration disaster

ThriftVault has no backend today. If/when one is added (Supabase, Postgres, Mongo, etc.), this playbook is the contract. The Cursor incident is exactly this scenario; treat it as load-bearing.

**Before any migration runs, the user (NOT the agent) must:**
1. Take a snapshot or export — managed Postgres/MySQL/Mongo all support point-in-time backups; trigger one and verify it lists in the dashboard.
2. Run the migration against a **staging** DB first. Never run an untested migration directly against production.
3. After staging verifies, run against production with the snapshot ID written down. Do NOT drop the snapshot until the migration has been live for at least 24 hours under real traffic.

**If a destructive migration runs against production anyway:**
1. Stop writes — put the app in maintenance mode (RevenueCat / App Store Connect "Remove from Sale" if there's no in-app maintenance toggle).
2. Restore from the most recent snapshot — every managed DB platform has "Restore to point in time" or "Restore from backup" in its console.
3. Re-run only the **non-destructive** migration steps after restore.
4. Diff the restored data against any user activity that happened between the snapshot and the disaster — that window may need manual reconciliation.
5. If no snapshot exists: data is gone. There is no "undelete" for a `DROP TABLE` against a DB without backups. This is why pre-migration snapshots are non-negotiable.

**Why the agent is denied here**, not just "asked":
- Migration commands look mundane (`prisma migrate reset` reads like "reset" not "destroy").
- The cost of a wrong click is total user data loss.
- The cost of a confirmation prompt is 5 seconds.
- Asymmetric. Always deny outright; user runs them manually.

### Accidental `AsyncStorage.clear()` in code

This is the highest-blast-radius local incident: every user's vault data is lost on next launch with no server backup.

- **Prevention** — `InventoryContext.tsx` and the `sanitizeSnapshot` rehydration path are load-bearing. Never add `AsyncStorage.clear()` calls outside of debug-only paths gated behind `__DEV__`.
- **If shipped to production** — There is no remote restore. Hotfix immediately via `eas update` (manual). Consider a one-time in-app migration that prompts users on next open.

### Bad OTA update reaches users

`eas update --branch production` (denied to agent — manual user action) ships in minutes. To roll back:

1. `eas update:list --branch production` — find the last-known-good update group.
2. `eas update:republish --group <id>` — republishes that group as the latest. (Manual.)

If the bug is bad enough to warrant pulling the app: App Store Connect → Pricing and Availability → "Remove from Sale" while you fix.

## 4. Code-level destructive patterns

`.claude/settings.json` blocks Bash commands but cannot block code edits. The patterns below are blast-radius equivalent to running a destructive CLI, except they run inside the user's app on every device. The agent must NOT write any of these into production code paths without an explicit user request and a `__DEV__` gate.

| Pattern | Why dangerous |
|---------|--------------|
| `AsyncStorage.clear()` | Wipes every key for the app — vault, onboarding flag, prompt dismissals, scan saves. No remote backup. |
| `AsyncStorage.removeItem('tv_inv')` | Wipes the user's entire vault. Same outcome as a backend DROP TABLE for a no-backend app. |
| `AsyncStorage.multiRemove([...keys])` | Same as above when keys include `tv_inv` or any persisted state. |
| `FileSystem.deleteAsync(uri, ...)` on a directory | Cascading delete; can wipe scan photos / cached state. |
| Bulk `setInventory([])` | Functional equivalent of clearing — persists `[]` to storage on next tick. |
| Direct `fetch()` to a destructive cloud endpoint from app code | The Cursor incident, ported into the bundle. Same outcome, different attack surface. |

**Rules for the agent:**

1. Never write any of the above outside of a path gated by `if (__DEV__) { ... }` AND only when the user has explicitly asked for a debug-clear feature.
2. Never wire a destructive call into a UI affordance the user could tap by accident (e.g. a profile-screen "Reset" button without a typed-confirmation modal).
3. When refactoring `InventoryContext.tsx` or `sanitizeSnapshot`, treat the rehydration path as load-bearing — a refactor that drops a field silently corrupts every user's vault on next launch (this has happened twice already with `redFlags` and `authFlags`; see CLAUDE.md session notes).
4. When a user-visible "delete" action exists, it must operate on a single item by id — never on the collection.

## 5. Backup discipline

| Asset | Where | Cadence |
|-------|-------|---------|
| Code | GitHub `origin/main` | Push at minimum daily during active dev; before any irreversible op |
| `.env` | 1Password (or equivalent) | On every key add/rotate |
| App Store Connect product config | Screenshots → `C:\Users\Chris\Downloads\ThriftVault\ThriftVault_LLC\` | Every product/price change |
| RevenueCat dashboard config | Screenshots same location | Every entitlement/offering change |
| Apple Developer identifiers (D-U-N-S 145002422, team ID, bundle ID `com.thriftvault.app`) | Stable doc next to LLC paperwork | Once at enrollment, then on any change |

## 6. API key rotation runbook

If any `EXPO_PUBLIC_*` key is exposed (leaked, abused, or rotated as policy):

1. **Create new key** in the respective console. Scope it (Gemini → iOS bundle ID `com.thriftvault.app`).
2. **Update `.env`** locally and `eas secret:create --scope project --name <KEY> --value <new>` for production.
3. **Push the new bundle**: `eas update --branch production --message "rotate <KEY>"` — manual, denied to agent.
4. **Revoke old key** in the console after the OTA update has propagated (~24h to be safe — users with backgrounded apps may not have updated yet).
5. **Log the rotation** in `CLAUDE.md` under the current session notes (date, which key, why).

## 7. When NOT to defer to the agent

These operations remain manual user actions, regardless of how mundane they seem:

- App Store Connect submissions of any kind
- OTA updates to the production branch
- `npx expo prebuild` (one-way door)
- Force pushes
- Hard resets
- Cloud-CLI write commands (gcloud, aws, fastlane, railway, etc.)
- Database CLIs (psql, mysql, mongo*, redis-cli, sqlite3) — even read-only-looking sessions can run destructive SQL
- Migration tools' destructive variants (prisma migrate reset, db push --force-reset, sequelize db:drop / undo:all, knex rollback --all, drizzle-kit drop, typeorm schema:drop)
- Inline Node script execution (`node -e`, `node --eval`, `node -p`) — Cursor-incident bypass vector
- Apple Developer / RevenueCat dashboard changes (these are web UI anyway, but if a CLI ever exists, treat as denied)
- Granting any new MCP server cloud-write authority without first reviewing the permission scope

The agent treats `.claude/settings.json` as load-bearing. The fence is real, not decoration.

## 8. Reading order for the agent

When the agent starts work that touches:
- Deployment, release, build infra
- Apple Developer / App Store Connect
- RevenueCat, Sentry, EAS
- Anything in `.env` or EAS Secrets
- API keys or rate limits
- Any database, ORM, schema, or migration file (Prisma, Drizzle, Knex, Sequelize, TypeORM, raw SQL)
- `InventoryContext.tsx`, `sanitizeSnapshot`, or any AsyncStorage write site

→ Read this file first. If a planned action isn't covered here, surface the question to the user before acting.
