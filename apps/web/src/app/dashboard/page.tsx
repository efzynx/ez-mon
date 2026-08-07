"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle, Server, Activity, Terminal, Box, Plus, Copy, Globe, MonitorUp } from "lucide-react";
import Link from "next/link";
import type { DashboardOverview } from "@ezmon/shared";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { InstallModal } from "@/components/install-modal";
import { GlobalAgentMap } from "./overview/GlobalAgentMap";

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [projects, setProjects] = useState<
    { id: string; name: string; slug: string }[]
  >([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/dashboard/projects");
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          setProjects(data.data);
          const savedId = localStorage.getItem("ezmon_active_project");
          const isValid = data.data.some((p: any) => p.id === savedId);
          setSelectedProject(isValid && savedId ? savedId : data.data[0].id);
        }
      } catch {
        setError("Failed to load projects");
      }
    }
    fetchProjects();
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!selectedProject) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/dashboard/overview?projectId=${selectedProject}`
      );
      const data = await res.json();
      if (data.success) {
        setOverview(data.data);
      } else {
        setError(data.error || "Failed to load overview");
      }
    } catch {
      setError("Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 30000);
    
    const handleProjectChange = (e: any) => {
      if (e.detail?.id) {
        setSelectedProject(e.detail.id);
        setLoading(true);
      }
    };
    window.addEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    };
  }, [fetchOverview]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in mt-2">
        <div className="flex items-center justify-between">
          <div className="skeleton h-10 w-64 rounded bg-muted" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl bg-card border border-border" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
          <div className="lg:col-span-8 bg-card border border-border rounded-xl p-6">
            <div className="skeleton h-8 w-48 mb-6 bg-muted" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-24 rounded-lg bg-muted/50" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 bg-card border border-border rounded-xl p-6">
            <div className="skeleton h-8 w-32 mb-6 bg-muted" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 rounded-lg bg-muted/50" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in">
        <div className="p-6 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
          <Server size={48} className="text-primary" />
        </div>
        <h2 className="text-3xl font-display font-bold mb-2 text-foreground">Welcome to EZMON</h2>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Create your first project to start monitoring your servers in real-time.
        </p>
        <Link href="/dashboard/settings">
          <Button size="lg" className="gap-2">
            <Plus size={20} />
            Create Project
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">System Overview</h1>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Button className="gap-2 w-full sm:w-auto" onClick={() => setShowInstall(true)} disabled={!selectedProject}>
            <Plus size={18} />
            Install Agent
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-8 font-medium">
          {error}
        </div>
      )}

      {overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1"><Server size={14}/> Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-foreground">{overview.totalAgents}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1"><Globe size={14}/> Monitors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-foreground">{overview.totalMonitors ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Online Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <div className="text-3xl font-mono font-bold text-emerald-500">{(overview.onlineAgents || 0) + (overview.onlineMonitors || 0)}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Offline Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${(overview.offlineAgents || 0) + (overview.offlineMonitors || 0) > 0 ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-muted-foreground'}`}></span>
                  <div className={`text-3xl font-mono font-bold ${(overview.offlineAgents || 0) + (overview.offlineMonitors || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {(overview.offlineAgents || 0) + (overview.offlineMonitors || 0)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-2 md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1"><AlertTriangle size={14}/> Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${overview.openIncidents > 0 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-muted-foreground'}`}></span>
                  <div className={`text-3xl font-mono font-bold ${overview.openIncidents > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    {overview.openIncidents}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            <Card className="lg:col-span-8 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-display">Latest Host Status</CardTitle>
                  <CardDescription>Real-time metrics from your connected agents.</CardDescription>
                </div>
                <Link href="/dashboard/agents">
                  <Button variant="link" className="text-primary hover:text-primary/80 px-0">
                    View All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="flex-1">
                {overview.agents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-border rounded-xl bg-muted/10">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                      <Server size={32} className="text-primary" />
                    </div>
                    <h3 className="text-2xl font-display font-bold mb-3 text-foreground">Awaiting First Agent</h3>
                    <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
                      Your project is ready! Install the lightweight EZMON agent on your Linux server to begin streaming real-time metrics.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button size="lg" className="gap-2" onClick={() => setShowInstall(true)}>
                        <Terminal size={18} />
                        Get Installation Command
                      </Button>
                      <Link href="/dashboard/settings">
                        <Button size="lg" variant="outline" className="gap-2">
                          Configure Settings
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-4">
                    {overview.agents.map((agent) => {
                      const isOnline = agent.derivedStatus === "online";
                      const cpuPct = agent.state?.cpuPct || 0;
                      const ramPct = agent.state?.memUsedMb && agent.state?.memTotalMb ? (agent.state.memUsedMb / agent.state.memTotalMb) * 100 : 0;

                      return (
                        <Link
                          href={`/dashboard/agents/${agent.id}`}
                          key={agent.id}
                          className="block"
                        >
                          <div className="bg-background border border-border p-5 rounded-xl hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer group shadow-sm h-full flex flex-col justify-between gap-6">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded-md group-hover:bg-primary/10 transition-colors">
                                  <Terminal size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                  <div className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">{agent.name}</div>
                                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    <div className="text-xs text-muted-foreground font-mono line-clamp-1">{agent.os || "Unknown OS"}</div>
                                    {agent.state?.containersRunning !== undefined && agent.state?.containersRunning !== null && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-none font-semibold flex items-center">
                                        <Box size={10} className="mr-1" />
                                        {agent.state.containersRunning}
                                      </Badge>
                                    )}
                                    {agent.tags && agent.tags.length > 0 && agent.tags.map(tag => (
                                      <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-muted/50 text-muted-foreground">{tag}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <Badge variant={isOnline ? "default" : "destructive"} className={`uppercase text-[10px] tracking-wider font-bold ${isOnline ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20' : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500' : 'bg-destructive'}`}></span>
                                {agent.derivedStatus}
                              </Badge>
                            </div>

                            <div className={`flex gap-4 ${!isOnline ? 'opacity-50' : ''}`}>
                              <div className="flex-1 space-y-1.5">
                                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                                  <span>CPU</span>
                                  <span>{isOnline ? `${cpuPct.toFixed(0)}%` : '--'}</span>
                                </div>
                                <Progress value={isOnline ? cpuPct : 0} className="h-1.5" />
                              </div>
                              <div className="flex-1 space-y-1.5">
                                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                                  <span>RAM</span>
                                  <span>{isOnline ? `${ramPct.toFixed(0)}%` : '--'}</span>
                                </div>
                                <Progress value={isOnline ? ramPct : 0} className="h-1.5" />
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-display">Recent Incidents</CardTitle>
                  <CardDescription>Alerts from the last 24 hours.</CardDescription>
                </div>
                <Link href="/dashboard/incidents">
                  <Button variant="link" className="text-primary hover:text-primary/80 px-0">
                    View All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="flex-1 pt-4">
                {overview.recentIncidents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-xl">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                      <Activity size={24} className="text-emerald-500" />
                    </div>
                    <p className="text-foreground font-medium">All systems healthy</p>
                    <p className="text-muted-foreground text-sm mt-1">No recent incidents reported.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {overview.recentIncidents.map((incident) => (
                      <div key={incident.id} className="p-3 border border-transparent hover:border-border hover:bg-muted/50 flex gap-3 items-start group cursor-pointer rounded-lg transition-colors">
                        {incident.status === "open" ? (
                          <div className="p-1.5 bg-destructive/10 rounded-md">
                            <AlertTriangle size={16} className="text-destructive" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-emerald-500/10 rounded-md">
                            <CheckCircle size={16} className="text-emerald-500" />
                          </div>
                        )}
                        <div className="flex-1 overflow-hidden">
                          <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {incident.agentName}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                            {new Date(incident.startedAt).toLocaleString()} • {incident.type}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Map Section */}
          <div className="grid grid-cols-1 mt-6">
            <GlobalAgentMap agents={overview.agents} />
          </div>
        </>
      )}

      {showInstall && selectedProject && (
        <InstallModal 
          projectId={selectedProject} 
          onClose={() => {
            setShowInstall(false);
            setLoading(true);
            fetchOverview();
          }} 
        />
      )}
    </div>
  );
}
