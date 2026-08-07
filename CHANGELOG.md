# Changelog

All notable changes to EZMON will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## v0.1.14 — 2026-08-07

### Improved
- **Specific Version Tag Download Priority** — Enhanced `install.sh` to prioritize downloading agent binaries directly from versioned release tag URLs (`/releases/download/v0.1.14/...`) before falling back to the rolling `latest` URL, avoiding GitHub CDN caching delays during release workflow runs.

---

## v0.1.13 — 2026-08-07

### Added
- **Instant Update Auto-Detection** — Enhanced `UpdateAgentModal` polling to 2.5s interval and added instant auto-detection triggered when `targetAgent.lastSeenAt > modalOpenedAt` or when agent version matches `latestVersion`.

### Fixed
- **Clean Systemd Service Stop & Restart** — Updated `install.sh` to explicitly stop existing `ezmon-agent` service (`sudo systemctl stop ezmon-agent`) before replacing the binary in `/usr/local/bin/ezmon-agent`.
- **Force Systemd Daemon Reload & Restart** — Added explicit `sudo systemctl daemon-reload && sudo systemctl enable ezmon-agent && sudo systemctl restart ezmon-agent` step to terminate old agent processes in memory and launch the new binary process immediately.

---

## v0.1.12 — 2026-08-07

### Added
- **Update Modal Auto-Detection Polling** — Integrated background polling to `UpdateAgentModal` checking `/api/dashboard/overview` and displaying a green success banner upon version match, auto-closing the dialog.

### Fixed
- **Preserved Custom Agent Name** — Updated `register/route.ts` to preserve custom edited agent names upon re-registration or update instead of overwriting with default hostname.
- **Fixed False Offline/Unknown Status** — Initialized `status: "online"`, `lastSeenAt: now`, and `offlineDeadlineAt: initialDeadline` immediately upon agent registration/update in `register/route.ts`.
- **Enhanced Status Calculation** — Added fallback to `computeDerivedStatus` in `@ezmon/shared` returning `"online"` if `offlineDeadlineAt` is null but `lastSeenAt` is recent (< 5 minutes).

---

## v0.1.11 — 2026-08-07

### Added
- **Update Agent One-Time Token Card** — Integrated full One-Time Registration Token block (`reg_...`) with 5-minute countdown timer, 1-click Copy button, and refresh button inside `UpdateAgentModal`.
- **Terminal Prompt Guidance** — Added explicit UI instructions in `UpdateAgentModal` guiding users to paste their One-Time Token when prompted by `install.sh` in their SSH terminal.

### Fixed
- **Countdown Timer Smooth Ticking** — Refactored timer interval logic in `InstallModal` & `UpdateAgentModal` to recalculate remaining seconds immediately on mount and tick down smoothly every second without freezing at 05:00.
- **Agent Detail Project ID Prop** — Passed `agent.projectId` to `UpdateAgentModal` enabling authorized temporary token generation during agent upgrades.

---

## v0.1.10 — 2026-08-07

### Added
- **Agent Outdated Version Detection** — Introduced automatic agent vs hub version comparison logic across dashboard views.
- **Update Agent Modal Component** — Created `UpdateAgentModal` UI displaying installed version vs latest hub version (`v0.1.10`), 1-click update command snippet, and in-place upgrade guidance.
- **Update Agent Toolbar & Badges** — Added an "Update Agent" button in the Agent Detail toolbar and "Update Available" badges on both detail and table views for outdated nodes.

### Fixed
- **Registration Token UI Fallback** — Added `regToken || projectId` fallback logic in `InstallModal` to guarantee token containers never render empty.
- **Database Schema Execution** — Applied PostgreSQL migration creating `agent_registration_tokens` table and indexes.
- **Local Source Build Version Injection** — Injected `-ldflags="-w -s -X main.Version=${BUILD_VERSION}"` into `install.sh` when building agent binaries locally from source.

---

## v0.1.9 — 2026-08-07

