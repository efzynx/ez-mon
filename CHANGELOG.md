# Changelog

All notable changes to EZMON will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.3] - 2026-05-09

### Fixed
- **Agent recovery double notification**: Agent `online` recovery events are dispatched from the Next.js heartbeat API via `lib/notify.ts`. This function was missing `targetType` filtering, causing monitor-only channels to receive agent recovery notifications. Added `sourceType` parameter (`"agent" | "monitor"`, defaults to `"agent"`) and `targetType` filter logic to `dispatchNotification()` — mirroring the Cloudflare Worker's behavior.
- **`config_json` JSONB read as string**: The Cloudflare Worker uses a raw HTTP request to the Neon `/sql` endpoint. This endpoint returns `JSONB` columns as plain strings, not parsed JavaScript objects. As a result, `ch.config_json?.targetType` was always `undefined` (falling back to `"all"`), bypassing the agent/monitor filter entirely. Fixed by wrapping all `config_json` access with `JSON.parse()` guard in `dispatchNotifications()`.
- **Worker beta deploy silently targeting production**: `pnpm --filter @ezmon/worker run deploy -- --env beta` caused pnpm to pass `"--"` as a literal string argument to wrangler instead of a separator, so `--env beta` was never received. Added explicit `deploy:beta` script (`wrangler deploy --env beta`) to `apps/worker/package.json` to avoid the quoting issue.

---

## [0.1.3-beta.3] - 2026-05-09


### Added
- **Notification Target Type**: Alert channels now support a `targetType` field (`all` | `agent` | `monitor`). Users can configure each channel to only receive alerts from Agents, Cloud Monitors, or both — eliminating duplicate cross-source notifications.
- **Target Type UI**: Added a three-option selector ("🌐 All", "💻 Agents", "☁️ Monitors") to the Add/Edit Channel modal in Dashboard Settings → Alert Channels. The channel list card now displays the configured target alongside the channel type.
- **Worker `/debug` Monitor Info**: The `/debug` endpoint now includes `cloud_monitors` section showing `last_status`, `next_check_at`, `due_now`, and `time_until_check` for all monitors — useful for local development diagnostics.
- **Worker `/reset-monitors` Endpoint**: New `POST /reset-monitors` development endpoint that resets all active monitors' `next_check_at` to `NOW()` and `last_status` to `unknown`, forcing them to be evaluated on the next `/trigger` call.

### Fixed
- **Monitor notifications never firing**: Cloud monitor down/up transitions were silently skipped because the `last_status` column in the database was already `down` (set by previous runs or the "Check Now" UI button). The Cloudflare Worker's `isTransition` logic now also accepts `unknown → down` as a valid trigger, and the "Check Now" button no longer overwrites `lastStatus` or `nextCheckAt` in the database so the Worker remains the single source of truth for state transitions.
- **Duplicate notifications for all channels**: The Cloudflare Worker's `dispatchNotifications` function previously broadcast to every enabled channel regardless of source type. It now filters channels by `config_json.targetType` matching the `sourceType` (`"agent"` or `"monitor"`) of the triggering event.
- **Monitor incidents failing silently**: The `incidents` table had a `NOT NULL` constraint on `agent_id`, causing cloud monitor incidents to fail at the DB layer (no agent ID to reference). `agent_id` is now nullable and a `metadata` JSONB column has been added to store monitor context (`monitor_id`, `monitor_name`, `url`).
- **`DashboardIncident` type mismatch**: The `incidents` GET route was using `innerJoin` to agents, which excluded monitor incidents (no `agent_id`). Changed to `leftJoin` and updated the `DashboardIncident` shared type to allow `agentId: string | null` and `agentName: string | null`.
- **Status page type error**: The `/status/[slug]` page was passing a potentially `null` `agentId` to `Set.has()`, causing a TypeScript error. Fixed with a null guard.
- **Worker `this.scheduled` binding error**: The `export default {}` pattern in the Cloudflare Worker caused silent failures when `/trigger` called `this.scheduled()` due to `this` context loss in ES Modules. Refactored to an explicit `const worker = { ... }` variable with `export default worker` so `worker.scheduled()` resolves correctly.
- **`fetch failed` ETIMEDOUT on Telegram API from local dev**: Node.js v17+ performs dual-stack (IPv4 + IPv6) DNS resolution in parallel. If IPv6 times out, it throws `AggregateError: ETIMEDOUT`, preventing outbound notifications. Fixed by adding `NODE_OPTIONS=--dns-result-order=ipv4first` to `apps/web/.env.local`.

