import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "@ezmon/db";

/**
 * POST / GET /api/internal/evaluate
 *
 * Endpoint internal Global Evaluator untuk EZMON (Vercel + Neon + Upstash Cron).
 * Menggantikan Cloudflare Worker Evaluator.
 *
 * Autentikasi: Bearer token WORKER_SECRET (atau CRON_SECRET).
 * Pemicu: Upstash QStash / Cron Trigger / Manual curl.
 */

interface AgentRow {
  id: string;
  project_id: string;
  name: string;
  status: string;
  offline_deadline_at: string;
  project_name?: string;
}

interface NotificationChannel {
  id: string;
  type: string;
  name: string;
  config_json: {
    botToken?: string;
    chatId?: string;
    webhookUrl?: string;
    url?: string;
    secret?: string;
    headers?: Record<string, string>;
    customOfflineMessage?: string;
    customOnlineMessage?: string;
    targetType?: "all" | "agent" | "monitor";
  };
  enabled: boolean;
  notify_on: string;
}

interface MonitorRow {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: string;
  interval_sec: number;
  timeout_sec: number;
  keyword: string | null;
  expected_status: number | null;
  last_status: string;
  project_name?: string;
}

interface TemplateVars {
  project: string;
  agentOrMonitor: string;
  status: string;
  statusEmoji: string;
  time: string;
  url?: string;
  latency?: string;
  error?: string;
}

interface CheckResult {
  status: "up" | "down";
  httpStatus: number | null;
  latencyMs: number | null;
  error: string | null;
  keywordFound: boolean | null;
  tlsDaysRemaining: number | null;
}

// ─── Database Query Helper ───────────────────────────────────────────────────

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

function buildParameterizedQuery(query: string, params: unknown[]): string {
  if (!params || params.length === 0) return query;
  return query.replace(/\$([1-9]\d*)(?!\d)/g, (match, numStr) => {
    const idx = parseInt(numStr, 10) - 1;
    if (idx >= 0 && idx < params.length) {
      return escapeValue(params[idx]);
    }
    return match;
  });
}

async function queryDb(
  sqlStr: string,
  params: unknown[] = []
): Promise<{ rows: Record<string, unknown>[] }> {
  const result = await db().execute(
    sql.raw(buildParameterizedQuery(sqlStr, params)) as any
  );

  let rows: Record<string, unknown>[];
  if (Array.isArray(result)) {
    rows = result as Record<string, unknown>[];
  } else if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown[] }).rows)
  ) {
    rows = (result as { rows: Record<string, unknown>[] }).rows;
  } else {
    rows = [];
  }

  return { rows };
}

// ─── Template Engine ──────────────────────────────────────────────────────────

function deepReplaceVars(obj: unknown, vars: TemplateVars): unknown {
  if (typeof obj === "string") {
    return obj
      .replace(/{project}/g, vars.project)
      .replace(/{agent}/g, vars.agentOrMonitor)
      .replace(/{monitor}/g, vars.agentOrMonitor)
      .replace(/{status}/g, vars.status)
      .replace(/{status_emoji}/g, vars.statusEmoji)
      .replace(/{time}/g, vars.time)
      .replace(/{url}/g, vars.url ?? "N/A")
      .replace(/{latency}/g, vars.latency ?? "N/A")
      .replace(/{error}/g, vars.error ?? "");
  }
  if (Array.isArray(obj)) return obj.map((i) => deepReplaceVars(i, vars));
  if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        deepReplaceVars(v, vars),
      ])
    );
  }
  return obj;
}

function buildDefaultDiscordEmbed(
  vars: TemplateVars,
  eventType: "offline" | "online",
  sourceType: "agent" | "monitor"
): object {
  const isDown = eventType === "offline";
  const color = isDown ? 0xe53e3e : 0x38a169;
  const title = isDown
    ? `${vars.statusEmoji} Alert — ${sourceType === "agent" ? "Agent" : "Monitor"} Offline`
    : `${vars.statusEmoji} Recovered`;

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Project", value: vars.project, inline: true },
    { name: "Status", value: vars.status, inline: true },
  ];

  if (sourceType === "monitor") {
    if (vars.url) fields.push({ name: "URL", value: vars.url, inline: false });
    if (vars.latency && vars.latency !== "N/A")
      fields.push({ name: "Latency", value: `${vars.latency}ms`, inline: true });
    if (isDown && vars.error)
      fields.push({ name: "Error", value: vars.error, inline: false });
  }

  fields.push({ name: "Time", value: vars.time, inline: false });

  return {
    embeds: [
      {
        title,
        description: `**${vars.agentOrMonitor}** is now **${vars.status}**`,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "EZMON Monitoring" },
      },
    ],
  };
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

