# Changelog

All notable changes to EZMON will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
-

### Changed
-

### Fixed
-

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