### Security
- **One-Time Agent Registration Tokens (5-minute TTL)** — Introduced single-use temporary onboarding tokens (`reg_...`) with a 5-minute time-to-live to eliminate project token exposure and token replay attacks.
- **SHA-256 Checksum Verification** — Added SHA-256 binary hash verification in `install.sh` prior to binary execution, protecting hosts against corrupted or tampered binary downloads.
- **Automated SHA-256 Release Pipeline** — Updated GitHub Release workflow (`release.yml`) to automatically generate and attach `.sha256` checksum files for all platform binaries.

### Added
- **Registration Tokens Database Table** — Created `agent_registration_tokens` table in `@ezmon/db` storing `token`, `expiresAt`, `usedAt`, and `projectId`.
- **Registration Token API Endpoint** — Implemented `POST /api/dashboard/projects/reg-token` route for authenticated temporary token generation.

### Changed
- **Streamlined Install Modal UI** — Redesigned `InstallModal` component to remove Direct Mode and verbose text, presenting a clean 5-minute countdown timer (MM:SS), One-Time Token display, 1-click Copy, and Token Refresh button.

---

## v0.1.8 — 2026-08-07

### Added
- **Security Validation Test Suite** — Integrated 14 Vitest unit tests in `@ezmon/shared` covering Zod input boundaries against SQL/NoSQL injection, SSRF, XSS, and metric buffer overflows.
- **Install Script Integration Testing** — Created `install-security.test.sh` integration test script to verify POSIX `sh` syntax and interactive prompt execution paths.

### Security
- **Interactive Token Prompt in `install.sh`** — Refactored agent installation script to interactively prompt for `EZMON_TOKEN` via `/dev/tty` when not provided as an environment variable, preventing sensitive project tokens from being leaked in shell command history (`.bash_history`).

### Changed
- **Dual-Mode Installation Selector UI** — Updated `InstallModal` component to provide a toggle between **Interactive (Secure)** mode (recommended for home labs and shared terminals) and **Direct (One-liner)** mode.
- **TypeScript Workspace Definitions** — Added `@types/node` dependency and configuration to `@ezmon/db` for strict `process.env` type checking.

---

## v0.1.7 — 2026-07-24

### Added
- **Dedicated Public Status API Endpoint** — Added `GET /api/public/status/[slug]` returning JSON representation of published status pages with CORS support for third-party websites and integrations.

### Fixed
- **Public API Auth Bypass** — Added `/api/public` to middleware (`proxy.ts`) public route bypass and matcher exclusions so unauthenticated requests to `/api/public/status/[slug]` are served directly without redirecting to `/login`.
- **Agent Detail Loading Error** — Fixed "Agent not found" error in new workspaces/projects by reading active project ID from localStorage instead of hardcoding index 0.
- **Metrics Ingestion HTTP 500 Error** — Fixed HTTP 500 error when using Supabase/pgBouncer transaction poolers by refactoring PostgreSQL shorthand casts (`::json` and `::jsonb`) to standard ANSI SQL casts (`cast(... as json)` and `cast(... as jsonb)`).
- **Metrics Ingestion Date Crash** — Fixed `TypeError: Received an instance of Date` by converting `bucketStart` Date object to ISO string representation before database query.
- **Cloudflare Worker Subrequests Limit** — Replaced `postgres-js` TCP driver in Worker with HTTP proxy approach (`POST /api/internal/query`), reducing subrequests to 1 per query and eliminating the 'Too many subrequests' error.

---

## v0.1.6 — 2026-07-10

### Changed
- **Database Driver Migration** — Migrated database driver from `@neondatabase/serverless` (Neon-only HTTP) to `postgres` (`postgres-js`) across the monorepo, enabling connection to any PostgreSQL provider (e.g. Supabase, Neon, RDS, or local VM).
- **Transaction Pooler Compatibility** — Configured database connections with `prepare: false` by default, preventing prepared statement conflicts when using connection poolers like PgBouncer or Supabase Transaction Pooler.
- **Cloudflare Worker Database TCP Support** — Upgraded the Worker evaluator database query engine from Neon HTTP `/sql` REST endpoint to direct TCP/SSL connection via `postgres-js`, enabled by adding `nodejs_compat` flag to `wrangler.toml` and handling TS query parameter type-casting.

