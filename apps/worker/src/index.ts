/**
 * Tujuan: EZMON Global Evaluator — Cloudflare Worker Cron
 * Caller: Cloudflare Cron (setiap 1 menit) ATAU POST /trigger (manual dev)
 * Dependensi: Neon HTTP SQL API (DATABASE_URL), notification channel configs
 * Main Functions: scheduled(), queryNeon(), dispatchNotifications(), sendTelegram(), sendDiscord(), sendWebhook()
 * Side Effects: DB UPDATE agents.status, INSERT/UPDATE incidents, HTTP POST ke channel eksternal
 *
 * Flow:
 * 1. Detect overdue agents → mark offline → open incident → dispatch notifications
 * 2. Detect recovered agents → mark online → resolve incident → dispatch recovery notifications
 */

interface Env {
  DATABASE_URL: string;
  WORKER_SECRET?: string;
}

interface AgentRow {
  id: string;
  project_id: string;
  name: string;
  status: string;
  offline_deadline_at: string;
}

interface NotificationChannel {
  id: string;
  type: string;       // telegram | discord | webhook
  name: string;
  config_json: {
    botToken?: string;
    chatId?: string;
    webhookUrl?: string;
    url?: string;
    secret?: string;
    headers?: Record<string, string>;
  };
  enabled: boolean;
  notify_on: string;  // offline | online | both
}

// ─── Neon HTTP Query Helper ───────────────────────────────────────────────────

async function queryNeon(
  databaseUrl: string,
  sql: string,
  params: unknown[] = []
): Promise<{ rows: Record<string, unknown>[] }> {
  const parsed = new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "https://"));
  const endpoint = `https://${parsed.hostname}/sql`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Neon-Connection-String": databaseUrl,
    },
    body: JSON.stringify({ query: sql, params }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Neon query failed: ${response.status} - ${text}`);
  }

  return response.json() as Promise<{ rows: Record<string, unknown>[] }>;
}

// ─── Notification Dispatchers ─────────────────────────────────────────────────

async function sendTelegram(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Telegram send failed: ${resp.status} - ${body}`);
  }
}

async function sendDiscord(webhookUrl: string, message: string): Promise<void> {
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Discord webhook failed: ${resp.status} - ${body}`);
  }
}

async function sendWebhook(
  url: string,
  message: string,
  secret?: string,
  extraHeaders?: Record<string, string>
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (secret) {
    headers["X-EZMON-Secret"] = secret;
  }
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, timestamp: new Date().toISOString() }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Webhook failed: ${resp.status} - ${body}`);
  }
}

// ─── Dispatch to All Enabled Channels ─────────────────────────────────────────

