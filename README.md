<div align="center">
  <h1>EZMON</h1>
  <p><strong>Lightweight, self-hostable server monitoring with push-based agents</strong></p>
  <p>
    <a href="#features">Features</a> ·
    <a href="#architecture">Architecture</a> ·
    <a href="#getting-started">Getting Started</a> ·
    <a href="#agent-installation">Agent Installation</a> ·
    <a href="#self-hosting">Self-Hosting</a> ·
    <a href="#license">License</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="License" />
    <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js" />
    <img src="https://img.shields.io/badge/Go-agent-00ADD8" alt="Go" />
    <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020" alt="Cloudflare" />
  </p>
</div>

---

## What is EZMON?

EZMON is an open-source server monitoring platform. A lightweight Go agent runs on your servers, pushing heartbeats and metrics to a hosted dashboard — no inbound ports required on your side.

- **Dashboard** — Next.js web app (deploy on Vercel)
- **Agent** — Single Go binary, runs as a systemd service
- **Database** — Neon Serverless Postgres
- **Evaluator** — Cloudflare Workers Cron (offline detection, notifications)

---

## Features

- 🟢 **Real-time status** — Online/offline detection with deadline-based logic
- 📊 **Host metrics** — CPU, memory, disk, network
- 🔔 **Notifications** — Telegram, Discord, and generic webhooks
- 🎛️ **Configurable alerts** — Choose to notify on offline, recovery, or both
- 🛡️ **Anti-spam** — One open incident per condition, cooldown logic
- 🌐 **Public status page** — Share uptime with your users
- 🔑 **Multi-project** — Manage multiple environments from one dashboard
- 📦 **Self-hostable** — Own your data, own your infrastructure

---

## Architecture

```
┌─────────────────────────┐     push heartbeat/metrics      ┌────────────────────┐
│  Go Agent (your server) │ ──────────────────────────────► │  Hub (Vercel/Next) │
└─────────────────────────┘                                  └─────────┬──────────┘
                                                                        │
                                                             Neon Postgres (state)
                                                                        │
                                                        ┌───────────────▼───────────────┐
                                                        │  Evaluator (Cloudflare Worker) │
                                                        │  cron: every 1 minute          │
                                                        │  - detect offline agents        │
                                                        │  - dispatch notifications        │
                                                        └───────────────────────────────┘
```

**Key design decisions:**
- Hub is **stateless** — all state lives in Neon Postgres
- Agents use **push heartbeat** — no inbound ports needed on monitored servers
- Offline detection uses **deadline timestamps**, not polling from hub to agents
- One **global evaluator** runs periodically — no per-agent schedulers

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Go ≥ 1.21 (for agent development)
- [Neon](https://neon.tech) account (free tier works)
- [Cloudflare](https://cloudflare.com) account (for Workers)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/ezmon.git
cd ezmon
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Neon Postgres
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# OAuth (GitHub)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

For the Cloudflare Worker, create `apps/worker/.dev.vars`:

```env
DATABASE_URL=postgresql://...
```

### 3. Push Database Schema

```bash
pnpm db:push
```

### 4. Run Development Server

```bash
pnpm dev
```

- Web dashboard: http://localhost:3000
- Worker evaluator: http://localhost:8787

---

## Agent Installation

On any Linux server you want to monitor:

```bash
curl -fsSL https://your-hub.vercel.app/install.sh | EZMON_TOKEN=<project-token> sudo sh
```

The installer will:
1. Detect system architecture (amd64 / arm64)
2. Download or build the agent binary
3. Install to `/usr/local/bin/ezmon-agent`
4. Create `/etc/ezmon/agent.env` with credentials
5. Register and start a `systemd` service

### Uninstall

```bash
sudo systemctl stop ezmon-agent && sudo systemctl disable ezmon-agent
sudo rm -f /usr/local/bin/ezmon-agent
sudo rm -f /etc/systemd/system/ezmon-agent.service
sudo systemctl daemon-reload
sudo rm -f /etc/ezmon/agent.env
```

---

## Self-Hosting

### Deploy Hub (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from web app
cd apps/web
vercel --prod
```

Set the following environment variables in your Vercel project:
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

### Deploy Evaluator (Cloudflare Workers)

```bash
cd apps/worker
pnpm wrangler secret put DATABASE_URL
pnpm wrangler deploy
```

The worker cron (`* * * * *`) will automatically run the offline evaluator every minute.

---

## Project Structure

```
ezmon/
├── apps/
│   ├── web/          # Next.js dashboard (hub)
│   ├── worker/       # Cloudflare Worker evaluator
│   └── agent/        # Go monitoring agent
├── packages/
│   ├── db/           # Drizzle ORM schema & migrations
│   ├── shared/       # Shared types, validators, constants
│   └── ui/           # Shared UI components
└── .env.example      # Environment variable template
```

---

## Configuration

### Agent Environment (`/etc/ezmon/agent.env`)

| Variable | Default | Description |
|---|---|---|
| `EZMON_TOKEN` | — | Agent authentication token |
| `EZMON_HUB_URL` | — | Hub URL (e.g. `https://your-hub.vercel.app`) |
| `EZMON_AGENT_ID` | — | Agent UUID assigned at registration |
| `EZMON_HEARTBEAT_INTERVAL` | `30` | Heartbeat frequency in seconds |
| `EZMON_METRICS_INTERVAL` | `60` | Metrics push frequency in seconds |

### Offline Detection

```
offline_deadline_at = last_seen_at + heartbeat_interval × grace_multiplier (3×)
```

Default: agent is considered offline **90 seconds** after the last heartbeat.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## License

EZMON is licensed under the [GNU General Public License v3.0](LICENSE).

You are free to use, modify, and distribute this software under the terms of the GPL-3.0. Any distributed modifications must also be released under GPL-3.0.
