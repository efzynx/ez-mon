<div align="center">
  <h1>EZMON</h1>
  <p><strong>Lightweight, self-hostable server monitoring with push-based agents</strong></p>
  <p>
    <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fefzynx%2Fez-mon&env=DATABASE_URL,CRON_SECRET,NEXTAUTH_SECRET,NEXTAUTH_URL&envDescription=Neon%20Postgres%20DATABASE_URL%2C%20CRON_SECRET%20for%20evaluator%2C%20and%20NextAuth%20secrets&project-name=ezmon-hub&repository-name=ezmon">
      <img src="https://vercel.com/button" alt="Deploy with Vercel"/>
    </a>
  </p>
  <p>
    <a href="#features">Features</a> ·
    <a href="#architecture">Architecture</a> ·
    <a href="#getting-started">Getting Started</a> ·
    <a href="#agent-installation">Agent Installation</a> ·
    <a href="#deploy-hub">Deploy Hub</a> ·
    <a href="#cron-evaluator-setup">Cron Evaluator</a> ·
    <a href="#license">License</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="License" />
    <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js" />
    <img src="https://img.shields.io/badge/Go-agent-00ADD8" alt="Go" />
    <img src="https://img.shields.io/badge/Vercel-Deploy-black" alt="Vercel" />
  </p>
</div>

---

## What is EZMON?

EZMON is an open-source server monitoring platform. A lightweight Go agent runs on your servers, pushing heartbeats and metrics to a hosted dashboard — no inbound ports required on your side.

- **Dashboard (Hub)** — Next.js web app (deploy on Vercel or self-host)
- **Agent** — Single Go binary, runs as a systemd service
- **Database** — Neon Serverless Postgres
- **Evaluator** — Next.js internal endpoint `/api/internal/evaluate` (triggered via cron-job.org / Upstash QStash / Workers)

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
                                                        │ Evaluator (/api/internal/eval) │
                                                        │ Triggered via cron-job.org    │
                                                        │ - detect offline agents       │
                                                        │ - dispatch notifications       │
                                                        └───────────────────────────────┘
```

**Key design decisions:**
- Hub is **stateless** — all state lives in Neon Postgres
- Agents use **push heartbeat** — no inbound ports needed on monitored servers
- Offline detection uses **deadline timestamps**, not polling from hub to agents
- One **global evaluator** runs periodically — no per-agent schedulers

---

## Deploy Hub

### Option 1: One-Click Vercel Deploy (Recommended)

Click the button below to clone EZMON and deploy your Hub directly to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fefzynx%2Fez-mon&env=DATABASE_URL,CRON_SECRET,NEXTAUTH_SECRET,NEXTAUTH_URL&envDescription=Neon%20Postgres%20DATABASE_URL%2C%20CRON_SECRET%20for%20evaluator%2C%20and%20NextAuth%20secrets&project-name=ezmon-hub&repository-name=ezmon)

#### Required Environment Variables:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Neon Serverless Postgres Connection String | `postgresql://user:pass@ep-xyz.neon.tech/ezmon?sslmode=require` |
| `CRON_SECRET` | Secret token for securing `/api/internal/evaluate` | `random_secret_string_here` |
| `NEXTAUTH_SECRET` | NextAuth session encryption secret | `random_32_character_key` |
| `NEXTAUTH_URL` | Production Hub URL | `https://your-ezmon-hub.vercel.app` |

---

### Option 2: Self-Host via Git Clone

1. **Clone & Install Dependencies:**

   ```bash
   git clone https://github.com/efzynx/ez-mon.git
   cd ez-mon
   npm install
   ```

2. **Configure Environment (`apps/web/.env.local`):**

   ```env
   DATABASE_URL=postgresql://...
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-random-secret
   CRON_SECRET=your-cron-secret
   ```

3. **Push Database Schema:**

   ```bash
   npm --prefix packages/db run db:push
   ```

4. **Run Development or Production Server:**

   ```bash
   # Development
   npm --prefix apps/web run dev

   # Production Build
   npm --prefix apps/web run build && npm --prefix apps/web run start
   ```

---

## Setting Up Periodic Evaluator (cron-job.org)

To enable automatic host offline detection and alert notifications, configure a free periodic HTTP trigger on [cron-job.org](https://cron-job.org):

1. Sign up for a free account at [cron-job.org](https://cron-job.org).
2. Click **Create Cronjob**.
3. Fill in the job details:
   - **Title**: `EZMON Offline Evaluator`
   - **Address**: `https://<YOUR-HUB-DOMAIN>/api/internal/evaluate`
   - **Schedule**: Every 1 minute (`* * * * *`)
4. Go to **Advanced Settings**:
   - **Request Method**: Select `POST`
   - **HTTP Headers**: Add header:
     - Header Name: `Authorization`
     - Header Value: `Bearer <CRON_SECRET>`
5. Click **Create** to save.

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
