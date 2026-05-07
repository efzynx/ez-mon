/**
 * Tujuan: EZMON Global Evaluator — Cloudflare Worker Cron (Phase 1-5)
 * Caller: Cloudflare Cron (setiap 1 menit) ATAU POST /trigger (manual dev)
 * Dependensi: Neon HTTP SQL API (DATABASE_URL), notification channel configs
 * Main Functions:
 *   scheduled() — orchestrator utama cron
 *   queryNeon() — HTTP query helper ke Neon
 *   dispatchNotifications() — kirim alert ke semua channel aktif
 *   sendTelegram/sendDiscord/sendWebhook() — channel-specific senders
 *   runCloudChecks() [Phase 5] — evaluasi HTTP/TLS/Keyword monitors
 *   runHttpCheck/runTlsCheck/runKeywordCheck() [Phase 5] — individual check logic
 * Side Effects:
 *   DB: UPDATE agents.status, INSERT/UPDATE incidents, INSERT cloud_check_results, UPDATE cloud_monitors
 *   HTTP: POST ke Telegram/Discord/Webhook, GET/HEAD ke target URLs monitor
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

// Phase 5: Cloud Monitor
interface MonitorRow {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: string;           // http | tls | keyword
  interval_sec: number;
  timeout_sec: number;
  keyword: string | null;
  expected_status: number | null;
  last_status: string;    // up | down | unknown — untuk deteksi transisi
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

// ─── Phase 5: Cloud Check Functions ──────────────────────────────────────────

/** Hasil dari satu check individual */
interface CheckResult {
  status: "up" | "down";
  httpStatus: number | null;
  latencyMs: number | null;
  error: string | null;
  keywordFound: boolean | null;
  tlsDaysRemaining: number | null;
}

/** HTTP check: verifikasi status code. Pakai HEAD untuk hemat bandwidth. */
async function runHttpCheck(
  url: string,
  expectedStatus: number | null,
  timeoutSec: number
): Promise<CheckResult> {
  const startMs = Date.now();
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutSec * 1000),
    });
    const latencyMs = Date.now() - startMs;
    const expected = expectedStatus ?? null;
    // Jika expectedStatus null → anggap any 2xx sukses
    const isUp = expected !== null
      ? resp.status === expected
      : resp.status >= 200 && resp.status < 300;
    return {
      status: isUp ? "up" : "down",
      httpStatus: resp.status,
      latencyMs,
      error: isUp ? null : `Unexpected status ${resp.status}`,
      keywordFound: null,
      tlsDaysRemaining: null,
    };
  } catch (e) {
    return {
      status: "down",
      httpStatus: null,
      latencyMs: Date.now() - startMs,
      error: String(e),
      keywordFound: null,
      tlsDaysRemaining: null,
    };
  }
}

/**
 * TLS check: periksa apakah sertifikat valid dan berapa hari tersisa.
 * Cloudflare Workers menyediakan akses ke informasi TLS via fetch + response.cf (atau headers).
 * Strategi: fetch HEAD dan baca X-TLS-* headers dari Cloudflare, fallback ke expiry via fetch.
 */
