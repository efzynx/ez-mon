import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendTelegram, sendDiscord, sendWebhook } from "@/lib/notify";

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

    // Dummy data — agent dan monitor menggunakan nama berbeda agar bisa dibedakan di preview
    const DUMMY_AGENT   = "test-agent-1";
    const DUMMY_MONITOR = "test-monitor-1";
    const dummyStatus   = eventType === "offline" ? "OFFLINE" : "ONLINE";
    const dummyTime     = new Date().toISOString();
    const dummyProject  = "EZMON Demo Project";

    let defaultMsg = "";
    if (eventType === "offline") {
      defaultMsg = `🔴 *EZMON Alert*\nAgent/Monitor *${DUMMY_AGENT}* is OFFLINE\nMissed heartbeat deadline at ${dummyTime}`;
    } else {
      defaultMsg = `🟢 *EZMON Recovery*\nAgent/Monitor *${DUMMY_AGENT}* is back ONLINE`;
    }

    let finalMessage = defaultMsg;
    const template = eventType === "offline" ? config.customOfflineMessage : config.customOnlineMessage;

    if (template) {
      finalMessage = template
        .replace(/{project}/g, dummyProject)
        .replace(/{agent}/g, DUMMY_AGENT)
        .replace(/{monitor}/g, DUMMY_MONITOR)
        .replace(/{status}/g, dummyStatus)
        .replace(/{time}/g, dummyTime);
    }

    if (type === "telegram" && config.botToken && config.chatId) {
      await sendTelegram(config.botToken, config.chatId, finalMessage);
    } else if (type === "discord" && config.webhookUrl) {
      await sendDiscord(config.webhookUrl, finalMessage);
    } else if (type === "webhook" && config.url) {
      await sendWebhook(config.url, finalMessage, config.secret, config.headers);
    } else {
      return NextResponse.json({ success: false, error: "Incomplete channel configuration" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Test notification sent successfully" });
  } catch (error) {
    console.error("[notifications/test] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