### Changed
- `Check Now` button in Cloud Monitors UI no longer updates `lastStatus` or `nextCheckAt` on the monitor record. It only records a new row in `cloud_check_results` for the history graph. This ensures the Cloudflare Worker remains the sole owner of state transition detection and notification dispatch.

---

## [0.1.3-beta.2] - 2026-05-08


### Added
- **Custom Status Page Slug**: Added `custom_slug` column to `status_pages` table and enabled users to configure custom URLs (e.g., `/status/my-server`) from the Dashboard Settings.
- **Cloud Monitors on Status Page**: The Public Status Page now explicitly queries and displays Cloud Monitors (HTTP/TLS/Keyword) alongside standard Agents, including latency information.
- **Beta Worker Environment**: Configured `[env.beta]` inside `apps/worker/wrangler.toml` to support separate deployment and secrets for the beta environment (`ezmon-evaluator-beta`).

---

## [0.1.3-beta.1] - 2026-05-08

### Fixed
- Custom `customOnlineMessage` template not applying on agent recovery. Root cause: `lib/notify.ts` (called by Next.js heartbeat API on recovery) was missing template parsing logic, unlike the Cloudflare Worker which had it correctly. Online notifications always fell back to the hardcoded default message.
- Zod config schemas (`telegramConfigSchema`, `discordConfigSchema`, `webhookConfigSchema`) were stripping unknown fields, causing `customOfflineMessage` and `customOnlineMessage` to be silently discarded during `POST /api/dashboard/notifications`. Fixed by adding `.passthrough()` to all three schemas.

### Added
- **Notification Test Buttons**: Added "Test Offline" and "Test Online" buttons to the Add/Edit Channel modal. Sends a dummy notification with the currently typed template (including placeholder resolution) without needing to cycle the real agent state.
- **Test API Endpoint**: Created `POST /api/dashboard/notifications/test` to handle dummy notification dispatch for template preview.
- `dispatchNotification()` in `lib/notify.ts` now accepts optional `templateVars` and resolves `{project}`, `{agent}`, `{monitor}`, `{status}`, `{time}` placeholders — matching the Cloudflare Worker behavior.

### Changed
- Test endpoint uses distinct dummy values: `{agent}` → `test-agent-1`, `{monitor}` → `test-monitor-1` so both placeholder types can be verified independently in a single test.
- Heartbeat recovery handler now passes `templateVars` when dispatching online recovery notifications.

---

## [0.1.2] - 2026-05-07

### Added
- **Cloud Monitors**: Added HTTP/TLS/Keyword cloud monitoring capability so users can monitor external URLs for uptime, SSL certificate health, and keyword presence — without requiring an agent.
- **Global Agent Distribution Map**: Added an interactive global map (`GlobalAgentMap`) to the Dashboard Overview that highlights countries with active agents and displays an agent summary tooltip on hover.
- **Public Status Page**: Added a customizable public status page with themes, descriptions, and manual agent visibility toggling.
- **Docker Collector**: The Go Agent now collects the count of running Docker containers using `os/exec` to run `docker ps -q`.
- **Global Agent Tags**: Implemented a "Tag-First" architecture centrally managed from the Dashboard Settings. Tags can be bulk-assigned to multiple agents simultaneously.
- **Cascading Tag Deletion**: Deleting a project-level tag automatically unassigns it from all associated agents.
- **Onboarding Empty State**: Replaced the "No agents yet" screen on the Dashboard Overview with an interactive, huge Call-To-Action that directly opens the installation command modal.
- Added `cloud_monitors` and `cloud_check_results` tables in the database with appropriate indexes.
- Implemented `runHttpCheck`, `runTlsCheck`, and `runKeywordCheck` in the Cloudflare Worker to process checks in parallel.
- Versioned agent binary names in GitHub Releases: `ezmon-agent-linux-amd64-v{version}` and `ezmon-agent-linux-arm64-v{version}`.

### Changed
- Dashboard Overview now integrates Cloud Monitors statistics (Total, Online, Offline) alongside Agent nodes.
- Refactored Cloud Monitors UI latency chart to use `AreaChart` with vibrant glassmorphism gradients for better visibility in Dark Mode.
- All monitor events (up/down) now automatically generate incidents and dispatch notifications via existing alert channels.
- Dashboard Overview, Agent List, and Agent Detail UI now display the number of running Docker containers if applicable.
- `InstallModal` was extracted to a shared global component for usage across multiple dashboard routes.
- `Alert Channels` configuration (Telegram, Discord, Webhook) was moved to a dedicated tab inside the unified Settings page.
- Swapped `Status Page` and `Settings` positions in the sidebar navigation to align with standard UI hierarchy.
- Agent `Version` variable changed from `const` to `var` to allow linker injection via `-ldflags="-X main.Version=x.y.z"` at build time.
- Agent `Version` default fallback changed from a hardcoded version string to `"dev"`.
- Delete agent modal text and `latest` release description translated from Indonesian to English.
- `install.sh` registration call now reads from `EZMON_AGENT_VERSION` env var (defaults to current release version).

