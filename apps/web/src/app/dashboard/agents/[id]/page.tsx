// Tujuan: Halaman detail agent — tampilkan metrics, metadata, dan aksi delete agent
// Caller: Next.js dashboard router (/dashboard/agents/[id])
// Dependensi: /api/dashboard/overview, /api/dashboard/agents (DELETE), /api/dashboard/projects
// Main Functions: AgentDetailPage
// Side Effects: HTTP GET overview, DELETE agents

"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Server, Activity, MemoryStick, HardDrive, Cpu, Terminal, ArrowLeft, RefreshCw, Clock, Trash2, Loader2, X, AlertTriangle, Copy, Check, Box, Tags, Plus, Pencil, ArrowUpCircle } from "lucide-react";
import Link from "next/link";
import type { DashboardOverview, DashboardAgent } from "@ezmon/shared";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AgentCharts } from "./AgentCharts";
import { AgentLocationMap } from "./AgentLocationMap";
import { UpdateAgentModal } from "@/components/update-agent-modal";

const HUB_VERSION = "0.1.10";

function isOutdatedVersion(agentVer?: string | null, hubVer = HUB_VERSION) {
  if (!agentVer) return false;
  const cleanAgent = agentVer.replace(/^v/, "").trim();
  const cleanHub = hubVer.replace(/^v/, "").trim();
  if (cleanAgent === "dev" || cleanAgent === "vdev") return false;
  return cleanAgent !== cleanHub;
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  
  const [agent, setAgent] = useState<DashboardAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<"cpu" | "ram" | "disk" | "load" | "net" | null>(null);
  
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [editingTags, setEditingTags] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  
  const [showNameModal, setShowNameModal] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [savingName, setSavingName] = useState(false);
  
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const fetchAgent = useCallback(async () => {
    try {
      const projRes = await fetch("/api/dashboard/projects");
      const projData = await projRes.json();
      
      if (!projData.success || !projData.data || projData.data.length === 0) {
        throw new Error("No project found");
      }
      
      const activeProjId = typeof window !== "undefined" ? localStorage.getItem("ezmon_active_project") : null;
      const isValid = projData.data.some((p: any) => p.id === activeProjId);
      const projectId = isValid && activeProjId ? activeProjId : projData.data[0].id;
      
      const res = await fetch(`/api/dashboard/overview?projectId=${projectId}`);
      const data = await res.json();
      
      if (data.success) {
        const overview: DashboardOverview = data.data;
        const found = overview.agents.find(a => a.id === id);
        if (found) {
          setAgent(found);
        } else {
          setError("Agent not found");
        }
      } else {
        setError(data.error || "Failed to load agent");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAgent();
    const interval = setInterval(fetchAgent, 30000); // 30s heartbeat
    return () => clearInterval(interval);
  }, [fetchAgent]);

  async function handleDelete() {
    if (!agent) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/agents?agentId=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        router.push("/dashboard/agents");
      } else {
        alert(data.error ?? "Failed to delete agent");
        setDeleting(false);
      }
    } catch {
      alert("Network error");
      setDeleting(false);
    }
  }

  async function handleSaveTags() {
    if (!agent) return;
    setSavingTags(true);
    const tagsArray = editingTags.split(",").map(t => t.trim()).filter(t => t.length > 0);
    try {
      const res = await fetch(`/api/dashboard/agents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: id, tags: tagsArray })
      });
      const data = await res.json();
      if (data.success) {
        setAgent({ ...agent, tags: tagsArray });
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

  async function handleSaveName() {
    if (!agent || !editingName.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/dashboard/agents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: id, name: editingName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setAgent({ ...agent, name: editingName.trim() });
        setShowNameModal(false);
      } else {
        alert(data.error || "Failed to update agent name");
      }
    } catch {
      alert("Network error");
    } finally {
      setSavingName(false);
    }
  }

  function copyCmd(cmd: string, key: string) {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in mt-2">
        <div className="skeleton h-8 w-64 bg-muted rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-32 bg-card border border-border rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/agents">
          <Button variant="ghost" className="gap-2 -ml-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft size={16} /> Back to Agents
          </Button>
        </Link>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-6 rounded-xl font-medium">
          <h2 className="text-lg font-bold mb-2">Error Loading Agent</h2>
          <p>{error || "Agent not found"}</p>
        </div>
      </div>
    );
  }

  const isOnline = agent.derivedStatus === "online";
  const cpuPct = agent.state?.cpuPct || 0;
  const ramPct = agent.state?.memUsedMb && agent.state?.memTotalMb ? (agent.state.memUsedMb / agent.state.memTotalMb) * 100 : 0;
  const diskPct = agent.state?.diskUsedMb && agent.state?.diskTotalMb ? (agent.state.diskUsedMb / agent.state.diskTotalMb) * 100 : 0;

  return (
    <>
      <div className="animate-fade-in w-full pb-12 flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
          <Link href="/dashboard/agents" className="hover:text-primary transition-colors">Agents</Link>
          <span className="text-xs">/</span>
          <span className="text-foreground font-medium">{agent.name}</span>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">{agent.name}</h1>
              <Button variant="ghost" size="icon" onClick={() => { setEditingName(agent.name); setShowNameModal(true); }} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Pencil size={16} />
              </Button>
            </div>
            <Badge variant={isOnline ? "default" : "destructive"} className={`uppercase text-[10px] tracking-wider font-bold ${isOnline ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20' : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20'}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`}></span>
              {agent.derivedStatus}
            </Badge>
          </div>
          
          <div className="flex gap-3">
            {isOutdatedVersion(agent.version) && (
              <Button
                variant="outline"
                onClick={() => setShowUpdateModal(true)}
                className="gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/60"
              >
                <ArrowUpCircle size={16} /> Update Agent
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={fetchAgent}
              className="gap-2"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(true)}
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
            >
              <Trash2 size={16} /> Delete Agent
            </Button>
          </div>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-2 py-4 border-y border-border">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">OS:</span>
            <span className="font-mono text-foreground text-sm">{agent.os || 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Arch:</span>
            <span className="font-mono text-foreground text-sm">{agent.arch || 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Version:</span>
            <span className="font-mono text-foreground text-sm">
              {agent.version ? (agent.version.startsWith("v") ? agent.version : `v${agent.version}`) : "v0.1.9"}
            </span>
            {isOutdatedVersion(agent.version) && (
              <Badge
                onClick={() => setShowUpdateModal(true)}
                className="cursor-pointer bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/30 text-[10px] gap-1 font-mono"
              >
                <ArrowUpCircle size={12} className="text-amber-400" />
                Update Available ({HUB_VERSION.startsWith("v") ? HUB_VERSION : `v${HUB_VERSION}`})
              </Badge>
            )}
          </div>
          {agent.state?.containersRunning !== undefined && agent.state?.containersRunning !== null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Docker:</span>
              <span className="font-mono text-blue-400 font-bold text-sm flex items-center gap-1.5">
                <Box size={14} className="text-blue-500"/>
                {agent.state.containersRunning} Running
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Last Seen:</span>
            <span className="font-mono text-foreground text-sm flex items-center gap-1.5">
              <Clock size={14} className="text-muted-foreground"/>
              {agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleTimeString() : 'Never'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Tags:</span>
            <div className="flex items-center gap-1.5">
              {agent.tags && agent.tags.length > 0 ? (
                agent.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-[10px] bg-muted px-1.5 py-0 h-5 text-muted-foreground border-border flex items-center gap-1">
                    <Tags size={10} className="text-muted-foreground/70" />
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">No tags</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* CPU */}
        <Card 
          className={`relative overflow-hidden group hover:border-primary/50 transition-all cursor-pointer ${selectedMetric === 'cpu' ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : ''}`}
          onClick={() => setSelectedMetric(prev => prev === 'cpu' ? null : 'cpu')}
        >
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center z-10">
              <CardTitle className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">CPU USAGE</CardTitle>
              <Cpu size={16} className="text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 z-10 mt-1">
              <span className={`text-4xl font-mono font-bold ${!isOnline ? 'text-muted-foreground' : cpuPct > 85 ? 'text-destructive' : 'text-foreground'}`}>
                {isOnline ? cpuPct.toFixed(1) : '--'}
              </span>
              <span className="text-muted-foreground font-mono">%</span>
            </div>
            {isOnline && (
              <div className="absolute bottom-0 left-0 w-full h-1/3 opacity-20 bg-gradient-to-t from-primary/30 to-transparent z-0 pointer-events-none" />
            )}
          </CardContent>
        </Card>

        {/* RAM */}
        <Card 
          className={`relative overflow-hidden group hover:border-primary/50 transition-all flex flex-col cursor-pointer ${selectedMetric === 'ram' ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : ''}`}
          onClick={() => setSelectedMetric(prev => prev === 'ram' ? null : 'ram')}
        >
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center z-10">
              <CardTitle className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">RAM USAGE</CardTitle>
              <MemoryStick size={16} className="text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            <div className="flex items-baseline gap-2 z-10 mt-1 mb-6">
              <span className={`text-4xl font-mono font-bold ${!isOnline ? 'text-muted-foreground' : ramPct > 85 ? 'text-destructive' : 'text-foreground'}`}>
                {isOnline ? ((agent.state?.memUsedMb ?? 0) / 1024).toFixed(1) : '--'}
              </span>
              <span className="text-muted-foreground font-mono text-sm">
                GB / {agent.state?.memTotalMb ? (agent.state.memTotalMb / 1024).toFixed(1) : '--'}GB
              </span>
            </div>
            <Progress value={isOnline ? ramPct : 0} className={`h-1.5 w-full z-10 ${ramPct > 85 ? '[&>div]:bg-destructive' : '[&>div]:bg-indigo-400'}`} />
          </CardContent>
        </Card>

        {/* Disk */}
        <Card 
          className={`relative overflow-hidden group hover:border-primary/50 transition-all flex flex-col cursor-pointer ${selectedMetric === 'disk' ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : ''}`}
          onClick={() => setSelectedMetric(prev => prev === 'disk' ? null : 'disk')}
        >
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center z-10">
              <CardTitle className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">DISK USAGE</CardTitle>
              <HardDrive size={16} className="text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            <div className="flex items-baseline gap-2 z-10 mt-1 mb-6">
              <span className={`text-4xl font-mono font-bold ${!isOnline ? 'text-muted-foreground' : diskPct > 85 ? 'text-destructive' : 'text-foreground'}`}>
                {isOnline ? diskPct.toFixed(1) : '--'}
              </span>
              <span className="text-muted-foreground font-mono">%</span>
            </div>
            <Progress value={isOnline ? diskPct : 0} className={`h-1.5 w-full z-10 ${diskPct > 85 ? '[&>div]:bg-destructive' : '[&>div]:bg-emerald-400'}`} />
          </CardContent>
        </Card>

        {/* Load Avg */}
        <Card 
          className={`relative overflow-hidden group hover:border-primary/50 transition-all cursor-pointer ${selectedMetric === 'load' ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : ''}`}
          onClick={() => setSelectedMetric(prev => prev === 'load' ? null : 'load')}
        >
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center z-10">
              <CardTitle className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">LOAD AVG (1m)</CardTitle>
              <Activity size={16} className="text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3 z-10 mt-1 font-mono">
              <span className={`text-4xl font-mono font-bold ${!isOnline ? 'text-muted-foreground' : 'text-foreground'}`}>
                {isOnline ? agent.state?.load1?.toFixed(2) || '0.00' : '--'}
              </span>
            </div>
            {isOnline && (
              <div className="absolute bottom-0 left-0 w-full h-1/3 opacity-20 bg-gradient-to-t from-emerald-500/30 to-transparent z-0 pointer-events-none" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Network Stats */}
      <Card 
        className={`cursor-pointer transition-all hover:border-primary/50 ${selectedMetric === 'net' ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : ''}`}
        onClick={() => setSelectedMetric(prev => prev === 'net' ? null : 'net')}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-display">Network Traffic</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-emerald-500"></span>
              <span className="text-xs text-muted-foreground font-mono font-medium">RX</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-indigo-500"></span>
              <span className="text-xs text-muted-foreground font-mono font-medium">TX</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/30 rounded-xl border border-border/50 p-6 flex flex-col items-center justify-center">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-2">Receive (RX)</span>
              <span className="text-3xl font-mono font-bold text-emerald-500">
                 {isOnline ? ((agent.state?.netRxBps || 0) / 1024 / 1024).toFixed(2) : '0.00'} <span className="text-sm text-muted-foreground">MB/s</span>
              </span>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border/50 p-6 flex flex-col items-center justify-center">
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-2">Transmit (TX)</span>
              <span className="text-3xl font-mono font-bold text-indigo-500">
                 {isOnline ? ((agent.state?.netTxBps || 0) / 1024 / 1024).toFixed(2) : '0.00'} <span className="text-sm text-muted-foreground">MB/s</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Map */}
      <AgentLocationMap 
        lat={agent.lat}
        lon={agent.lon}
        country={agent.country}
        city={agent.city}
      />
      
      </div>

      {/* Metrics Detail Modal */}
      {selectedMetric && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedMetric(null)}
          />
          <div className="relative bg-card border border-border rounded-xl w-full max-w-6xl shadow-2xl animate-fade-in overflow-hidden h-[90vh] flex flex-col">
            <div className="flex-1 overflow-y-auto w-full h-full">
              <AgentCharts agentId={id} selectedMetric={selectedMetric} onClose={() => setSelectedMetric(null)} />
            </div>
          </div>
        </div>
      )}

    {/* Delete Agent Modal */}
    {showDeleteModal && agent && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={() => !deleting && setShowDeleteModal(false)}
        />
        <div className="relative bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden">
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">Delete Agent</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{agent.name}</p>
              </div>
            </div>
            {!deleting && (
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="p-6 space-y-5">
            {/* Warning */}
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-sm text-destructive/90 leading-relaxed">
              This will <strong>permanently delete</strong> the agent from the dashboard along with all associated data:{" "}
              <span className="font-mono text-xs">incidents, metrics, alert_events</span>.{" "}
              The agent process still running on the server <strong>will not stop automatically</strong> — it must be stopped manually.
            </div>

            {/* Uninstall steps */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                How to remove the agent from your Linux server:
              </p>
              <div className="space-y-2">
                {[
                  {
                    key: "stop",
                    label: "1. Stop & disable service",
                    cmd: "sudo systemctl stop ezmon-agent && sudo systemctl disable ezmon-agent",
                  },
                  {
                    key: "rm-bin",
                    label: "2. Remove binary",
                    cmd: "sudo rm -f /usr/local/bin/ezmon-agent",
                  },
                  {
                    key: "rm-service",
                    label: "3. Remove service file",
                    cmd: "sudo rm -f /etc/systemd/system/ezmon-agent.service && sudo systemctl daemon-reload",
                  },
                  {
                    key: "rm-env",
                    label: "4. Remove configuration",
                    cmd: "sudo rm -f /etc/ezmon/agent.env",
                  },
                ].map(({ key, label, cmd }) => (
                  <div key={key} className="bg-background rounded-md border border-border overflow-hidden">
                    <p className="px-3 pt-2 text-[10px] text-muted-foreground font-medium">{label}</p>
                    <div className="flex items-center gap-2 px-3 pb-2 group">
                      <code className="flex-1 text-xs font-mono text-foreground/80 truncate">{cmd}</code>
                      <button
                        onClick={() => copyCmd(cmd, key)}
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                        title="Copy"
                      >
                        {copiedCmd === key ? (
                          <Check size={12} className="text-emerald-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
            <button
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? (
                <><Loader2 size={14} className="animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 size={14} /> Delete Agent</>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Edit Name Modal */}
    {showNameModal && agent && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={() => !savingName && setShowNameModal(false)}
        />
        <div className="relative bg-card border border-border rounded-xl w-full max-w-sm shadow-2xl animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <h3 className="font-display font-bold text-foreground">Edit Agent Name</h3>
            {!savingName && (
              <button
                onClick={() => setShowNameModal(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="p-6">
            <label className="block text-sm font-medium mb-2 text-foreground/90">Agent Name</label>
            <input 
              className="bg-muted/50 border border-border rounded-md py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              autoFocus
            />
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
            <button
              onClick={() => setShowNameModal(false)}
              disabled={savingName}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveName}
              disabled={savingName || !editingName.trim()}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {savingName ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : "Save"}
            </button>
          </div>
        </div>
      </div>
    )}
    {/* Update Agent Modal */}
    {showUpdateModal && agent && (
      <UpdateAgentModal
        agentName={agent.name}
        currentVersion={agent.version || "0.0.0"}
        latestVersion={HUB_VERSION}
        onClose={() => setShowUpdateModal(false)}
      />
    )}
    </>
  );
}
