// Tujuan: Helper dispatch notifikasi dari dalam Next.js API routes
// Caller: heartbeat route (recovery), evaluator fallback
// Dependensi: db, notification_channels schema
// Main Functions: dispatchNotification()
// Side Effects: HTTP POST ke Telegram/Discord/Webhook, INSERT ke alert_events

import { db } from "@/lib/db";
import { notificationChannels, alertEvents, eq, and } from "@ezmon/db";

type EventType = "offline" | "online";

interface ChannelConfig {
  botToken?: string;
  chatId?: string;
  webhookUrl?: string;
  url?: string;
  secret?: string;
  headers?: Record<string, string>;
}

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

export async function sendDiscord(webhookUrl: string, message: string): Promise<void> {
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message }),
  });
  if (!resp.ok) throw new Error(`Discord: ${resp.status}`);
}

export async function sendWebhook(url: string, message: string, secret?: string, extraHeaders?: Record<string, string>): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  if (secret) headers["X-EZMON-Secret"] = secret;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, timestamp: new Date().toISOString() }),
  });
  if (!resp.ok) throw new Error(`Webhook: ${resp.status}`);
}

/**
 * Dispatch notifikasi ke semua channel aktif yang relevan untuk sebuah event.
 * Filter berdasarkan notify_on: 'offline' | 'online' | 'both'
 * Filter berdasarkan targetType: 'all' | 'agent' | 'monitor'
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
  templateVars?: {
    project: string;
    agentOrMonitor: string;
    status: string;
    time: string;
  };
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

    // Filter targetType — hanya kirim ke channel yang sesuai source-nya
    const targetType = cfg.targetType ?? "all";
    if (targetType !== "all" && targetType !== sourceType) {
      console.log(`[notify] Skip channel ${ch.name} (targetType=${targetType}, sourceType=${sourceType})`);
      continue;
    }

    let status = "sent";
    let error: string | null = null;

    
    let finalMessage = message;
    if (templateVars) {
      const template = eventType === "offline" ? cfg.customOfflineMessage : cfg.customOnlineMessage;
      if (template) {
        finalMessage = template
          .replace(/{project}/g, templateVars.project)
          .replace(/{agent}/g, templateVars.agentOrMonitor)
          .replace(/{monitor}/g, templateVars.agentOrMonitor)
          .replace(/{status}/g, templateVars.status)
          .replace(/{time}/g, templateVars.time);
      }
    }

    try {
      if (ch.type === "telegram" && cfg.botToken && cfg.chatId) {
        await sendTelegram(cfg.botToken, cfg.chatId, finalMessage);
      } else if (ch.type === "discord" && cfg.webhookUrl) {
        await sendDiscord(cfg.webhookUrl, finalMessage);
      } else if (ch.type === "webhook" && cfg.url) {
        await sendWebhook(cfg.url, finalMessage, cfg.secret, cfg.headers);
      } else {
        error = `Misconfigured channel type: ${ch.type}`;
        status = "failed";
      }
      console.log(`[notify] ${status} via ${ch.type} "${ch.name}" (event=${eventType})`);
    } catch (e) {
      error = String(e);
      status = "failed";
      console.error(`[notify] Failed ${ch.type} "${ch.name}": ${error}`);
    }

    // Catat ke alert_events
    try {
      await db().insert(alertEvents).values({
        incidentId,
        channelId: ch.id,
        status,
        sentAt: status === "sent" ? new Date() : null,
      });
    } catch (insertErr) {
      console.error(`[notify] alert_events insert failed: ${insertErr}`);
    }
  }
}