async function runTlsCheck(
  url: string,
  timeoutSec: number
): Promise<CheckResult> {
  const startMs = Date.now();
  try {
    // Cloudflare CF-Visitor dan TLS info tersedia via cf object
    const resp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutSec * 1000),
    });
    const latencyMs = Date.now() - startMs;

    // Cek apakah TLS berhasil (fetch tidak akan throw jika TLS valid di Cloudflare edge)
    // Untuk mendapat expiry date, kita pakai certificate transparency via crt.sh API
    // atau estimasi dari response headers. Fallback: anggap up jika fetch berhasil.
    // Tanda down: URL adalah https:// tapi fetch gagal karena TLS error
    const isHttps = url.startsWith("https://");
    if (!isHttps) {
      return {
        status: "down",
        httpStatus: null,
        latencyMs,
        error: "URL must use HTTPS for TLS check",
        keywordFound: null,
        tlsDaysRemaining: null,
      };
    }

    // Estimasi TLS days remaining via crt.sh lookup (lightweight JSON API)
    let tlsDaysRemaining: number | null = null;
    try {
      const hostname = new URL(url).hostname;
      const crtResp = await fetch(
        `https://crt.sh/?q=${hostname}&output=json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (crtResp.ok) {
        const certs = await crtResp.json() as Array<{ not_after: string }>;
        if (certs.length > 0) {
          // Ambil sertifikat yang paling baru (urutan terdekat not_after terbesar)
          const sorted = certs
            .map(c => ({ daysLeft: Math.floor((new Date(c.not_after).getTime() - Date.now()) / 86400000) }))
            .filter(c => c.daysLeft >= 0)
            .sort((a, b) => b.daysLeft - a.daysLeft);
          tlsDaysRemaining = sorted[0]?.daysLeft ?? null;
        }
      }
    } catch {
      // crt.sh gagal → tidak apa, tetap lanjut
    }

    const isUp = resp.status >= 200 && resp.status < 400;
    return {
      status: isUp ? "up" : "down",
      httpStatus: resp.status,
      latencyMs,
      error: isUp ? null : `TLS fetch returned status ${resp.status}`,
      keywordFound: null,
      tlsDaysRemaining,
    };
  } catch (e) {
    return {
      status: "down",
      httpStatus: null,
      latencyMs: Date.now() - startMs,
      error: `TLS error: ${String(e)}`,
      keywordFound: null,
      tlsDaysRemaining: null,
    };
  }
}

/** Keyword check: GET halaman dan verifikasi keyword ada di body response */
async function runKeywordCheck(
  url: string,
  keyword: string,
  timeoutSec: number
): Promise<CheckResult> {
  const startMs = Date.now();
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutSec * 1000),
    });
    const latencyMs = Date.now() - startMs;
    // Baca max 500KB body untuk mencari keyword — cukup untuk hampir semua halaman
    const text = await resp.text();
    const keywordFound = text.includes(keyword);
    return {
      status: keywordFound ? "up" : "down",
      httpStatus: resp.status,
      latencyMs,
      error: keywordFound ? null : `Keyword "${keyword}" not found in response`,
      keywordFound,
      tlsDaysRemaining: null,
    };
  } catch (e) {
    return {
      status: "down",
      httpStatus: null,
      latencyMs: Date.now() - startMs,
      error: String(e),
      keywordFound: false,
      tlsDaysRemaining: null,
    };
  }
}

/**
 * runCloudChecks: Query semua monitor aktif yang sudah jatuh tempo,
 * jalankan check secara paralel (Promise.allSettled), simpan hasil, update nextCheckAt.
 *
 * DB Justification:
 * - Query pakai index idx_cloud_monitors_next_check + idx_cloud_monitors_status → selective
 * - Batch update nextCheckAt = NOW() + interval_sec untuk semua monitor yang diproses
 * - Retention check_results dilakukan di Step 5 (30 hari)
 */
async function runCloudChecks(databaseUrl: string): Promise<void> {
  // Ambil monitor aktif yang sudah waktunya dicek — max 50 per run untuk safety
  const result = await queryNeon(
    databaseUrl,
    `SELECT id, project_id, name, url, type, interval_sec, timeout_sec, keyword, expected_status, last_status
     FROM cloud_monitors
     WHERE status = 'active'
       AND next_check_at IS NOT NULL
       AND next_check_at <= NOW()
     ORDER BY next_check_at ASC
     LIMIT 50`
  );

  const monitors = result.rows as unknown as MonitorRow[];
  if (monitors.length === 0) return;
  console.log(`[cloud] Found ${monitors.length} monitors due for check`);

  // Jalankan semua check secara paralel untuk efisiensi waktu
  const checkPromises = monitors.map(async (monitor) => {
    let checkResult: CheckResult;

    try {
      if (monitor.type === "tls") {
        checkResult = await runTlsCheck(monitor.url, monitor.timeout_sec);
      } else if (monitor.type === "keyword" && monitor.keyword) {
        checkResult = await runKeywordCheck(monitor.url, monitor.keyword, monitor.timeout_sec);
      } else {
        // Default: HTTP check
        checkResult = await runHttpCheck(monitor.url, monitor.expected_status, monitor.timeout_sec);
      }
    } catch (e) {
      checkResult = {
        status: "down",
        httpStatus: null,
        latencyMs: null,
        error: `Unhandled error: ${String(e)}`,
        keywordFound: null,
        tlsDaysRemaining: null,
      };
    }

    console.log(`[cloud] Monitor "${monitor.name}" → ${checkResult.status} (${checkResult.latencyMs}ms)`);

    // Simpan hasil check ke cloud_check_results
    await queryNeon(
      databaseUrl,
      `INSERT INTO cloud_check_results
         (id, monitor_id, status, http_status, latency_ms, error, keyword_found, tls_days_remaining, checked_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        monitor.id,
        checkResult.status,
        checkResult.httpStatus,
        checkResult.latencyMs,
        checkResult.error,
        checkResult.keywordFound,
        checkResult.tlsDaysRemaining,
      ]
    );

    // Update cloud_monitors: lastStatus, lastCheckedAt, lastLatencyMs, nextCheckAt, tlsExpiresAt
    const nextCheckAt = new Date(Date.now() + monitor.interval_sec * 1000).toISOString();
    const tlsExpiresAt = checkResult.tlsDaysRemaining !== null
      ? new Date(Date.now() + checkResult.tlsDaysRemaining * 86400000).toISOString()
      : null;

    await queryNeon(
      databaseUrl,
      `UPDATE cloud_monitors
       SET last_status = $1,
           last_checked_at = NOW(),
           last_latency_ms = $2,
           next_check_at = $3,
           tls_expires_at = COALESCE($4::timestamptz, tls_expires_at),
           updated_at = NOW()
       WHERE id = $5`,
      [
        checkResult.status,
        checkResult.latencyMs,
        nextCheckAt,
        tlsExpiresAt,
        monitor.id,
      ]
    );

    // ── Deteksi transisi status dan kirim notifikasi ─────────────────────────
    // Hanya kirim jika: sebelumnya bukan 'unknown' DAN status berubah
    const prevStatus = monitor.last_status;
    const newStatus = checkResult.status;
    const isTransition = prevStatus !== "unknown" && prevStatus !== newStatus;

    if (isTransition) {
      const isDown = newStatus === "down";
      const emoji = isDown ? "🔴" : "🟢";
      const label = isDown ? "DOWN" : "RECOVERED";
      const typeLabel = monitor.type === "tls" ? "TLS" : monitor.type === "keyword" ? "Keyword" : "HTTP";

      let message = `${emoji} *[${label}]* Cloud Monitor Alert\n`;
      message += `Monitor: *${monitor.name}*\n`;
      message += `URL: ${monitor.url}\n`;
      message += `Type: ${typeLabel}\n`;
      if (checkResult.latencyMs !== null) {
        message += `Latency: ${checkResult.latencyMs}ms\n`;
      }
      if (isDown && checkResult.error) {
        message += `Error: ${checkResult.error}\n`;
      }
      if (!isDown && checkResult.latencyMs !== null) {
        message += `Response time: ${checkResult.latencyMs}ms`;
      }

      // Buat/resolve incident sederhana untuk cloud monitor
      // Cek apakah ada open incident untuk monitor ini
      const existingIncidentRes = await queryNeon(
        databaseUrl,
        `SELECT id FROM incidents
         WHERE agent_id IS NULL
           AND project_id = $1
           AND type = 'monitor_down'
           AND status = 'open'
           AND metadata->>'monitor_id' = $2
         LIMIT 1`,
        [monitor.project_id, monitor.id]
      );

      let incidentId: string;

      if (isDown) {
        if (existingIncidentRes.rows.length === 0) {
          // Buka incident baru
          const incRes = await queryNeon(
            databaseUrl,
            `INSERT INTO incidents (id, project_id, agent_id, type, status, started_at, created_at, metadata)
             VALUES (gen_random_uuid(), $1, NULL, 'monitor_down', 'open', NOW(), NOW(), $2::jsonb)
             RETURNING id`,
            [monitor.project_id, JSON.stringify({ monitor_id: monitor.id, monitor_name: monitor.name, url: monitor.url })]
          );
          incidentId = (incRes.rows[0] as { id: string }).id;
          console.log(`[cloud] Opened incident ${incidentId} for monitor "${monitor.name}"`);
        } else {
          // Incident sudah ada, pakai ID-nya untuk alert_event
          incidentId = (existingIncidentRes.rows[0] as { id: string }).id;
        }
      } else {
        // Monitor pulih — resolve incident open jika ada
        if (existingIncidentRes.rows.length > 0) {
          incidentId = (existingIncidentRes.rows[0] as { id: string }).id;
          await queryNeon(
            databaseUrl,
            `UPDATE incidents SET status = 'resolved', resolved_at = NOW() WHERE id = $1`,
            [incidentId]
          );
          console.log(`[cloud] Resolved incident ${incidentId} for monitor "${monitor.name}"`);
        } else {
          // Tidak ada incident open, buat placeholder untuk alert_event
          const incRes = await queryNeon(
            databaseUrl,
            `INSERT INTO incidents (id, project_id, agent_id, type, status, started_at, resolved_at, created_at, metadata)
             VALUES (gen_random_uuid(), $1, NULL, 'monitor_down', 'resolved', NOW(), NOW(), NOW(), $2::jsonb)
             RETURNING id`,
            [monitor.project_id, JSON.stringify({ monitor_id: monitor.id, monitor_name: monitor.name, url: monitor.url })]
          );
          incidentId = (incRes.rows[0] as { id: string }).id;
        }
      }

      // Dispatch ke semua channel notifikasi project
      try {
        await dispatchNotifications(
          databaseUrl,
          monitor.project_id,
          incidentId,
          message,
          isDown ? "offline" : "online"
        );
        console.log(`[cloud] Dispatched ${label} notification for monitor "${monitor.name}"`);
      } catch (e) {
        console.error(`[cloud] Notification dispatch failed for "${monitor.name}": ${e}`);
      }
    }
  });

  // Promise.allSettled → jangan biarkan satu monitor yang gagal membatalkan yang lain
  const results = await Promise.allSettled(checkPromises);
  const failed = results.filter(r => r.status === "rejected");
  if (failed.length > 0) {
    console.error(`[cloud] ${failed.length} monitor checks failed:`, failed);
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

      // ── STEP 3: Retention Cleanup — metric_buckets (7 hari) ─────────────────
      try {
        await queryNeon(
          env.DATABASE_URL,
          `DELETE FROM metric_buckets WHERE bucket_start < NOW() - INTERVAL '7 days'`
        );
        console.log(`[evaluator] Retention cleanup metric_buckets complete (7 days)`);
      } catch (e) {
        console.error("[evaluator] Retention cleanup error:", e);
      }

      // ── STEP 4: Cloud Monitor Checks (Phase 5) ────────────────────────────────
      try {
        await runCloudChecks(env.DATABASE_URL);
        console.log(`[evaluator] Cloud checks complete`);
      } catch (e) {
        console.error("[evaluator] Cloud checks error:", e);
      }

      // ── STEP 5: Retention Cleanup — cloud_check_results (30 hari) ────────────
      try {
        await queryNeon(
          env.DATABASE_URL,
          `DELETE FROM cloud_check_results WHERE checked_at < NOW() - INTERVAL '30 days'`
        );
        console.log(`[evaluator] Retention cleanup cloud_check_results complete (30 days)`);
      } catch (e) {
        console.error("[evaluator] Cloud results retention error:", e);
      }

      console.log("[evaluator] Evaluation complete");
    } catch (error) {
      console.error("[evaluator] Error:", error);
    }
  },
};