---

## v0.1.5 — 2026-05-17

### Added
- **`alert_events` Retention Cleanup** — Worker cron now deletes `alert_events` records older than 7 days (STEP 6), preventing unbounded table growth while retaining sufficient history for notification delivery debugging

### Fixed
- **Double Discord notification for cloud monitors** — Added `sentDiscordUrls` Set in `dispatchNotifications()` to deduplicate webhook URLs within a single dispatch loop; prevents two sends when multiple channels share the same webhook URL
- **Race condition in cloud monitor state detection** — `UPDATE cloud_monitors` now uses atomic `RETURNING` to derive `prevStatus` from the database at update time, eliminating duplicate transition detections from overlapping cron runs
- **Incident page shows "Unknown" for cloud monitor incidents** — Incidents from cloud monitors now display `metadata.monitor_name` as the incident title, with `metadata.url` shown as a clickable external link and a "Cloud Monitor" badge for visual distinction from agent incidents
- **Agent installer script in Indonesian** — All user-facing messages in `apps/web/public/install.sh` translated to English (info, ok, warn, fatal messages and inline comments)

### Changed
- Discord embed tip link updated from `discohook.org` to `discord-webhook.com` — no login required; JSON can be copied directly after preview
- `install.sh` updated: all Indonesian-language output messages replaced with English equivalents

## v0.1.5-beta.1 — 2026-05-17

### Added
- **Discord Rich Embed Support** — `sendDiscord()` now supports three modes: smart default embed (auto-generated with color, fields, and timestamp), JSON passthrough (user-defined Discord embed JSON sent directly), and plain text fallback
- **Template Engine: `deepReplaceVars()`** — Recursive variable replacement across all string values in nested JSON objects/arrays, enabling full embed customization without manual string building
- **Smart Default Discord Embed** — When no custom message is configured, EZMON auto-generates a rich embed with red/green color coding, project/status/time fields, and "EZMON Monitoring" footer
- **New Template Variables** — Added `{status_emoji}` (auto 🔴/🟢), `{url}` (monitor URL), `{latency}` (response latency ms), `{error}` (error message) for Discord and all channels
- **Discord JSON Embed UI** — Alert Channels form now shows a Discord-specific tip box (with link to discord-webhook.com), larger mono textarea (120px), JSON example in variable hints, and contextual monitor-only variable hints

### Fixed
- **Notification loop crash on Neon timeout** — `alert_events` INSERT in `dispatchNotifications()` was outside `try/catch`; a Neon transient timeout would crash the entire dispatch loop and skip remaining channels. Now wrapped in isolated `try/catch` so audit failure never blocks channel delivery
- **Discord inner catch swallowing send errors** — Discord JSON mode `catch` block was catching both `JSON.parse` errors and `sendDiscord` errors, causing double-send attempts on failure. Refactored to parse into variable first, send once, with outer `catch` handling send errors
- **Telegram `TypeError: fetch failed` from Next.js** — Node.js undici (Next.js native fetch) prefers IPv6 when resolving `api.telegram.org`, causing connection failure while wrangler (miniflare) successfully uses IPv4. Fixed by adding `NODE_OPTIONS='--dns-result-order=ipv4first'` to the web dev script
- **Missing `statusEmoji` in heartbeat `templateVars`** — `apps/web/src/app/api/agent/heartbeat/route.ts` was passing incomplete `templateVars` without `statusEmoji`, causing TypeScript errors after `TemplateVars` interface was updated

### Changed
- `sendDiscord()` signature changed from `message: string` to `message: string | object` in both worker and `notify.ts` to support object-based embed payloads
- `TemplateVars` interface promoted to exported type in `notify.ts` for reuse across heartbeat route and test endpoint
- `dispatchNotifications()` (worker) and `dispatchNotification()` (web) now fully in sync with identical Discord, Telegram, and Webhook dispatch logic
- Test endpoint (`/api/dashboard/notifications/test`) updated to use `deepReplaceVars` and `buildDefaultDiscordEmbed` with dummy monitor-specific fields