async function dispatchNotifications(
  databaseUrl: string,
  projectId: string,
  incidentId: string,
  message: string,
  eventType: "offline" | "online"   // untuk filter notify_on
): Promise<void> {
  // Ambil semua channel yang aktif untuk project ini
  const channelsResult = await queryNeon(
    databaseUrl,
    `SELECT id, type, name, config_json, enabled, notify_on
     FROM notification_channels
     WHERE project_id = $1 AND enabled = true`,
    [projectId]
  );

  const channels = channelsResult.rows as unknown as NotificationChannel[];
  if (channels.length === 0) return;

  // Filter berdasarkan notify_on
  const eligible = channels.filter(ch => {
    const n = ch.notify_on ?? "both";
    return n === "both" || n === eventType;
  });
  if (eligible.length === 0) {
    console.log(`[notify] No channels eligible for eventType=${eventType}`);
    return;
  }

  for (const ch of eligible) {
    let sendErr: string | null = null;
    const cfg = ch.config_json;

    try {
      if (ch.type === "telegram" && cfg.botToken && cfg.chatId) {
        await sendTelegram(cfg.botToken, cfg.chatId, message);
      } else if (ch.type === "discord" && cfg.webhookUrl) {
        await sendDiscord(cfg.webhookUrl, message);
      } else if (ch.type === "webhook" && cfg.url) {
        await sendWebhook(cfg.url, message, cfg.secret, cfg.headers);
      } else {
        sendErr = `Unknown or misconfigured channel type: ${ch.type}`;
      }
      console.log(`[notify] Sent via ${ch.type} channel "${ch.name}"`);
    } catch (e) {
      sendErr = String(e);
      console.error(`[notify] Failed ${ch.type} channel "${ch.name}": ${sendErr}`);
    }

    // Catat hasilnya di alert_events
    await queryNeon(
      databaseUrl,
      `INSERT INTO alert_events (id, incident_id, channel_id, status, sent_at, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [
        incidentId,
        ch.id,
        sendErr ? "failed" : "sent",
        sendErr ? null : new Date().toISOString(),
      ]
    );
    
    // Log error secara terpisah (tidak disimpan ke DB karena kolom tidak ada di schema)
    if (sendErr) {
      console.error(`[notify] Channel ${ch.id} failed: ${sendErr}`);
    }
  }
}

// ─── Worker Export ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // ── /debug — lihat state DB dan test notifikasi ──────────────────────────
    if (url.pathname === "/debug" && request.method === "GET") {
      const report: Record<string, unknown> = { ts: new Date().toISOString() };
      try {
        // 1. Semua agents
        const agentsRes = await queryNeon(env.DATABASE_URL,
          `SELECT id, name, status, last_seen_at, offline_deadline_at,
                  (offline_deadline_at < NOW()) as deadline_passed
           FROM agents ORDER BY last_seen_at DESC LIMIT 20`);
        report.agents = agentsRes.rows;

        // 2. Semua overdue (yang harusnya terdeteksi evaluator)
        const overdueRes = await queryNeon(env.DATABASE_URL,
          `SELECT id, name, status, offline_deadline_at FROM agents
           WHERE status != 'offline' AND offline_deadline_at IS NOT NULL AND offline_deadline_at < NOW()`);
        report.overdue_agents = overdueRes.rows;

        // 3. Channels
        const channelsRes = await queryNeon(env.DATABASE_URL,
          `SELECT id, project_id, type, name, enabled, config_json FROM notification_channels`);
        report.channels = channelsRes.rows;

        // 4. Recent incidents
        const incRes = await queryNeon(env.DATABASE_URL,
          `SELECT id, agent_id, type, status, started_at FROM incidents ORDER BY started_at DESC LIMIT 10`);
        report.recent_incidents = incRes.rows;

        // 5. Check actual columns in alert_events table
        const colRes = await queryNeon(env.DATABASE_URL,
          `SELECT column_name, data_type FROM information_schema.columns
           WHERE table_name = 'alert_events' ORDER BY ordinal_position`);
        report.alert_events_columns = colRes.rows;

        // 6. Recent alert_events (safe)
        const evRes = await queryNeon(env.DATABASE_URL, `SELECT * FROM alert_events LIMIT 10`);
        report.recent_alert_events = evRes.rows;

        report.db_ok = true;
      } catch (e) {
        report.db_error = String(e);
        report.db_ok = false;
      }
      return new Response(JSON.stringify(report, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── /trigger — manual evaluator run ──────────────────────────────────────
    if (url.pathname === "/trigger" && request.method === "POST") {
      ctx.waitUntil(
        this.scheduled(
          { cron: "manual", type: "manual", scheduledTime: Date.now() } as ScheduledEvent,
          env,
          ctx
        )
      );
      return new Response("Evaluator triggered manually", { status: 200 });
    }

    return new Response(
      "EZMON Worker Evaluator is running. (Use POST /trigger to run manually, GET /debug to inspect state)",
      { status: 200, headers: { "Content-Type": "text/plain" } }
    );
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log("[evaluator] Cron triggered at", new Date().toISOString());

    try {
      // ── STEP 1: Detect & handle overdue (online/unknown → offline) ──────────

      const overdueResult = await queryNeon(
        env.DATABASE_URL,
        `SELECT id, project_id, name, status, offline_deadline_at
         FROM agents
         WHERE status != 'offline'
           AND offline_deadline_at IS NOT NULL
           AND offline_deadline_at < NOW()
         LIMIT 500`
      );

      const overdueAgents = overdueResult.rows as unknown as AgentRow[];
      console.log(`[evaluator] Found ${overdueAgents.length} overdue agents`);

      for (const agent of overdueAgents) {
        // Mark agent offline
        await queryNeon(
          env.DATABASE_URL,
          `UPDATE agents SET status = 'offline', updated_at = NOW() WHERE id = $1`,
          [agent.id]
        );

        // Anti-spam: hanya buat incident baru jika belum ada yang open
        const existingIncident = await queryNeon(
          env.DATABASE_URL,
          `SELECT id FROM incidents
           WHERE agent_id = $1 AND type = 'heartbeat_missed' AND status = 'open'
           LIMIT 1`,
          [agent.id]
        );

        if (existingIncident.rows.length === 0) {
          // Buat incident baru
          const incidentResult = await queryNeon(
            env.DATABASE_URL,
            `INSERT INTO incidents (id, project_id, agent_id, type, status, message, started_at)
             VALUES (gen_random_uuid(), $1, $2, 'heartbeat_missed', 'open', $3, NOW())
             RETURNING id`,
            [
              agent.project_id,
              agent.id,
              `Agent "${agent.name}" missed heartbeat deadline`,
            ]
          );

          const incidentId = incidentResult.rows[0]?.id as string;
          console.log(`[evaluator] Agent ${agent.id} (${agent.name}) → offline, incident ${incidentId} created`);

          // Dispatch notifikasi offline ke semua channel aktif
          if (incidentId) {
            const msg = `🔴 *EZMON Alert*\nAgent *${agent.name}* is OFFLINE\nMissed heartbeat deadline at ${agent.offline_deadline_at}`;
            await dispatchNotifications(env.DATABASE_URL, agent.project_id, incidentId, msg, "offline");
          }
        } else {
          console.log(`[evaluator] Agent ${agent.id} (${agent.name}) → already has open incident, skipping notify`);
        }
      }

      // ── STEP 2: Detect & handle recovered (offline → online) ────────────────

      const recoveredResult = await queryNeon(
        env.DATABASE_URL,
        `SELECT id, project_id, name, status
         FROM agents
         WHERE status = 'offline'
           AND offline_deadline_at IS NOT NULL
           AND offline_deadline_at >= NOW()
         LIMIT 500`
      );

      const recoveredAgents = recoveredResult.rows as unknown as AgentRow[];
      console.log(`[evaluator] Found ${recoveredAgents.length} recovered agents`);

      for (const agent of recoveredAgents) {
        await queryNeon(
          env.DATABASE_URL,
          `UPDATE agents SET status = 'online', updated_at = NOW() WHERE id = $1`,
          [agent.id]
        );

        // Resolve semua open incidents untuk agent ini
        const resolvedIncidents = await queryNeon(
          env.DATABASE_URL,
          `UPDATE incidents
           SET status = 'resolved', resolved_at = NOW()
           WHERE agent_id = $1 AND type = 'heartbeat_missed' AND status = 'open'
           RETURNING id, project_id`,
          [agent.id]
        );

        console.log(`[evaluator] Agent ${agent.id} (${agent.name}) → recovered`);

        // Dispatch notifikasi recovery untuk setiap incident yang baru di-resolve
        for (const row of resolvedIncidents.rows) {
          const incidentId = row.id as string;
          const projectId = row.project_id as string;
          const msg = `🟢 *EZMON Recovery*\nAgent *${agent.name}* is back ONLINE`;
          await dispatchNotifications(env.DATABASE_URL, projectId, incidentId, msg, "online");
        }
      }

      // ── STEP 3: Retention Cleanup ──────────────────────────────────────────────────
      try {
        await queryNeon(
          env.DATABASE_URL,
          `DELETE FROM metric_buckets WHERE bucket_start < NOW() - INTERVAL '7 days'`
        );
        console.log(`[evaluator] Retention cleanup complete (7 days)`);
      } catch (e) {
        console.error("[evaluator] Retention cleanup error:", e);
      }

      console.log("[evaluator] Evaluation complete");
    } catch (error) {
      console.error("[evaluator] Error:", error);
    }
  },
};
