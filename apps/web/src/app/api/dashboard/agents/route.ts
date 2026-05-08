// Tujuan: Agent management API — delete agent dari project (dengan cascade ke incidents, agent_state, alert_events)
// Caller: Dashboard agents page & agent detail page
// Dependensi: @ezmon/db (agents, projects), @/lib/auth, @/lib/db
// Main Functions: DELETE handler
// Side Effects: DB DELETE agents (CASCADE ke agent_state, metric_buckets, incidents, alert_events via FK)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents, projects, eq, and } from "@ezmon/db";
import { updateAgentStatusPageSchema, updateAgentTagsSchema, updateAgentNameSchema } from "@ezmon/shared";

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json({ success: false, error: "agentId is required" }, { status: 400 });
    }

    // Verify ownership: agent harus milik project yang dimiliki user ini (Rule 14 + Rule 24)
    const agentRows = await db()
      .select({ id: agents.id, name: agents.name, projectId: agents.projectId })
      .from(agents)
      .innerJoin(projects, eq(agents.projectId, projects.id))
      .where(
        and(
          eq(agents.id, agentId),
          eq(projects.userId, session.user.id)
        )
      )
      .limit(1);

    if (agentRows.length === 0) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    // Delete agent — FK CASCADE akan otomatis hapus:
    // agent_state, metric_buckets, incidents (+ alert_events via incident FK)
    await db().delete(agents).where(eq(agents.id, agentId));

    console.log(`[agents] Deleted agent ${agentId} (${agentRows[0].name}) by user ${session.user.id}`);

    return NextResponse.json({
      success: true,
      message: `Agent "${agentRows[0].name}" deleted successfully`,
    });
  } catch (error) {
    console.error("[agents] DELETE Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if ("tags" in body) {
      const result = updateAgentTagsSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json({ success: false, error: "Invalid input", issues: result.error.issues }, { status: 400 });
      }

      const { agentId, tags } = result.data;
      const agentRows = await db()
        .select({ id: agents.id })
        .from(agents)
        .innerJoin(projects, eq(agents.projectId, projects.id))
        .where(and(eq(agents.id, agentId), eq(projects.userId, session.user.id)))
        .limit(1);

      if (agentRows.length === 0) return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
      
      await db().update(agents).set({ tags }).where(eq(agents.id, agentId));
      return NextResponse.json({ success: true });
    }

    if ("showOnStatusPage" in body) {
      const result = updateAgentStatusPageSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json({ success: false, error: "Invalid input", issues: result.error.issues }, { status: 400 });
      }

      const { agentId, showOnStatusPage } = result.data;
      const agentRows = await db()
        .select({ id: agents.id })
        .from(agents)
        .innerJoin(projects, eq(agents.projectId, projects.id))
        .where(and(eq(agents.id, agentId), eq(projects.userId, session.user.id)))
        .limit(1);

      if (agentRows.length === 0) return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });

      await db().update(agents).set({ showOnStatusPage }).where(eq(agents.id, agentId));
      return NextResponse.json({ success: true });
    }

    if ("name" in body) {
      const result = updateAgentNameSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json({ success: false, error: "Invalid input", issues: result.error.issues }, { status: 400 });
      }

      const { agentId, name } = result.data;
      const agentRows = await db()
        .select({ id: agents.id })
        .from(agents)
        .innerJoin(projects, eq(agents.projectId, projects.id))
        .where(and(eq(agents.id, agentId), eq(projects.userId, session.user.id)))
        .limit(1);

      if (agentRows.length === 0) return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });

      await db().update(agents).set({ name }).where(eq(agents.id, agentId));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "No valid update fields" }, { status: 400 });
  } catch (error) {
    console.error("[agents] PATCH Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
