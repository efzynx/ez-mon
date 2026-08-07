// Tujuan: Halaman daftar agent — tampilkan semua agent, install modal, delete agent
// Caller: Next.js dashboard router (/dashboard/agents)
// Dependensi: /api/dashboard/overview, /api/dashboard/agents (DELETE), /api/dashboard/projects
// Main Functions: AgentsPage, InstallModal
// Side Effects: HTTP GET overview, DELETE agents

"use client";

import { useEffect, useState, useCallback } from "react";
import { Server, Plus, Activity, X, Trash2, Loader2, Box, Tags } from "lucide-react";
import Link from "next/link";
import type { DashboardAgent } from "@ezmon/shared";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InstallModal } from "@/components/install-modal";

export default function AgentsPage() {
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showTagsModal, setShowTagsModal] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      const res = await fetch("/api/dashboard/projects");
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setProjects(data.data);
        const savedId = localStorage.getItem("ezmon_active_project");
        const isValid = data.data.some((p: any) => p.id === savedId);
        setSelectedProject(isValid && savedId ? savedId : data.data[0].id);
      } else {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  const fetchAgents = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/overview?projectId=${selectedProject}`
      );
      const data = await res.json();
      if (data.success) {
        setAgents(data.data.agents);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);

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
  }, [fetchAgents]);

  async function handleDelete(e: React.MouseEvent, agentId: string, agentName: string) {
    e.stopPropagation(); // Jangan navigate ke detail page
    if (!confirm(`Delete agent "${agentName}"?\n\nThis will remove all associated data including incidents and metrics.`)) return;
    setDeletingId(agentId);
    try {
      const res = await fetch(`/api/dashboard/agents?agentId=${agentId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        // Optimistic remove dari list
        setAgents((prev) => prev.filter((a) => a.id !== agentId));
      } else {
        alert(data.error ?? "Failed to delete agent");
      }
    } catch {
      alert("Network error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveTags() {
    if (!editingAgentId) return;
    setSavingTags(true);
    const tagsArray = editingTags.split(",").map(t => t.trim()).filter(t => t.length > 0);
    try {
      const res = await fetch(`/api/dashboard/agents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: editingAgentId, tags: tagsArray })
      });
      const data = await res.json();
      if (data.success) {
        setAgents((prev) => prev.map(a => a.id === editingAgentId ? { ...a, tags: tagsArray } : a));
        setShowTagsModal(false);
      } else {
        alert(data.error || "Failed to update tags");
      }
    } catch {
      alert("Network error");
    } finally {
      setSavingTags(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2 font-mono text-sm">
            <span>Agents</span>
            <span className="text-xs">/</span>
            <span className="text-foreground">Production Cluster</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-1">Managed Agents</h1>
          <p className="text-muted-foreground text-sm">
            Monitoring {agents.length} active nodes across your project.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            onClick={() => setShowInstall(true)}
            disabled={!selectedProject}
            className="gap-2 w-full md:w-auto"
          >
            <Plus size={18} />
            Install New Agent
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl bg-card border border-border" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Server
              size={48}
              className="mx-auto mb-4 text-muted-foreground"
            />
            <h3 className="text-xl font-display font-bold mb-2 text-foreground">No agents yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm leading-relaxed">
              Add your first agent to start monitoring your servers. The agent
              runs as a lightweight process on your Linux server.
            </p>
            <Button
              onClick={() => setShowInstall(true)}
              className="gap-2"
            >
              <Plus size={18} />
              Add Your First Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold whitespace-nowrap uppercase text-[10px] tracking-wider text-muted-foreground h-10">Name</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap uppercase text-[10px] tracking-wider text-muted-foreground h-10">Status</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap uppercase text-[10px] tracking-wider text-muted-foreground h-10">System</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap uppercase text-[10px] tracking-wider text-muted-foreground h-10">Docker</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap uppercase text-[10px] tracking-wider text-muted-foreground h-10">CPU</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap uppercase text-[10px] tracking-wider text-muted-foreground h-10">RAM</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap uppercase text-[10px] tracking-wider text-muted-foreground text-right h-10">Last Seen</TableHead>
                  <TableHead className="h-10 w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => {
                  const isOnline = agent.derivedStatus === "online";
                  const cpuPct = agent.state?.cpuPct || 0;
                  const ramPct = agent.state?.memUsedMb && agent.state?.memTotalMb ? (agent.state.memUsedMb / agent.state.memTotalMb) * 100 : 0;
                  
                  return (
                    <TableRow 
                      key={agent.id}
                      onClick={() => window.location.href = `/dashboard/agents/${agent.id}`}
                      className={`group cursor-pointer transition-colors hover:bg-muted/50 ${!isOnline ? 'bg-destructive/5' : ''}`}
                    >
                      <TableCell className="whitespace-nowrap font-medium py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3">
                            <Server size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className={`font-mono ${isOnline ? 'text-primary' : 'text-muted-foreground'}`}>
                              {agent.name}
                            </span>
                          </div>
                          {agent.tags && agent.tags.length > 0 && (
                            <div className="flex items-center gap-1.5 ml-7">
                              {agent.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-muted/50 text-muted-foreground hover:bg-muted">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-4">
                        <Badge variant={isOnline ? "default" : "destructive"} className={`uppercase text-[10px] tracking-wider font-bold ${isOnline ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20' : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`}></span>
                          {agent.derivedStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{agent.os}/{agent.arch}</span>
                          {agent.version && agent.version.replace(/^v/, "").trim() !== "0.1.12" && agent.version !== "dev" && agent.version !== "vdev" && (
                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0 h-4 font-mono">
                              v{agent.version.replace(/^v/, "")} ➔ v0.1.12
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-4">
                        {agent.state?.containersRunning !== undefined && agent.state?.containersRunning !== null ? (
                          <div className="flex items-center gap-1.5 text-blue-400">
                            <Box size={14} />
                            <span className="font-mono text-xs font-semibold">{agent.state.containersRunning}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 font-mono text-xs">--</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap min-w-[140px] py-4">
                        {isOnline ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs text-muted-foreground">{cpuPct.toFixed(1)}%</span>
                            </div>
                            <Progress value={cpuPct} className={`h-1.5 ${cpuPct > 85 ? '[&>div]:bg-destructive' : ''}`} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 font-mono text-xs">--</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap min-w-[140px] py-4">
                        {isOnline ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs text-muted-foreground">{ramPct.toFixed(1)}%</span>
                            </div>
                            <Progress value={ramPct} className={`h-1.5 ${ramPct > 85 ? '[&>div]:bg-destructive' : ''}`} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 font-mono text-xs">--</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right py-4">
                        <span className={`font-mono text-xs ${!isOnline ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleTimeString() : 'Never'}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleDelete(e, agent.id, agent.name)}
                          disabled={deletingId === agent.id}
                          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100"
                          title="Delete agent"
                        >
                          {deletingId === agent.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />}
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="bg-muted/30 border-t border-border px-6 py-3 flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>Showing {agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
          </div>
        </Card>
      )}

      {showInstall && selectedProject && (
        <InstallModal
          projectId={selectedProject}
          onClose={() => setShowInstall(false)}
        />
      )}
    </div>
  );
}