### Fixed
- Infinite loading bug on `/dashboard/status-page` configuration view by correctly fetching projects on mount.
- TypeScript errors in the status page by replacing `sonner` toast with local state management.
- Sidebar version badge showing stale version — now reads dynamically from `apps/web/package.json`.
- Agent binary in GitHub Releases had no version in the filename.
- Hardcoded `"0.1.0"` version string in `install.sh` curl registration payload.

---

## [0.1.1-beta.1] - 2026-05-07

### Added
- Granular per-core CPU charts (dynamic, supports 64+ cores via HSL color generator)
- IP-based agent geolocation via ipify.org + ip-api.com
- Interactive world map with zoom/pan, country hover tooltip, and agent location pin
- Extended time range selector: 5m, 10m, 30m, 1h, custom (min 5m, max 7d)
- Automated release workflow: single `release.yml` handles tag creation, agent build, and GitHub Release publication
- `CHANGELOG.md` and `DEVELOPMENT.md` added to project

### Changed
- CPU collection switched to blocking per-core call for accurate real-time data
- Heartbeat payload includes `publicIp` field
- `cpuCoresAvg` stored as JSON array in `metric_buckets`
- Release workflow unified: `agent-release.yml` removed, replaced by `release.yml`

### Fixed
- Map tooltip showing "Unknown (undefined)" for territories without geo ID
- Tooltip position clipped at top/right edge of map
- Missing ISO numeric codes for Serbia, Montenegro, Iceland, South Sudan, Oman, and others

---

## [0.1.1] - 2026-05-07

### Added
- **Granular CPU Monitoring**: Per-core CPU charts now render dynamically based on actual agent hardware. Supports up to 64+ cores using HSL color generation (no hardcoded limit).
- **IP-based Agent Geolocation**: Agent automatically detects its public IP via `ipify.org` and sends it with each heartbeat. Backend resolves location (city, country, lat/lon) via `ip-api.com`.
- **Interactive World Map**: New `AgentLocationMap` component with:
  - Country name tooltip on hover (smart position flip near edges)
  - Zoom & pan support (scroll wheel, drag, +/−/reset buttons)
  - Zoom level badge
  - Animated agent location pin
  - Full ISO 3166-1 numeric → alpha-2 mapping (220+ countries) via `Intl.DisplayNames`
- **Extended Time Range Selector**: Metric charts now support 5m, 10m, 30m, 1h, and custom range (min 5m, max 7d).
- **Automated Release Workflow**: Single GitHub Actions workflow that auto-tags, builds agent binaries, and publishes versioned releases (stable vs beta) on every push to `main`.

### Changed
- Agent CPU collection switched from non-blocking to blocking `cpu.Percent(1s, true)` for accurate per-core real-time data.
- Heartbeat payload now includes `publicIp` field.
- `cpuCoresAvg` persisted as JSON array in `metric_buckets` for frontend parsing.
- Replaced `agent-release.yml` with unified `release.yml` workflow.

### Fixed
- Country map hover showing "Unknown (undefined)" for territories without geo ID.
- Country hover tooltip clipped at top of map — now flips below cursor when near top edge.
- Tooltip clipped at right edge — now clamped to container width.
- Missing countries in ISO numeric map: Serbia (688), Montenegro (499), Iceland (352), Antarctica (010), South Sudan (728), Western Sahara (732), Oman (512), French Southern Territories (260), and others.

---

## [0.1.0] - 2026-05-04

### Added
- Initial MVP release.
- Authentication with NextAuth.
- Project management (create, select project).
- Agent onboarding with install script.
- Push-based heartbeat monitoring.
- Offline detection via `offline_deadline_at` deadline formula.
- Incident creation on state transitions (online → offline, offline → online).
- Basic notification channel support.
- Host metrics: CPU, RAM, disk, network, load average.
- Public status page (per project).
- Cloudflare Workers Cron evaluator for global heartbeat checks.
- Dashboard overview with online/offline/incident summary.
- Agent detail page with metric charts.
- Dark mode UI with Deep Dark theme.
- Static Go agent binaries (amd64, arm64) via GitHub Releases.
