import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  agents,
  agentState,
  incidents,
  projects,
  eq,
  and,
} from "@ezmon/db";
import { computeDerivedStatus, INCIDENT_STATUS } from "@ezmon/shared";
import type { DashboardAgent, DashboardOverview, DashboardIncident } from "@ezmon/shared";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = await db()
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, session.user.id))
      )
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    // Get all agents with their latest state (single query with left join)
    const agentRows = await db()
      .select({
        agent: agents,
        state: agentState,
      })
      .from(agents)
      .leftJoin(agentState, eq(agents.id, agentState.agentId))
      .where(eq(agents.projectId, projectId));

    // Get open incidents
    const openIncidentRows = await db()
      .select({
        incident: incidents,
        agentName: agents.name,
      })
      .from(incidents)
      .innerJoin(agents, eq(incidents.agentId, agents.id))
      .where(
        and(
          eq(incidents.projectId, projectId),
          eq(incidents.status, INCIDENT_STATUS.OPEN)
        )
      );

    // Recent incidents (last 20)
    const recentIncidentRows = await db()
      .select({
        incident: incidents,
        agentName: agents.name,
      })
      .from(incidents)
      .innerJoin(agents, eq(incidents.agentId, agents.id))
      .where(eq(incidents.projectId, projectId))
      .orderBy(incidents.startedAt)
      .limit(20);

    // Build dashboard agents with derived status
    const dashboardAgents: DashboardAgent[] = agentRows.map((row) => {
      const derivedStatus = computeDerivedStatus(
        row.agent.offlineDeadlineAt,
        row.agent.lastSeenAt
      );

      return {
        id: row.agent.id,
        name: row.agent.name,
        hostname: row.agent.hostname,
        os: row.agent.os,
        arch: row.agent.arch,
        version: row.agent.version,
        status: row.agent.status as "online" | "offline" | "unknown",
        derivedStatus,
        lastSeenAt: row.agent.lastSeenAt?.toISOString() ?? null,
        offlineDeadlineAt: row.agent.offlineDeadlineAt?.toISOString() ?? null,
        heartbeatIntervalSec: row.agent.heartbeatIntervalSec,
        graceMultiplier: row.agent.graceMultiplier,
        createdAt: row.agent.createdAt.toISOString(),
        state: row.state
          ? {
              cpuPct: row.state.cpuPct,
              memUsedMb: row.state.memUsedMb,
              memTotalMb: row.state.memTotalMb,
              diskUsedMb: row.state.diskUsedMb,
              diskTotalMb: row.state.diskTotalMb,
              load1: row.state.load1,
              netRxBps: row.state.netRxBps,
              netTxBps: row.state.netTxBps,
              containersRunning: row.state.containersRunning,
              collectedAt: row.state.collectedAt.toISOString(),
            }
          : null,
      };
    });

    const onlineCount = dashboardAgents.filter(
      (a) => a.derivedStatus === "online"
    ).length;
    const offlineCount = dashboardAgents.filter(
      (a) => a.derivedStatus === "offline"
    ).length;
    const unknownCount = dashboardAgents.filter(
      (a) => a.derivedStatus === "unknown"
    ).length;

    const recentIncidents: DashboardIncident[] = recentIncidentRows.map(
      (row) => ({
        id: row.incident.id,
        agentId: row.incident.agentId,
        agentName: row.agentName,
        type: row.incident.type as DashboardIncident["type"],
        status: row.incident.status as DashboardIncident["status"],
        message: row.incident.message,
        startedAt: row.incident.startedAt.toISOString(),
        resolvedAt: row.incident.resolvedAt?.toISOString() ?? null,
      })
    );

    const overview: DashboardOverview = {
      totalAgents: dashboardAgents.length,
      onlineAgents: onlineCount,
      offlineAgents: offlineCount,
      unknownAgents: unknownCount,
      openIncidents: openIncidentRows.length,
      recentIncidents,
      agents: dashboardAgents,
    };

    return NextResponse.json({ success: true, data: overview });
  } catch (error) {
    console.error("[dashboard/overview] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
