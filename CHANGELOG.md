# Changelog

All notable changes to EZMON will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
