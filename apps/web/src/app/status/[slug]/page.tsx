import { db } from "@/lib/db";
import { projects, agents, incidents, statusPages, eq, and } from "@ezmon/db";
import { computeDerivedStatus, INCIDENT_STATUS } from "@ezmon/shared";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicStatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await db().select().from(projects).where(eq(projects.slug, slug)).limit(1);
  if (project.length === 0) notFound();

  const projectData = project[0];

  const pageConfig = await db().select().from(statusPages).where(eq(statusPages.projectId, projectData.id)).limit(1);
  if (pageConfig.length === 0 || !pageConfig[0].published) notFound();
  const statusPage = pageConfig[0];

  const agentRows = await db().select().from(agents).where(and(eq(agents.projectId, projectData.id), eq(agents.showOnStatusPage, true)));
  const allOpenIncidents = await db().select().from(incidents)
    .where(and(eq(incidents.projectId, projectData.id), eq(incidents.status, INCIDENT_STATUS.OPEN)));
  
  const agentIds = new Set(agentRows.map(a => a.id));
  const openIncidents = allOpenIncidents.filter(inc => agentIds.has(inc.agentId));


  const agentStatuses = agentRows.map((a) => ({
    name: a.name,
    status: computeDerivedStatus(a.offlineDeadlineAt, a.lastSeenAt),
  }));

  const onlineCount = agentStatuses.filter((a) => a.status === "online").length;
  const offlineCount = agentStatuses.filter((a) => a.status === "offline").length;
  const allOnline = offlineCount === 0 && onlineCount > 0;
  const allUnknown = agentStatuses.every((a) => a.status === "unknown");

  const overallStatus = allUnknown ? "Unknown" : allOnline ? "All Systems Operational" : "Degraded Performance";
  
  // Choose theme colors based on state
  let statusColorClass = "";
  let badgeColorClass = "";
  
  if (allUnknown) {
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
        <h1 className="text-4xl font-display font-bold tracking-tight mb-2 text-foreground">{statusPage.title}</h1>
        {statusPage.description && (
          <p className="text-sm font-medium text-muted-foreground mt-3 max-w-xl mx-auto">{statusPage.description}</p>
        )}
      </div>

      <Card className={`mb-8 border-2 ${statusColorClass} bg-card/50 backdrop-blur-sm shadow-lg transition-colors`}>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center">
          <div className={`w-4 h-4 rounded-full mb-4 ${badgeColorClass} ${allOnline ? 'animate-pulse' : ''}`} />
          <p className={`text-2xl font-display font-bold ${statusColorClass.split(' ')[0]}`}>{overallStatus}</p>
          <p className="text-sm font-mono text-muted-foreground mt-2">
            <span className={onlineCount > 0 ? "text-emerald-500 font-bold" : ""}>{onlineCount} online</span> · <span className={offlineCount > 0 ? "text-amber-500 font-bold" : ""}>{offlineCount} offline</span>
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3 mb-10">
        <h2 className="text-lg font-display font-semibold mb-4 text-foreground/90 border-b border-border pb-2">Services</h2>
        {agentStatuses.map((agent) => (
          <Card key={agent.name} className="shadow-sm hover:border-border/80 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="font-medium text-foreground">{agent.name}</span>
              <Badge variant={agent.status === "online" ? "default" : agent.status === "offline" ? "destructive" : "secondary"} className={`uppercase text-[10px] tracking-wider font-bold ${agent.status === "online" ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : agent.status === "offline" ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${agent.status === "online" ? 'bg-emerald-500' : agent.status === "offline" ? 'bg-destructive' : 'bg-muted-foreground'}`}></span>
                {agent.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {agentStatuses.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Activity className="mx-auto h-8 w-8 mb-3 opacity-20" />
              <p>No services configured</p>
            </CardContent>
          </Card>
        )}
      </div>

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
                    <p className="text-sm font-bold uppercase tracking-wider text-destructive">{inc.type.replace(/_/g, " ")}</p>
                    <p className="text-xs font-mono text-muted-foreground">{new Date(inc.startedAt).toLocaleString()}</p>
                  </div>
                  {inc.message && <p className="text-sm text-foreground/80 mt-2">{inc.message}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-16 text-center text-xs font-mono text-muted-foreground border-t border-border pt-6">
        Powered by <span className="text-primary font-bold tracking-wider">EZMON</span> · Last updated {new Date().toLocaleString()}
      </div>
    </div>
  );
}
