import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { agents, projects, eq, and } from "@ezmon/db";
import { registerAgentSchema } from "@ezmon/shared";
import { DEFAULTS } from "@ezmon/shared";

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

    // Verify project token — for MVP, projectToken is the project ID
    // In production, this would be a separate token with its own hash
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

    // Check for existing agent with same hostname in this project (Upsert-like behavior)
    const existingHost = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.projectId, project[0].id), eq(agents.hostname, hostname)))
      .limit(1);

    // Generate agent token
    const agentToken = `agt_${randomBytes(32).toString("hex")}`;
    const tokenHash = hashToken(agentToken);

    let result;

    if (existingHost.length > 0) {
      // Update existing agent and rotate token
      result = await db()
        .update(agents)
        .set({
          name,
          tokenHash,
          os,
          arch,
          version,
          status: "unknown", // Reset status until first heartbeat
          updatedAt: new Date(),
        })
        .where(eq(agents.id, existingHost[0].id))
        .returning({
          id: agents.id,
          heartbeatIntervalSec: agents.heartbeatIntervalSec,
          metricsIntervalSec: agents.metricsIntervalSec,
        });
      
      console.log(`[agent/register] Existing agent updated: ${result[0].id}`);
    } else {
      // Check agent limit (only for new agents)
      const agentCount = await db()
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.projectId, project[0].id));

      if (agentCount.length >= DEFAULTS.MAX_AGENTS_PER_PROJECT) {
        return NextResponse.json(
          { success: false, error: `Maximum ${DEFAULTS.MAX_AGENTS_PER_PROJECT} agents per project` },
          { status: 429 }
        );
      }

      // Create new agent
      result = await db()
        .insert(agents)
        .values({
          projectId: project[0].id,
          name,
          tokenHash,
          hostname,
          os,
          arch,
          version,
          status: "unknown",
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    console.log(`[agent/register] Agent registered: ${result[0].id} for project: ${project[0].id}`);

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
