import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { agents, projects, agentRegistrationTokens, eq, and } from "@ezmon/db";
import { registerAgentSchema, DEFAULTS, computeOfflineDeadline } from "@ezmon/shared";

// Hash agent token with SHA-256 (faster than bcrypt, fine for random tokens)
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerAgentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { projectToken, hostname, os, arch, version, name } = parsed.data;

    let targetProjectId: string | null = null;
    let regTokenId: string | null = null;

    if (projectToken.startsWith("reg_")) {
      const regRecord = await db()
        .select()
        .from(agentRegistrationTokens)
        .where(eq(agentRegistrationTokens.token, projectToken))
        .limit(1);

      if (regRecord.length === 0) {
        return NextResponse.json(
          { success: false, error: "Invalid registration token" },
          { status: 401 }
        );
      }

      const rec = regRecord[0];
      if (rec.usedAt) {
        return NextResponse.json(
          { success: false, error: "Registration token has already been used" },
          { status: 401 }
        );
      }

      if (rec.expiresAt < new Date()) {
        return NextResponse.json(
          { success: false, error: "Registration token has expired (5-minute TTL)" },
          { status: 401 }
        );
      }

      targetProjectId = rec.projectId;
      regTokenId = rec.id;
    } else {
      // Fallback: direct projectId lookup
      const project = await db()
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectToken))
        .limit(1);

      if (project.length === 0) {
        return NextResponse.json(
          { success: false, error: "Invalid project token" },
          { status: 401 }
        );
      }
      targetProjectId = project[0].id;
    }

    if (!targetProjectId) {
      return NextResponse.json(
        { success: false, error: "Invalid target project" },
        { status: 400 }
      );
    }

    // Check for existing agent with same hostname in this project (Upsert-like behavior)
    const existingHost = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.projectId, targetProjectId), eq(agents.hostname, hostname)))
      .limit(1);

    // Generate agent token
    const agentToken = `agt_${randomBytes(32).toString("hex")}`;
    const tokenHash = hashToken(agentToken);

    const now = new Date();
    const initialDeadline = computeOfflineDeadline(
      now,
      existingHost[0]?.heartbeatIntervalSec || DEFAULTS.HEARTBEAT_INTERVAL_SEC,
      existingHost[0]?.graceMultiplier || DEFAULTS.GRACE_MULTIPLIER
    );

    let result;

    if (existingHost.length > 0) {
      // Update existing agent: Pertahankan nama kustom jika sudah ada
      const preservedName = existingHost[0].name || name;

      result = await db()
        .update(agents)
        .set({
          name: preservedName,
          tokenHash,
          os,
          arch,
          version,
          status: "online",
          lastSeenAt: now,
          offlineDeadlineAt: initialDeadline,
          updatedAt: now,
        })
        .where(eq(agents.id, existingHost[0].id))
        .returning({
          id: agents.id,
          heartbeatIntervalSec: agents.heartbeatIntervalSec,
          metricsIntervalSec: agents.metricsIntervalSec,
        });
      
      console.log(`[agent/register] Existing agent updated: ${result[0].id} (preserved name: ${preservedName})`);
    } else {
      // Check agent limit (only for new agents)
      const agentCount = await db()
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.projectId, targetProjectId));

      if (agentCount.length >= DEFAULTS.MAX_AGENTS_PER_PROJECT) {
        return NextResponse.json(
          { success: false, error: `Maximum ${DEFAULTS.MAX_AGENTS_PER_PROJECT} agents per project` },
          { status: 429 }
        );
      }

      // Create new agent with initial online status & deadline
      result = await db()
        .insert(agents)
        .values({
          projectId: targetProjectId,
          name,
          tokenHash,
          hostname,
          os,
          arch,
          version,
          status: "online",
          lastSeenAt: now,
          offlineDeadlineAt: initialDeadline,
          heartbeatIntervalSec: DEFAULTS.HEARTBEAT_INTERVAL_SEC,
          graceMultiplier: DEFAULTS.GRACE_MULTIPLIER,
          metricsIntervalSec: DEFAULTS.METRICS_INTERVAL_SEC,
        })
        .returning({
          id: agents.id,
          heartbeatIntervalSec: agents.heartbeatIntervalSec,
          metricsIntervalSec: agents.metricsIntervalSec,
        });
      
      console.log(`[agent/register] New agent registered: ${result[0].id}`);
    }

    // Mark registration token as used if it was a 1-time token
    if (regTokenId) {
      await db()
        .update(agentRegistrationTokens)
        .set({ usedAt: new Date() })
        .where(eq(agentRegistrationTokens.id, regTokenId));
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    console.log(`[agent/register] Agent registered: ${result[0].id} for project: ${targetProjectId}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          agentId: result[0].id,
          agentToken, // Only time the raw token is returned
          heartbeatIntervalSec: result[0].heartbeatIntervalSec,
          metricsIntervalSec: result[0].metricsIntervalSec,
          uploadUrl: `${appUrl}/api/agent`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[agent/register] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
