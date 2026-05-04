// Tujuan: Dedicated incidents API — list incidents dengan filter status & pagination
// Caller: Dashboard incidents page (/dashboard/incidents)
// Dependensi: @ezmon/db (incidents, agents, projects), @/lib/auth, @/lib/db
// Main Functions: GET handler
// Side Effects: DB SELECT — incidents JOIN agents, project-scoped, filtered by status

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { incidents, agents, projects, eq, and, desc } from "@ezmon/db";
import type { DashboardIncident, IncidentStatus } from "@ezmon/shared";

const VALID_STATUSES = ["open", "resolved", "all"] as const;
type FilterStatus = (typeof VALID_STATUSES)[number];

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const projectId = searchParams.get("projectId");
    const statusParam = (searchParams.get("status") ?? "all") as FilterStatus;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "projectId is required" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(statusParam)) {
      return NextResponse.json(
        { success: false, error: "status must be one of: open, resolved, all" },
        { status: 400 }
      );
    }

    // Verify project ownership (project-scoped — Rule 14)
    const project = await db()
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Build filter condition — status filter optional
    const filters =
      statusParam === "all"
        ? [eq(incidents.projectId, projectId)]
        : [
            eq(incidents.projectId, projectId),
            eq(incidents.status, statusParam as IncidentStatus),
          ];

    // Single efficient query: incidents JOIN agents, ordered DESC, paginated
    const rows = await db()
      .select({
        incident: incidents,
        agentName: agents.name,
      })
      .from(incidents)
      .innerJoin(agents, eq(incidents.agentId, agents.id))
      .where(and(...filters))
      .orderBy(desc(incidents.startedAt))
      .limit(limit)
      .offset(offset);

    const result: DashboardIncident[] = rows.map((row) => ({
      id: row.incident.id,
      agentId: row.incident.agentId,
      agentName: row.agentName,
      type: row.incident.type as DashboardIncident["type"],
      status: row.incident.status as DashboardIncident["status"],
      message: row.incident.message,
      startedAt: row.incident.startedAt.toISOString(),
      resolvedAt: row.incident.resolvedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: result,
      meta: { limit, offset, count: result.length },
    });
  } catch (error) {
    console.error("[dashboard/incidents] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