---

## v0.1.4 — 2026-05-11

### Changed
- **Landing Page Redesign** — Completely overhauled the public landing page with a modern, high-converting UI and professional English copywriting.
- **Minimalist Branding** — Implemented a clean "Green Dot Pulse" aesthetic in the navbar, replacing complex SVG logos to ensure 100% rendering stability across all browsers.
- **Unified Theme** — Synchronized the landing page color palette with the dashboard's `primary` green theme for a cohesive brand experience.
- **Global Navbar** — Added a sticky, blurred navbar featuring official documentation links (docs.ezmon.web.id) and GitHub repository access.
- **Visual Enhancements** — Integrated `framer-motion` animations, dynamic background gradients, and an interactive terminal installation preview.
- **Improved Copywriting** — Rewrote all public-facing text to be more professional, developer-focused, and exclusively in English.

---

## v0.1.3 — 2026-05-XX

### Added
- **Notification Target Type** — Alert channels now support a `targetType` field (`all` | `agent` | `monitor`) to eliminate duplicate cross-source notifications
- **Target Type UI** — Three-option selector ("🌐 All", "💻 Agents", "☁️ Monitors") in the Add/Edit Channel modal under Dashboard Settings → Alert Channels
- **Worker `/debug` Monitor Info** — The `/debug` endpoint now includes a `cloud_monitors` section with `last_status`, `next_check_at`, `due_now`, and `time_until_check`
- **Worker `/reset-monitors` Endpoint** — New `POST /reset-monitors` development endpoint to force re-evaluation of all monitors on the next trigger

### Fixed
- **Agent recovery double notification** — `lib/notify.ts` was missing `targetType` filtering; added `sourceType` parameter and filter logic to `dispatchNotification()`
- **`config_json` JSONB read as string** — Cloudflare Worker now wraps all `config_json` access with a `JSON.parse()` guard in `dispatchNotifications()`
- **Monitor notifications never firing** — `isTransition` logic now also accepts `unknown → down` as a valid state change trigger
- **Duplicate notifications for all channels** — `dispatchNotifications()` now filters by `config_json.targetType` matching the event `sourceType`
- **Monitor incidents failing silently** — `agent_id` is now nullable in the `incidents` table; a `metadata` JSONB column was added for monitor context
- **`DashboardIncident` type mismatch** — Changed `innerJoin` to `leftJoin` on agents; updated type to allow `agentId: string | null`
- **Worker beta deploy targeting production** — Added explicit `deploy:beta` script (`wrangler deploy --env beta`) to `apps/worker/package.json`

### Changed
- `Check Now` button no longer updates `lastStatus` or `nextCheckAt` — only records a new row in `cloud_check_results` for the history graph

---

## v0.1.2 — 2026-05-XX

### Added
- **Custom Status Page Slug** — Users can configure custom URLs (e.g. `/status/my-server`) from Dashboard Settings via a new `custom_slug` column in `status_pages`
- **Cloud Monitors on Status Page** — Public Status Page now displays Cloud Monitors (HTTP/TLS/Keyword) alongside Agents, including latency data
- **Beta Worker Environment** — `[env.beta]` configured in `apps/worker/wrangler.toml` for separate secrets and deployment (`ezmon-evaluator-beta`)
- **Notification Test Buttons** — "Test Offline" and "Test Online" buttons in the Add/Edit Channel modal for live template preview
- **Test API Endpoint** — `POST /api/dashboard/notifications/test` for dummy notification dispatch
- **Template Placeholder Resolution** — `dispatchNotification()` now resolves `{project}`, `{agent}`, `{monitor}`, `{status}`, `{time}` placeholders

### Fixed
- **`customOnlineMessage` not applying** — `lib/notify.ts` was missing template parsing logic on agent recovery; placeholder resolution now added
- **Zod schemas stripping unknown fields** — `customOfflineMessage` and `customOnlineMessage` were silently discarded; fixed by adding `.passthrough()` to all config schemas

