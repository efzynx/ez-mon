// Tujuan: Test notification endpoint — kirim dummy alert ke channel yang dikonfigurasi user
// Caller: alert-channels.tsx (tombol "Test Offline" / "Test Online")
// Dependensi: @/lib/notify (sendTelegram, sendDiscord, sendWebhook, deepReplaceVars, buildDefaultDiscordEmbed)
// Main Functions: POST handler
// Side Effects: HTTP POST ke Telegram/Discord/Webhook dengan dummy data

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  sendTelegram,
  sendDiscord,
  sendWebhook,
  deepReplaceVars,
  buildDefaultDiscordEmbed,
  type TemplateVars,
} from "@/lib/notify";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, config, eventType } = body;

    if (!type || !config || !eventType) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Dummy templateVars untuk preview — sama untuk agent dan monitor
    const dummyVars: TemplateVars = {
      project: "EZMON Demo Project",
      agentOrMonitor: type === "discord" ? "prod-server-01" : "test-agent-1",
      status: eventType === "offline" ? "OFFLINE" : "ONLINE",
      statusEmoji: eventType === "offline" ? "🔴" : "🟢",
      time: new Date().toISOString(),
      url: "https://api.example.com/health",
      latency: "342",
      error: eventType === "offline" ? "Connection timeout after 10s" : undefined,
    };

    // Default message jika tidak ada custom template
    const defaultMsg =
      eventType === "offline"
        ? `🔴 *EZMON Alert*\nAgent/Monitor *${dummyVars.agentOrMonitor}* is OFFLINE`
        : `🟢 *EZMON Recovery*\nAgent/Monitor *${dummyVars.agentOrMonitor}* is back ONLINE`;

    if (type === "telegram" && config.botToken && config.chatId) {
      // Telegram: plain text / Markdown template
      let finalMsg = defaultMsg;
      const tpl = eventType === "offline" ? config.customOfflineMessage : config.customOnlineMessage;
      if (tpl && typeof tpl === "string") {
        finalMsg = deepReplaceVars(tpl, dummyVars) as string;
      }
      await sendTelegram(config.botToken, config.chatId, finalMsg);
    } else if (type === "discord" && config.webhookUrl) {
      // Discord: JSON passthrough / plain text / smart default embed
      const tpl = eventType === "offline" ? config.customOfflineMessage : config.customOnlineMessage;

      if (!tpl) {
        // Smart default embed — sourceType "agent" untuk test umum
        const embed = buildDefaultDiscordEmbed(dummyVars, eventType as "offline" | "online", "agent");
        await sendDiscord(config.webhookUrl, embed);
      } else {
        try {
          const parsed = JSON.parse(tpl);
          if (typeof parsed === "object" && parsed !== null) {
            // JSON mode: deep replace vars di semua string values
            const replaced = deepReplaceVars(parsed, dummyVars);
            await sendDiscord(config.webhookUrl, replaced as object);
          } else {
            throw new Error("not object");
          }
        } catch {
          // Plain text mode
          const finalMsg = deepReplaceVars(tpl, dummyVars) as string;
          await sendDiscord(config.webhookUrl, finalMsg);
        }
      }
    } else if (type === "webhook" && config.url) {
      let finalMsg = defaultMsg;
      const tpl = eventType === "offline" ? config.customOfflineMessage : config.customOnlineMessage;
      if (tpl && typeof tpl === "string") {
        finalMsg = deepReplaceVars(tpl, dummyVars) as string;
      }
      await sendWebhook(config.url, finalMsg, config.secret, config.headers);
    } else {
      return NextResponse.json({ success: false, error: "Incomplete channel configuration" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Test notification sent successfully" });
  } catch (error) {
    console.error("[notifications/test] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
