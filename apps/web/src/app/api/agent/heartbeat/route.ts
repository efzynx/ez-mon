import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { agents, incidents, eq, and } from "@ezmon/db";
import { heartbeatSchema } from "@ezmon/shared";
import { computeOfflineDeadline, AGENT_STATUS, INCIDENT_STATUS } from "@ezmon/shared";
import { dispatchNotification } from "@/lib/notify";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    // Extract Bearer token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing authorization header" },
        { status: 401 }
      );
    }
    const rawToken = authHeader.slice(7);
    const tokenHash = hashToken(rawToken);

    const body = await req.json();
    const parsed = heartbeatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid payload" },
        { status: 400 }
      );
    }

    const { agentId, timestamp, version } = parsed.data;

    // Verify agent token
    const agentResult = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.tokenHash, tokenHash)))
      .limit(1);

    if (agentResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid agent credentials" },
        { status: 401 }
      );
    }

    const agent = agentResult[0];
    const now = new Date(timestamp);
    const newDeadline = computeOfflineDeadline(
      now,
      agent.heartbeatIntervalSec,
      agent.graceMultiplier
    );

    const previousStatus = agent.status;
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    // Update agent state
    await db()
      .update(agents)
      .set({
        lastSeenAt: now,
        offlineDeadlineAt: newDeadline,
        status: AGENT_STATUS.ONLINE,
        lastIp: clientIp,
        version: version ?? agent.version,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    // If agent was offline or unknown, mark recovery
    if (
      previousStatus === AGENT_STATUS.OFFLINE ||
      previousStatus === AGENT_STATUS.UNKNOWN
    ) {
      // Resolve open heartbeat_missed incidents & ambil ID-nya untuk notifikasi
      const resolvedIncidents = await db()
        .update(incidents)
        .set({
          status: INCIDENT_STATUS.RESOLVED,
          resolvedAt: now,
        })
        .where(
          and(
            eq(incidents.agentId, agentId),
            eq(incidents.status, INCIDENT_STATUS.OPEN),
            eq(incidents.type, "heartbeat_missed")
          )
        )
        .returning({
          id: incidents.id,
          projectId: incidents.projectId,
        });

      console.log(
        `[agent/heartbeat] Agent ${agentId} recovered from ${previousStatus} → online`
      );

      // Kirim recovery notification untuk setiap incident yang baru di-resolve
      for (const inc of resolvedIncidents) {
        const msg = `🟢 *EZMON Recovery*\nAgent *${agent.name}* is back ONLINE`;
        dispatchNotification({
          projectId: inc.projectId,
          incidentId: inc.id,
          message: msg,
          eventType: "online",
        }).catch((e) => console.error("[heartbeat] dispatch recovery failed:", e));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[agent/heartbeat] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