### Changed
- Heartbeat recovery handler now passes `templateVars` when dispatching online recovery notifications
- Test endpoint uses distinct dummy values: `{agent}` → `test-agent-1`, `{monitor}` → `test-monitor-1`

---

## v0.1.1 — 2026-05-07

### Added
- **Cloud Monitors** — HTTP, TLS, and Keyword checks running on Cloudflare Worker Cron
- **Cloud check history** — Results stored 30 days with automatic retention cleanup
- **GlobalAgentMap** — Agent distribution map by country on the overview dashboard
- **Settings Hub** — Alert Channels and Cloud Monitors moved to a unified Settings page
- **Docker monitoring** — Agent reports running Docker container count
- **Tags & Grouping** — Agents can be tagged for grouping
- **Public Status Page** — Per-project configurable public status page
- **Metrics history charts** — CPU/RAM/Disk/Network charts from 5-minute aggregated buckets
- **GitHub Actions CI/CD** — Automated static Go binary builds for `linux/amd64` and `linux/arm64`
- **Incidents UI** — Filter open/resolved/all with pagination
- **targetType** — Notification channels can be scoped to: `agent`, `monitor`, or `all`

### Changed
- Agent metrics now use `gopsutil` (CPU, RAM, Disk, Load, Network) — no more placeholders
- Logo and branding updated
- Turborepo upgraded to v2.9.10
- `middleware.ts` replaced with `proxy.ts` convention (Next.js 16)
- Versioning synchronized between root `package.json`, UI, and agent binary
- Agent `Version` changed from `const` to `var` to allow linker injection via `-ldflags` at build time
- Delete agent modal text translated from Indonesian to English
- `install.sh` registration call now reads from `EZMON_AGENT_VERSION` env var

### Fixed
- **203/EXEC systemd error** — binary now compiled statically (`CGO_ENABLED=0`) via GitHub Actions
- Notification channels missing DELETE and PATCH toggle
- JSONB parsing issue in Neon HTTP SQL API (config fields read as strings)
- React import bug on notifications page
- GlobalProjectSwitcher not syncing in beta environment
- Sidebar version badge showing stale version — now reads dynamically from `apps/web/package.json`
- Agent binary in GitHub Releases had no version in the filename
- Infinite loading bug on `/dashboard/status-page` configuration view
- `forceMount` prop warning in sidebar layout

---

## v0.1.0 — 2026-05-04

### Added
- **Granular CPU Monitoring** — Per-core CPU charts render dynamically based on actual agent hardware. Supports 64+ cores using HSL color generation
- **IP-based Agent Geolocation** — Agent detects its public IP via `ipify.org` and resolves location (city, country, lat/lon) via `ip-api.com`
- **Interactive World Map** — `AgentLocationMap` component with zoom/pan, country hover tooltip, animated agent pin, and full ISO 3166-1 numeric mapping (220+ countries)
- **Extended Time Range Selector** — Metric charts support 5m, 10m, 30m, 1h, and custom range (min 5m, max 7d)
- **Automated Release Workflow** — Single GitHub Actions workflow that auto-tags, builds agent binaries, and publishes versioned releases
- **Initial MVP** — Authentication (NextAuth), Project management, Agent onboarding, Push-based heartbeat monitoring, Offline detection, Incident creation, Notification channels (Telegram, Discord, Webhook), Dashboard UI, and `install.sh` public installer script

### Changed
- Agent CPU collection switched from non-blocking to blocking `cpu.Percent(1s, true)` for accurate per-core real-time data
- Heartbeat payload now includes `publicIp` field
- `cpuCoresAvg` persisted as JSON array in `metric_buckets` for frontend parsing

### Fixed
- Country map hover showing "Unknown (undefined)" for territories without geo ID
- Country hover tooltip clipped at top/right edge of map
- Missing ISO numeric codes for Serbia, Montenegro, Iceland, South Sudan, Oman, and others
