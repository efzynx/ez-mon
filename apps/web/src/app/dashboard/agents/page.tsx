// Tujuan: Halaman daftar agent — tampilkan semua agent, install modal, delete agent
// Caller: Next.js dashboard router (/dashboard/agents)
// Dependensi: /api/dashboard/overview, /api/dashboard/agents (DELETE), /api/dashboard/projects
// Main Functions: AgentsPage, InstallModal
// Side Effects: HTTP GET overview, DELETE agents

"use client";

import { useEffect, useState, useCallback } from "react";
import { Server, Plus, Copy, Check, Activity, X, Trash2, Loader2 } from "lucide-react";
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

function InstallModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [detected, setDetected] = useState(false);
  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-hub.vercel.app";

  const installCmd = `curl -fsSL ${appUrl}/install.sh | EZMON_TOKEN=${projectId} sh`;

  function copyToClipboard() {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Poll setiap 5 detik — auto-close saat agent baru terdeteksi
  useEffect(() => {
    let initialCount: number | null = null;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/dashboard/overview?projectId=${projectId}`);
        const data = await res.json();
        if (!data.success) return;
        const count: number = data.data.totalAgents;
        if (initialCount === null) { initialCount = count; return; }
        if (count > initialCount) {
          setDetected(true);
          clearInterval(poll);
          setTimeout(() => onClose(), 1800);
        }
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(poll);
  }, [projectId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card rounded-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border border-border">
        {/* Header */}
        <div className="bg-muted/30 border-b border-border px-6 py-5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">Install New Agent</h2>
            <p className="text-sm text-muted-foreground mt-1">Deploy the EZMON agent to your infrastructure</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Command */}
          <div className="bg-background border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="bg-muted/50 border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary">1</div>
                <h3 className="font-semibold text-sm text-foreground">Run on target server (Linux, as root)</h3>
              </div>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
              </div>
            </div>
            <div className="p-5 bg-zinc-950 relative group flex flex-col gap-4">
              <div className="relative bg-black border border-zinc-800 rounded-md p-4 overflow-x-auto">
                <pre className="text-sm text-zinc-300 font-mono whitespace-pre"><span className="text-blue-400">curl</span> <span className="text-zinc-400">-fsSL</span> <span className="text-emerald-400">{appUrl}/install.sh</span> <span className="text-zinc-500">|</span> <span className="text-purple-400">EZMON_SERVER_URL</span><span className="text-zinc-300">=</span><span className="text-emerald-400">{appUrl}</span> <span className="text-purple-400">EZMON_TOKEN</span><span className="text-zinc-300">=</span><span className="text-orange-300">{projectId}</span> <span className="text-blue-400">sh</span></pre>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 h-8 w-8 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </Button>
              </div>
              <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                <Server size={16} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-200/70 leading-relaxed">
                  The script auto-detects your system architecture, installs the binary to{" "}
                  <code className="font-mono">/usr/local/bin/ezmon-agent</code>, and configures a systemd service.
                </p>
              </div>
            </div>
          </div>

          {/* DEV mode notice */}
          <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 text-xs text-yellow-200/80">
            <span className="text-yellow-400 font-bold shrink-0 mt-0.5">DEV</span>
            <span className="leading-relaxed">
              In <strong>monorepo (localhost)</strong> mode, the script will <strong>build the binary from source</strong>{" "}
              using the detected Go compiler, then install to{" "}
              <code className="font-mono bg-black/30 px-1 rounded">/usr/local/bin/ezmon-agent</code>{" "}
              and configure the systemd service. Run with <code className="font-mono bg-black/30 px-1 rounded">sudo</code> if needed.
            </span>
          </div>

          {/* Heartbeat status */}
          {detected ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5 flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/20 rounded-full shrink-0">
                <Activity size={18} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-emerald-400">Agent detected!</h3>
                <p className="text-xs text-muted-foreground mt-1">Heartbeat received. Closing automatically...</p>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4 border-l-4 border-l-primary/50">
              <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                <div className="absolute inset-0 rounded-full border-2 border-muted" />
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <Activity size={16} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Waiting for heartbeat...</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Run the command on your target server. This dialog closes automatically once the agent is detected.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      const res = await fetch("/api/dashboard/projects");
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setProjects(data.data);
        setSelectedProject(data.data[0].id);
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
    return () => clearInterval(interval);
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
          {projects.length > 1 && (
            <select
              value={selectedProject ?? ""}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-card border border-border rounded-md py-2 px-3 text-sm text-foreground focus:outline-none focus:border-primary flex-1 md:flex-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
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
                        <div className="flex items-center gap-3">
                          <Server size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className={`font-mono ${isOnline ? 'text-primary' : 'text-muted-foreground'}`}>
                            {agent.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-4">
                        <Badge variant={isOnline ? "default" : "destructive"} className={`uppercase text-[10px] tracking-wider font-bold ${isOnline ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20' : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`}></span>
                          {agent.derivedStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground font-mono text-xs py-4">
                        {agent.os}/{agent.arch}
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
