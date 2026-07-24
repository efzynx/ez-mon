// Tujuan: Dedicated public API endpoint untuk mengambil status monitor, agent, dan incident publik dalam format JSON
// Caller: Web/Aplikasi pihak ketiga, external dashboard, atau script integrasi publik
// Dependensi: @ezmon/db, @ezmon/shared
// Main Functions: GET, OPTIONS
// Side Effects: DB SELECT

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, agents, incidents, statusPages, cloudMonitors, eq, and } from "@ezmon/db";
import { computeDerivedStatus, INCIDENT_STATUS } from "@ezmon/shared";

// CORS Headers agar API dapat di-fetch dari domain web lain
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Resolve slug: coba customSlug dulu, lalu fallback ke project.slug
    let projectData: typeof projects.$inferSelect | null = null;
    let statusPage: typeof statusPages.$inferSelect | null = null;

    const byCustomSlug = await db()
      .select({ project: projects, page: statusPages })
      .from(statusPages)
      .innerJoin(projects, eq(statusPages.projectId, projects.id))
      .where(eq(statusPages.customSlug, slug))
      .limit(1);

    if (byCustomSlug.length > 0) {
      projectData = byCustomSlug[0].project;
      statusPage = byCustomSlug[0].page;
    } else {
      const byProjectSlug = await db()
        .select()
        .from(projects)
        .where(eq(projects.slug, slug))
        .limit(1);

      if (byProjectSlug.length === 0) {
        return NextResponse.json(
          { success: false, error: "Status page not found" },
          { status: 404, headers: corsHeaders }
        );
      }
      projectData = byProjectSlug[0];

      const pageConfig = await db()
        .select()
        .from(statusPages)
        .where(eq(statusPages.projectId, projectData.id))
        .limit(1);

      if (pageConfig.length > 0) {
        statusPage = pageConfig[0];
      }
    }

    if (!statusPage || !statusPage.published) {
      return NextResponse.json(
        { success: false, error: "Status page not found or not published" },
        { status: 404, headers: corsHeaders }
      );
    }

    // ── Agents ──────────────────────────────────────────────────────────────────
    const agentRows = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.projectId, projectData.id), eq(agents.showOnStatusPage, true)));

    // ── Cloud Monitors ──────────────────────────────────────────────────────────
    const monitorRows = await db()
      .select()
      .from(cloudMonitors)
      .where(and(eq(cloudMonitors.projectId, projectData.id), eq(cloudMonitors.showOnStatusPage, true)));

    // ── Open Incidents ──────────────────────────────────────────────────────────
    const allOpenIncidents = await db()
      .select()
      .from(incidents)
      .where(and(eq(incidents.projectId, projectData.id), eq(incidents.status, INCIDENT_STATUS.OPEN)));

    const agentIds = new Set(agentRows.map((a) => a.id));
    const openIncidents = allOpenIncidents.filter((inc) => inc.agentId && agentIds.has(inc.agentId));

    // ── Format Status ───────────────────────────────────────────────────────────
    const agentStatuses = agentRows.map((a) => ({
      id: a.id,
      name: a.name,
      kind: "agent" as const,
      type: "agent",
      status: computeDerivedStatus(a.offlineDeadlineAt, a.lastSeenAt),
      lastSeenAt: a.lastSeenAt ? a.lastSeenAt.toISOString() : null,
    }));

    const monitorStatuses = monitorRows.map((m) => ({
      id: m.id,
      name: m.name,
      kind: "monitor" as const,
      type: m.type,
      status: m.lastStatus === "up" ? "online" : m.lastStatus === "down" ? "offline" : "unknown",
      url: m.url,
      latencyMs: m.lastLatencyMs ?? null,
      lastCheckedAt: m.lastCheckedAt ? m.lastCheckedAt.toISOString() : null,
    }));

    const allServices = [...agentStatuses, ...monitorStatuses];

    const onlineCount = allServices.filter((s) => s.status === "online").length;
    const offlineCount = allServices.filter((s) => s.status === "offline").length;
    const unknownCount = allServices.filter((s) => s.status === "unknown").length;
    const allOnline = offlineCount === 0 && onlineCount > 0;
    const allUnknown = allServices.every((s) => s.status === "unknown");

    const overallStatus = allUnknown
      ? "Unknown"
      : allOnline
      ? "All Systems Operational"
      : "Degraded Performance";

    return NextResponse.json(
      {
        success: true,
        data: {
          title: statusPage.title,
          description: statusPage.description ?? null,
          customSlug: statusPage.customSlug ?? null,
          projectSlug: projectData.slug,
          overallStatus,
          summary: {
            total: allServices.length,
            online: onlineCount,
            offline: offlineCount,
            unknown: unknownCount,
          },
          services: allServices,
          incidents: openIncidents.map((inc) => ({
            id: inc.id,
            agentId: inc.agentId,
            type: inc.type,
            message: inc.message,
            startedAt: inc.startedAt.toISOString(),
          })),
          updatedAt: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("[public/status] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
