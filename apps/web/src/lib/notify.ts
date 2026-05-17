// Tujuan: Helper dispatch notifikasi dari dalam Next.js API routes (test endpoint, heartbeat)
// Caller: /api/dashboard/notifications/test/route.ts, heartbeat route (recovery)
// Dependensi: db, notification_channels schema, @ezmon/db
// Main Functions: sendTelegram, sendDiscord, sendWebhook, deepReplaceVars, buildDefaultDiscordEmbed, dispatchNotification
// Side Effects: HTTP POST ke Telegram/Discord/Webhook, INSERT ke alert_events

import { db } from "@/lib/db";
import { notificationChannels, alertEvents, eq, and } from "@ezmon/db";

type EventType = "offline" | "online";

/** Variabel template yang tersedia untuk semua channel */
export interface TemplateVars {
  project: string;
  agentOrMonitor: string;
  status: string;
  statusEmoji: string;
  time: string;
  url?: string;      // monitor only
  latency?: string;  // monitor only
  error?: string;    // monitor only, jika ada
}

/**
 * deepReplaceVars: Rekursif replace template variables dalam semua string value.
 * Support plain string dan nested JSON object/array.
 * Variabel: {project}, {agent}, {monitor}, {status}, {status_emoji}, {time}, {url}, {latency}, {error}
 */
export function deepReplaceVars(obj: unknown, vars: TemplateVars): unknown {
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

/**
 * buildDefaultDiscordEmbed: Generate smart default Discord embed ketika
 * user tidak mengisi custom message. Warna merah untuk offline/down,
 * hijau untuk online/recovered.
 */
export function buildDefaultDiscordEmbed(
  vars: TemplateVars,
  eventType: EventType,
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

// ─── Channel Senders ──────────────────────────────────────────────────────────

export async function sendTelegram(botToken: string, chatId: string, message: string): Promise<void> {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Telegram: ${resp.status} - ${body}`);
  }
}

/**
 * sendDiscord: Kirim notifikasi ke Discord webhook.
 * - Jika message adalah object → kirim langsung (smart default embed / user JSON embed)
 * - Jika message adalah valid JSON string → parse dan kirim langsung
 * - Jika plain text → wrap sebagai { content: message }
 */
export async function sendDiscord(webhookUrl: string, message: string | object): Promise<void> {
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
    const errBody = await resp.text();
    throw new Error(`Discord: ${resp.status} - ${errBody}`);
  }
}

export async function sendWebhook(
  url: string,
  message: string,
  secret?: string,
  extraHeaders?: Record<string, string>
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (secret) headers["X-EZMON-Secret"] = secret;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, timestamp: new Date().toISOString() }),
  });
  if (!resp.ok) throw new Error(`Webhook: ${resp.status}`);
}

// ─── Dispatch to All Channels ─────────────────────────────────────────────────

/**
 * dispatchNotification: Kirim notifikasi ke semua channel aktif yang relevan.
 * Filter berdasarkan notify_on: 'offline' | 'online' | 'both'
 * Filter berdasarkan targetType: 'all' | 'agent' | 'monitor'
 * Untuk Discord: support JSON template passthrough + smart default embed.
 */
export async function dispatchNotification({
  projectId,
  incidentId,
  message,
  eventType,
  sourceType = "agent",
  templateVars,
}: {
  projectId: string;
  incidentId: string;
  message: string;
  eventType: EventType;
  sourceType?: "agent" | "monitor";
  templateVars?: TemplateVars;
}): Promise<void> {
  const channels = await db()
    .select()
    .from(notificationChannels)
    .where(
      and(
        eq(notificationChannels.projectId, projectId),
        eq(notificationChannels.enabled, true)
      )
    );

  for (const ch of channels) {
    // Filter notify_on
    const notifyOn = (ch.notifyOn ?? "both") as string;
    if (notifyOn !== "both" && notifyOn !== eventType) {
      console.log(`[notify] Skip channel ${ch.name} (notify_on=${notifyOn}, event=${eventType})`);
      continue;
    }

    const cfg = (ch.configJson ?? {}) as any;

    // Filter targetType
    const targetType = cfg.targetType ?? "all";
    if (targetType !== "all" && targetType !== sourceType) {
      console.log(`[notify] Skip channel ${ch.name} (targetType=${targetType}, sourceType=${sourceType})`);
      continue;
    }

    let status = "sent";
    let sendError: string | null = null;

    try {
      if (ch.type === "telegram" && cfg.botToken && cfg.chatId) {
        // ── Telegram: plain text / Markdown template ──────────────────────
        let finalMsg = message;
        if (templateVars) {
          const tpl = eventType === "offline" ? cfg.customOfflineMessage : cfg.customOnlineMessage;
          if (tpl && typeof tpl === "string") {
            finalMsg = deepReplaceVars(tpl, templateVars) as string;
          }
        }
        await sendTelegram(cfg.botToken, cfg.chatId, finalMsg);
      } else if (ch.type === "discord" && cfg.webhookUrl) {
        // ── Discord: JSON passthrough / plain text / smart default embed ──
        const tpl = eventType === "offline" ? cfg.customOfflineMessage : cfg.customOnlineMessage;

        if (!tpl && templateVars) {
          // Smart default embed
          const embed = buildDefaultDiscordEmbed(templateVars, eventType, sourceType);
          await sendDiscord(cfg.webhookUrl, embed);
        } else if (tpl && templateVars) {
          // Parse JSON dulu ke variable — catch HANYA untuk JSON.parse error
          // sendDiscord error ditangkap outer catch agar tidak coba kirim dua kali
          let discordBody: object | string;
          try {
            const parsed = JSON.parse(tpl);
            if (typeof parsed === "object" && parsed !== null) {
              discordBody = deepReplaceVars(parsed, templateVars) as object;
            } else {
              discordBody = deepReplaceVars(tpl, templateVars) as string;
            }
          } catch {
            // JSON.parse gagal → plain text
            discordBody = deepReplaceVars(tpl, templateVars) as string;
          }
          // Kirim satu kali — error ditangkap outer catch
          await sendDiscord(cfg.webhookUrl, discordBody);
        } else {
          await sendDiscord(cfg.webhookUrl, message);
        }
      } else if (ch.type === "webhook" && cfg.url) {
        let finalMsg = message;
        if (templateVars) {
          const tpl = eventType === "offline" ? cfg.customOfflineMessage : cfg.customOnlineMessage;
          if (tpl && typeof tpl === "string") {
            finalMsg = deepReplaceVars(tpl, templateVars) as string;
          }
        }
        await sendWebhook(cfg.url, finalMsg, cfg.secret, cfg.headers);
      } else {
        sendError = `Misconfigured channel type: ${ch.type}`;
        status = "failed";
      }
      if (!sendError) console.log(`[notify] ${status} via ${ch.type} "${ch.name}" (event=${eventType})`);
    } catch (e) {
      sendError = String(e);
      status = "failed";
      console.error(`[notify] Failed ${ch.type} "${ch.name}": ${sendError}`);
    }

    // Catat ke alert_events — dibungkus try/catch sendiri agar
    // Neon timeout tidak crash loop dan channel berikutnya tetap diproses
    try {
      await db().insert(alertEvents).values({
        incidentId,
        channelId: ch.id,
        status,
        sentAt: status === "sent" ? new Date() : null,
      });
    } catch (insertErr) {
      console.error(`[notify] alert_events insert failed for channel ${ch.id}: ${insertErr}`);
    }
  }
}
