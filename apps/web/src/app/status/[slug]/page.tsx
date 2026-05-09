import { db } from "@/lib/db";
import { projects, agents, incidents, statusPages, cloudMonitors, eq, and } from "@ezmon/db";
import { computeDerivedStatus, INCIDENT_STATUS } from "@ezmon/shared";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicStatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Resolve slug: first try custom_slug on status_pages, then project.slug
  let projectData: typeof projects.$inferSelect | null = null;
  let statusPage: typeof statusPages.$inferSelect | null = null;

  // Try custom slug first
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
    // Fall back to project.slug
    const byProjectSlug = await db().select().from(projects).where(eq(projects.slug, slug)).limit(1);
    if (byProjectSlug.length === 0) notFound();
    projectData = byProjectSlug[0];

    const pageConfig = await db()
      .select()
      .from(statusPages)
      .where(eq(statusPages.projectId, projectData.id))
      .limit(1);
    if (pageConfig.length > 0) statusPage = pageConfig[0];
  }

  if (!statusPage || !statusPage.published) notFound();

  // ── Agents ────────────────────────────────────────────────────────────────────
  const agentRows = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.projectId, projectData.id), eq(agents.showOnStatusPage, true)));

  // ── Cloud Monitors ────────────────────────────────────────────────────────────
  const monitorRows = await db()
    .select()
    .from(cloudMonitors)
    .where(and(eq(cloudMonitors.projectId, projectData.id), eq(cloudMonitors.showOnStatusPage, true)));

  // ── Open Incidents (agents only for now) ──────────────────────────────────────
  const allOpenIncidents = await db()
    .select()
    .from(incidents)
    .where(and(eq(incidents.projectId, projectData.id), eq(incidents.status, INCIDENT_STATUS.OPEN)));

  const agentIds = new Set(agentRows.map((a) => a.id));
  const openIncidents = allOpenIncidents.filter((inc) => inc.agentId && agentIds.has(inc.agentId));

  // ── Derive statuses ───────────────────────────────────────────────────────────
  const agentStatuses = agentRows.map((a) => ({
    name: a.name,
    kind: "agent" as const,
    status: computeDerivedStatus(a.offlineDeadlineAt, a.lastSeenAt),
  }));

  const monitorStatuses = monitorRows.map((m) => ({
    name: m.name,
    kind: "monitor" as const,
    status: m.lastStatus === "up" ? "online" : m.lastStatus === "down" ? "offline" : "unknown",
    url: m.url,
    type: m.type,
    latencyMs: m.lastLatencyMs,
  }));

  const allServices = [...agentStatuses, ...monitorStatuses];

  const onlineCount = allServices.filter((s) => s.status === "online").length;
  const offlineCount = allServices.filter((s) => s.status === "offline").length;
  const allOnline = offlineCount === 0 && onlineCount > 0;
  const allUnknown = allServices.every((s) => s.status === "unknown");

  const overallStatus = allUnknown
    ? "Unknown"
    : allOnline
    ? "All Systems Operational"
    : "Degraded Performance";

  let statusColorClass = "";
  let badgeColorClass = "";

  if (allUnknown || allServices.length === 0) {
    statusColorClass = "text-muted-foreground border-border";
    badgeColorClass = "bg-muted text-muted-foreground";
  } else if (allOnline) {
    statusColorClass = "text-emerald-500 border-emerald-500/30";
    badgeColorClass = "bg-emerald-500 shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]";
  } else {
    statusColorClass = "text-amber-500 border-amber-500/30";
    badgeColorClass = "bg-amber-500 shadow-[0_0_15px_-3px_rgba(245,158,11,0.5)]";
  }

  return (
    <div className="min-h-screen px-4 py-16 max-w-2xl mx-auto font-sans bg-background text-foreground">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-display font-bold tracking-tight mb-2 text-foreground">
          {statusPage.title}
        </h1>
        {statusPage.description && (
          <p className="text-sm font-medium text-muted-foreground mt-3 max-w-xl mx-auto">
            {statusPage.description}
          </p>
        )}
      </div>

      {/* Overall status banner */}
      <Card className={`mb-8 border-2 ${statusColorClass} bg-card/50 backdrop-blur-sm shadow-lg transition-colors`}>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center">
          <div className={`w-4 h-4 rounded-full mb-4 ${badgeColorClass} ${allOnline ? "animate-pulse" : ""}`} />
          <p className={`text-2xl font-display font-bold ${statusColorClass.split(" ")[0]}`}>{overallStatus}</p>
          <p className="text-sm font-mono text-muted-foreground mt-2">
            <span className={onlineCount > 0 ? "text-emerald-500 font-bold" : ""}>{onlineCount} online</span>
            {" · "}
            <span className={offlineCount > 0 ? "text-amber-500 font-bold" : ""}>{offlineCount} offline</span>
          </p>
        </CardContent>
      </Card>

      {/* Services list */}
      <div className="space-y-3 mb-10">
        <h2 className="text-lg font-display font-semibold mb-4 text-foreground/90 border-b border-border pb-2">
          Services
        </h2>
        {allServices.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Activity className="mx-auto h-8 w-8 mb-3 opacity-20" />
              <p>No services configured</p>
            </CardContent>
          </Card>
        )}
        {agentStatuses.map((agent) => (
          <Card key={`agent-${agent.name}`} className="shadow-sm hover:border-border/80 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground">{agent.name}</span>
                <span className="ml-2 text-[10px] text-muted-foreground uppercase tracking-wider border border-border rounded px-1.5 py-0.5">agent</span>
              </div>
              <Badge
                variant="secondary"
                className={`uppercase text-[10px] tracking-wider font-bold ${
                  agent.status === "online"
                    ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                    : agent.status === "offline"
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : ""
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${agent.status === "online" ? "bg-emerald-500" : agent.status === "offline" ? "bg-destructive" : "bg-muted-foreground"}`} />
                {agent.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {monitorStatuses.map((monitor) => (
          <Card key={`monitor-${monitor.name}`} className="shadow-sm hover:border-border/80 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="font-medium text-foreground">{monitor.name}</span>
                <span className="ml-2 text-[10px] text-muted-foreground uppercase tracking-wider border border-border rounded px-1.5 py-0.5">
                  {monitor.type}
                </span>
                {monitor.latencyMs !== null && monitor.latencyMs !== undefined && monitor.status === "online" && (
                  <span className="ml-1.5 text-xs text-muted-foreground font-mono">{monitor.latencyMs}ms</span>
                )}
              </div>
              <Badge
                variant="secondary"
                className={`uppercase text-[10px] tracking-wider font-bold ${
                  monitor.status === "online"
                    ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                    : monitor.status === "offline"
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : ""
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${monitor.status === "online" ? "bg-emerald-500" : monitor.status === "offline" ? "bg-destructive" : "bg-muted-foreground"}`} />
                {monitor.status === "online" ? "up" : monitor.status === "offline" ? "down" : "unknown"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Incidents */}
      {openIncidents.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-display font-semibold mb-4 text-foreground/90 border-b border-border pb-2 flex items-center gap-2">
            <AlertTriangle size={18} className="text-destructive" />
            Active Incidents
          </h2>
          <div className="space-y-3">
            {openIncidents.map((inc) => (
              <Card key={inc.id} className="border-destructive/30 bg-destructive/5 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold uppercase tracking-wider text-destructive">
                      {inc.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {new Date(inc.startedAt).toLocaleString()}
                    </p>
                  </div>
                  {inc.message && <p className="text-sm text-foreground/80 mt-2">{inc.message}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-16 text-center text-xs font-mono text-muted-foreground border-t border-border pt-6">
        Powered by <span className="text-primary font-bold tracking-wider">EZMON</span> · Last updated{" "}
        {new Date().toLocaleString()}
      </div>
    </div>
  );
}