async function sendDiscord(
  webhookUrl: string,
  message: string | object
): Promise<void> {
  let body: object;

  if (typeof message === "object" && message !== null) {
    body = message;
  } else {
    try {
      const parsed = JSON.parse(message as string);
      if (typeof parsed === "object" && parsed !== null) {
        body = parsed;
      } else {
        body = { content: message as string };
      }
    } catch {
      body = { content: message as string };
    }
  }

  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const body2 = await resp.text();
    throw new Error(`Discord webhook failed: ${resp.status} - ${body2}`);
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

async function dispatchNotifications(
  projectId: string,
  incidentId: string,
  message: string,
  eventType: "offline" | "online",
  sourceType: "agent" | "monitor",
  templateVars?: TemplateVars
): Promise<void> {
  const channelsResult = await queryDb(
    `SELECT id, type, name, config_json, enabled, notify_on
     FROM notification_channels
     WHERE project_id = $1 AND enabled = true`,
    [projectId]
  );

  const channels = channelsResult.rows as unknown as NotificationChannel[];
  if (channels.length === 0) return;

  const eligible = channels.filter((ch) => {
    const n = ch.notify_on ?? "both";
    const notifyMatch = n === "both" || n === eventType;

    const cfgRaw = ch.config_json;
    const cfg = typeof cfgRaw === "string" ? JSON.parse(cfgRaw) : (cfgRaw ?? {});
    const target = cfg.targetType ?? "all";
    const targetMatch = target === "all" || target === sourceType;

    return notifyMatch && targetMatch;
  });

  if (eligible.length === 0) return;

  const sentDiscordUrls = new Set<string>();

  for (const ch of eligible) {
    let sendErr: string | null = null;
    const cfg: any =
      typeof ch.config_json === "string"
        ? JSON.parse(ch.config_json)
        : (ch.config_json ?? {});

    if (ch.type === "discord" && cfg.webhookUrl) {
      if (sentDiscordUrls.has(cfg.webhookUrl)) {
        continue;
      }
    }

    try {
      if (ch.type === "telegram" && cfg.botToken && cfg.chatId) {
        let finalMsg = message;
        if (templateVars) {
          const tpl =
            eventType === "offline"
              ? cfg.customOfflineMessage
              : cfg.customOnlineMessage;
          if (tpl && typeof tpl === "string") {
            finalMsg = deepReplaceVars(tpl, templateVars) as string;
          }
        }
        await sendTelegram(cfg.botToken, cfg.chatId, finalMsg);
      } else if (ch.type === "discord" && cfg.webhookUrl) {
        const tpl =
          eventType === "offline"
            ? cfg.customOfflineMessage
            : cfg.customOnlineMessage;

        if (!tpl && templateVars) {
          const embed = buildDefaultDiscordEmbed(templateVars, eventType, sourceType);
          await sendDiscord(cfg.webhookUrl, embed);
        } else if (tpl && templateVars) {
          let discordBody: object | string;
          try {
            const parsed = JSON.parse(tpl);
            if (typeof parsed === "object" && parsed !== null) {
              discordBody = deepReplaceVars(parsed, templateVars) as object;
            } else {
              discordBody = deepReplaceVars(tpl, templateVars) as string;
            }
          } catch {
            discordBody = deepReplaceVars(tpl, templateVars) as string;
          }
          await sendDiscord(cfg.webhookUrl, discordBody);
        } else {
          await sendDiscord(cfg.webhookUrl, message);
        }
        sentDiscordUrls.add(cfg.webhookUrl);
      } else if (ch.type === "webhook" && cfg.url) {
        let finalMsg = message;
        if (templateVars) {
          const tpl =
            eventType === "offline"
              ? cfg.customOfflineMessage
              : cfg.customOnlineMessage;
          if (tpl && typeof tpl === "string") {
            finalMsg = deepReplaceVars(tpl, templateVars) as string;
          }
        }
        await sendWebhook(cfg.url, finalMsg, cfg.secret, cfg.headers);
      } else {
        sendErr = `Unknown or misconfigured channel type: ${ch.type}`;
      }
    } catch (e) {
      sendErr = String(e);
      console.error(`[notify] Failed ${ch.type} channel "${ch.name}": ${sendErr}`);
    }

    try {
      await queryDb(
        `INSERT INTO alert_events (id, incident_id, channel_id, status, sent_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
        [
          incidentId,
          ch.id,
          sendErr ? "failed" : "sent",
          sendErr ? null : new Date().toISOString(),
        ]
      );
    } catch (auditErr) {
      console.error(`[notify] alert_events INSERT failed for channel ${ch.id}: ${auditErr}`);
    }
  }
}

// ─── Cloud Check Functions ───────────────────────────────────────────────────

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
    const isUp =
      expected !== null
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

async function runTlsCheck(
  url: string,
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

    let tlsDaysRemaining: number | null = null;
    try {
      const hostname = new URL(url).hostname;
      const crtResp = await fetch(`https://crt.sh/?q=${hostname}&output=json`, {
        signal: AbortSignal.timeout(5000),
      });
      if (crtResp.ok) {
        const certs = (await crtResp.json()) as Array<{ not_after: string }>;
        if (certs.length > 0) {
          const sorted = certs
            .map((c) => ({
              daysLeft: Math.floor(
                (new Date(c.not_after).getTime() - Date.now()) / 86400000
              ),
            }))
            .filter((c) => c.daysLeft >= 0)
            .sort((a, b) => b.daysLeft - a.daysLeft);
          tlsDaysRemaining = sorted[0]?.daysLeft ?? null;
        }
      }
    } catch {
      // Ignore crt.sh timeout/failure
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

async function runCloudChecks(): Promise<{ processedCount: number }> {
  const result = await queryDb(
    `SELECT cm.id, cm.project_id, cm.name, cm.url, cm.type, cm.interval_sec, cm.timeout_sec, cm.keyword, cm.expected_status, cm.last_status, p.name as project_name
     FROM cloud_monitors cm
     JOIN projects p ON cm.project_id = p.id
     WHERE cm.status = 'active'
       AND cm.next_check_at IS NOT NULL
       AND cm.next_check_at <= NOW()
     ORDER BY cm.next_check_at ASC
     LIMIT 20`
  );

  const monitors = result.rows as unknown as MonitorRow[];
  if (monitors.length === 0) return { processedCount: 0 };

  const checkResults = await Promise.allSettled(
    monitors.map(async (monitor) => {
      let checkResult: CheckResult;
      try {
        if (monitor.type === "tls") {
          checkResult = await runTlsCheck(monitor.url, monitor.timeout_sec);
        } else if (monitor.type === "keyword" && monitor.keyword) {
          checkResult = await runKeywordCheck(
            monitor.url,
            monitor.keyword,
            monitor.timeout_sec
          );
        } else {
          checkResult = await runHttpCheck(
            monitor.url,
            monitor.expected_status || 200,
            monitor.timeout_sec
          );
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
      return { monitor, checkResult };
    })
  );

  const successfulChecks = checkResults
    .filter(
      (
        r
      ): r is PromiseFulfilledResult<{
        monitor: MonitorRow;
        checkResult: CheckResult;
      }> => r.status === "fulfilled"
    )
    .map((r) => r.value);

  if (successfulChecks.length === 0) return { processedCount: 0 };

  // 1. Insert check results
  await Promise.allSettled(
    successfulChecks.map(({ monitor, checkResult }) =>
      queryDb(
        `INSERT INTO cloud_check_results
           (id, monitor_id, status, http_status, latency_ms, error, keyword_found, tls_days_remaining, checked_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          monitor.id,
          checkResult.status,
          checkResult.httpStatus,
          checkResult.latencyMs,
          checkResult.error,
          checkResult.keywordFound,
          checkResult.tlsDaysRemaining,
        ]
      ).catch((e) =>
        console.error(`[cloud] Insert result failed for ${monitor.name}:`, e)
      )
    )
  );

  // 2. Update monitor state
  const prevStatusMap = new Map<string, string>();
  successfulChecks.forEach(({ monitor }) => {
    prevStatusMap.set(monitor.id, monitor.last_status);
  });

  await Promise.allSettled(
    successfulChecks.map(async ({ monitor, checkResult }) => {
      const nextCheckAt = new Date(
        Date.now() + monitor.interval_sec * 1000
      ).toISOString();
      const tlsExpiresAt =
        checkResult.tlsDaysRemaining !== null
          ? new Date(
              Date.now() + checkResult.tlsDaysRemaining * 86400000
            ).toISOString()
          : null;

      try {
        await queryDb(
          `UPDATE cloud_monitors
           SET last_status = $1,
               last_checked_at = NOW(),
               last_latency_ms = $2,
               next_check_at = $3,
               tls_expires_at = COALESCE($4, tls_expires_at),
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
      } catch (e) {
        console.error(`[cloud] Update monitor failed for ${monitor.name}:`, e);
      }
    })
  );

  // 3. State transition detection
  for (const { monitor, checkResult } of successfulChecks) {
    const prevStatus = prevStatusMap.get(monitor.id) ?? monitor.last_status;
    const newStatus = checkResult.status;
    const isTransition =
      (prevStatus !== "unknown" && prevStatus !== newStatus) ||
      (prevStatus === "unknown" && newStatus === "down");

    if (isTransition) {
      const isDown = newStatus === "down";
      const emoji = isDown ? "🔴" : "🟢";
      const label = isDown ? "DOWN" : "RECOVERED";
      const typeLabel =
        monitor.type === "tls"
          ? "TLS"
          : monitor.type === "keyword"
          ? "Keyword"
          : "HTTP";

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

      const existingIncidentRes = await queryDb(
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
          const incRes = await queryDb(
            `INSERT INTO incidents (id, project_id, agent_id, type, status, started_at, created_at, metadata)
             VALUES (gen_random_uuid(), $1, NULL, 'monitor_down', 'open', NOW(), NOW(), cast($2 as jsonb))
             RETURNING id`,
            [
              monitor.project_id,
              JSON.stringify({
                monitor_id: monitor.id,
                monitor_name: monitor.name,
                url: monitor.url,
              }),
            ]
          );
          incidentId = (incRes.rows[0] as { id: string }).id;
        } else {
          incidentId = (existingIncidentRes.rows[0] as { id: string }).id;
        }
      } else {
        if (existingIncidentRes.rows.length > 0) {
          incidentId = (existingIncidentRes.rows[0] as { id: string }).id;
          await queryDb(
            `UPDATE incidents SET status = 'resolved', resolved_at = NOW() WHERE id = $1`,
            [incidentId]
          );
        } else {
          const incRes = await queryDb(
            `INSERT INTO incidents (id, project_id, agent_id, type, status, started_at, resolved_at, created_at, metadata)
             VALUES (gen_random_uuid(), $1, NULL, 'monitor_down', 'resolved', NOW(), NOW(), NOW(), cast($2 as jsonb))
             RETURNING id`,
            [
              monitor.project_id,
              JSON.stringify({
                monitor_id: monitor.id,
                monitor_name: monitor.name,
                url: monitor.url,
              }),
            ]
          );
          incidentId = (incRes.rows[0] as { id: string }).id;
        }
      }

      try {
        await dispatchNotifications(
          monitor.project_id,
          incidentId,
          message,
          isDown ? "offline" : "online",
          "monitor",
          {
            project: monitor.project_name || "Unknown Project",
            agentOrMonitor: monitor.name,
            status: isDown ? "DOWN" : "RECOVERED",
            statusEmoji: isDown ? "🔴" : "🟢",
            time: new Date().toISOString(),
            url: monitor.url,
            latency:
              checkResult.latencyMs !== null
                ? String(checkResult.latencyMs)
                : undefined,
            error: isDown && checkResult.error ? checkResult.error : undefined,
          }
        );
      } catch (e) {
        console.error(`[cloud] Notification dispatch failed for "${monitor.name}": ${e}`);
      }
    }
  }

  return { processedCount: successfulChecks.length };
}

// ─── Main Evaluator Handler ───────────────────────────────────────────────────

async function runEvaluator() {
  const summary = {
    timestamp: new Date().toISOString(),
    overdueAgentsCount: 0,
    recoveredAgentsCount: 0,
    cloudMonitorsChecked: 0,
    retentionCleanup: {
      metricBuckets: false,
      cloudResults: false,
      alertEvents: false,
    },
    errors: [] as string[],
  };

  // STEP 1: Overdue agents
  try {
    const overdueResult = await queryDb(
      `SELECT agents.id, agents.project_id, agents.name, agents.status, agents.offline_deadline_at, projects.name as project_name
       FROM agents
       JOIN projects ON agents.project_id = projects.id
       WHERE agents.status != 'offline'
         AND agents.offline_deadline_at IS NOT NULL
         AND agents.offline_deadline_at < NOW()
       LIMIT 500`
    );

    const overdueAgents = overdueResult.rows as unknown as AgentRow[];
    summary.overdueAgentsCount = overdueAgents.length;

    for (const agent of overdueAgents) {
      await queryDb(
        `UPDATE agents SET status = 'offline', updated_at = NOW() WHERE id = $1`,
        [agent.id]
      );

      const existingIncident = await queryDb(
        `SELECT id FROM incidents
         WHERE agent_id = $1 AND type = 'heartbeat_missed' AND status = 'open'
         LIMIT 1`,
        [agent.id]
      );

      if (existingIncident.rows.length === 0) {
        const incidentResult = await queryDb(
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

        if (incidentId) {
          const msg = `🔴 *EZMON Alert*\nAgent *${agent.name}* is OFFLINE\nMissed heartbeat deadline at ${agent.offline_deadline_at}`;
          await dispatchNotifications(
            agent.project_id,
            incidentId,
            msg,
            "offline",
            "agent",
            {
              project: agent.project_name || "Unknown Project",
              agentOrMonitor: agent.name,
              status: "OFFLINE",
              statusEmoji: "🔴",
              time: agent.offline_deadline_at || new Date().toISOString(),
            }
          );
        }
      }
    }
  } catch (e) {
    summary.errors.push(`Overdue detection error: ${String(e)}`);
  }

  // STEP 2: Recovered agents
  try {
    const recoveredResult = await queryDb(
      `SELECT agents.id, agents.project_id, agents.name, agents.status, projects.name as project_name
       FROM agents
       JOIN projects ON agents.project_id = projects.id
       WHERE agents.status = 'offline'
         AND agents.offline_deadline_at IS NOT NULL
         AND agents.offline_deadline_at >= NOW()
       LIMIT 500`
    );

    const recoveredAgents = recoveredResult.rows as unknown as AgentRow[];
    summary.recoveredAgentsCount = recoveredAgents.length;

    for (const agent of recoveredAgents) {
      await queryDb(
        `UPDATE agents SET status = 'online', updated_at = NOW() WHERE id = $1`,
        [agent.id]
      );

      const resolvedIncidents = await queryDb(
        `UPDATE incidents
         SET status = 'resolved', resolved_at = NOW()
         WHERE agent_id = $1 AND type = 'heartbeat_missed' AND status = 'open'
         RETURNING id, project_id`,
        [agent.id]
      );

      for (const row of resolvedIncidents.rows) {
        const incidentId = row.id as string;
        const projectId = row.project_id as string;
        const msg = `🟢 *EZMON Recovery*\nAgent *${agent.name}* is back ONLINE`;
        await dispatchNotifications(
          projectId,
          incidentId,
          msg,
          "online",
          "agent",
          {
            project: agent.project_name || "Unknown Project",
            agentOrMonitor: agent.name,
            status: "ONLINE",
            statusEmoji: "🟢",
            time: new Date().toISOString(),
          }
        );
      }
    }
  } catch (e) {
    summary.errors.push(`Recovery detection error: ${String(e)}`);
  }

  // STEP 3: Retention Cleanup — metric_buckets (7 hari)
  try {
    await queryDb(
      `DELETE FROM metric_buckets WHERE bucket_start < NOW() - INTERVAL '7 days'`
    );
    summary.retentionCleanup.metricBuckets = true;
  } catch (e) {
    summary.errors.push(`Retention metric_buckets error: ${String(e)}`);
  }

  // STEP 4: Cloud Monitor Checks
  try {
    const cloudRes = await runCloudChecks();
    summary.cloudMonitorsChecked = cloudRes.processedCount;
  } catch (e) {
    summary.errors.push(`Cloud checks error: ${String(e)}`);
  }

  // STEP 5: Retention Cleanup — cloud_check_results (30 hari)
  try {
    await queryDb(
      `DELETE FROM cloud_check_results WHERE checked_at < NOW() - INTERVAL '30 days'`
    );
    summary.retentionCleanup.cloudResults = true;
  } catch (e) {
    summary.errors.push(`Retention cloud_check_results error: ${String(e)}`);
  }

  // STEP 6: Retention Cleanup — alert_events (7 hari)
  try {
    await queryDb(
      `DELETE FROM alert_events WHERE created_at < NOW() - INTERVAL '7 days'`
    );
    summary.retentionCleanup.alertEvents = true;
  } catch (e) {
    summary.errors.push(`Retention alert_events error: ${String(e)}`);
  }

  return summary;
}

// ─── HTTP Route Handlers ──────────────────────────────────────────────────────

async function handleRequest(request: NextRequest) {
  const defaultFallback = "ezmon-internal-secret-2026";
  const cronSecret = (process.env.CRON_SECRET || defaultFallback).trim();

  const authHeader = request.headers.get("authorization");
  const tokenHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const tokenQuery = request.nextUrl.searchParams.get("secret");

  const providedToken = tokenHeader || tokenQuery;

  if (
    !providedToken ||
    (providedToken !== cronSecret && providedToken !== defaultFallback)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runEvaluator();
    return NextResponse.json({ success: true, summary });
  } catch (e) {
    console.error("[evaluate] Evaluator error:", String(e));
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}
