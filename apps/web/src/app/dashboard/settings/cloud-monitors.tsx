/**
 * Tujuan: Komponen UI Cloud Monitors (Phase 5) — management CRUD di Settings page
 * Caller: apps/web/src/app/dashboard/settings/page.tsx (tab "Cloud Monitors")
 * Dependensi: /api/dashboard/cloud-monitors, /api/dashboard/cloud-monitors/check, Button, Card, Badge (shadcn/ui)
 * Main Functions: CloudMonitorsManagement (default export), AddMonitorModal, MonitorRow
 * Side Effects:
 *   - GET /api/dashboard/cloud-monitors?projectId=... (list monitors)
 *   - POST /api/dashboard/cloud-monitors (create)
 *   - POST /api/dashboard/cloud-monitors/check (manual inline check)
 *   - PATCH /api/dashboard/cloud-monitors (toggle status/update)
 *   - DELETE /api/dashboard/cloud-monitors?id=... (hapus)
 */

"use client";

import { useEffect, useState } from "react";
import {
  Globe,
  Plus,
  Loader2,
  X,
  Shield,
  Search,
  Pause,
  Play,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  BarChart2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MonitorHistoryChart } from "@/app/dashboard/monitors/history-chart";

// ─── Types ────────────────────────────────────────────────────────────────────

type MonitorType = "http" | "tls" | "keyword";
type MonitorStatus = "active" | "paused";
type LastStatus = "up" | "down" | "unknown";

interface CloudMonitor {
  id: string;
  projectId: string;
  name: string;
  url: string;
  type: MonitorType;
  intervalSec: number;
  timeoutSec: number;
  keyword: string | null;
  expectedStatus: number | null;
  status: MonitorStatus;
  lastStatus: LastStatus;
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  tlsExpiresAt: string | null;
  showOnStatusPage: boolean;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LastStatus }) {
  if (status === "up") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 size={13} />
        UP
      </span>
    );
  }
  if (status === "down") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
        <XCircle size={13} />
        DOWN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <HelpCircle size={13} />
      PENDING
    </span>
  );
}

function TypeIcon({ type }: { type: MonitorType }) {
  if (type === "tls") return <Shield size={15} className="text-blue-400" />;
  if (type === "keyword") return <Search size={15} className="text-amber-400" />;
  return <Globe size={15} className="text-primary" />;
}

function TypeLabel({ type }: { type: MonitorType }) {
  if (type === "tls") return <Badge variant="outline" className="text-[10px] h-5 border-blue-400/30 text-blue-400">TLS</Badge>;
  if (type === "keyword") return <Badge variant="outline" className="text-[10px] h-5 border-amber-400/30 text-amber-400">Keyword</Badge>;
  return <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">HTTP</Badge>;
}

function formatInterval(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

function formatLastChecked(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return d.toLocaleTimeString();
}

// ─── Add Monitor Modal ────────────────────────────────────────────────────────

interface AddMonitorModalProps {
  projectId: string;
  onClose: () => void;
  onCreated: (monitor: CloudMonitor) => void;
}

function AddMonitorModal({ projectId, onClose, onCreated }: AddMonitorModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("https://");
  const [type, setType] = useState<MonitorType>("http");
  const [intervalSec, setIntervalSec] = useState(60);
  const [timeoutSec, setTimeoutSec] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [expectedStatus, setExpectedStatus] = useState<string>("");
  const [showOnStatusPage, setShowOnStatusPage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !url.trim()) {
      setError("Name and URL are required");
      return;
    }
    if (type === "keyword" && !keyword.trim()) {
      setError("Keyword is required for keyword check type");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/cloud-monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          url: url.trim(),
          type,
          intervalSec,
          timeoutSec,
          keyword: type === "keyword" ? keyword.trim() : undefined,
          expectedStatus: expectedStatus ? parseInt(expectedStatus) : null,
          showOnStatusPage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onCreated(data.data);
        onClose();
      } else {
        setError(data.error || "Failed to create monitor");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-border">
          <div>
            <h3 className="font-display font-semibold text-foreground">Add Cloud Monitor</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Monitor a URL for uptime, TLS health, or keyword presence</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-md border border-destructive/20 bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/90">Monitor Name</label>
            <input
              required
              className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Main Website"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/90">URL</label>
            <input
              required
              type="url"
              className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="https://example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground/90">Check Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["http", "tls", "keyword"] as MonitorType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors ${
                    type === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <TypeIcon type={t} />
                  {t === "http" ? "HTTP Status" : t === "tls" ? "TLS/SSL" : "Keyword"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {type === "http" && "Checks if the URL returns the expected HTTP status code (default: any 2xx)."}
              {type === "tls" && "Verifies the SSL/TLS certificate is valid and shows days until expiry."}
              {type === "keyword" && "Fetches the page and checks if the specified keyword exists in the response body."}
            </p>
          </div>

          {type === "keyword" && (
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground/90">
                Keyword to Find <span className="text-destructive">*</span>
              </label>
              <input
                className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder='e.g. "System Operational"'
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
          )}

          {type === "http" && (
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground/90">Expected Status Code</label>
              <input
                type="number"
                className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Leave empty for any 2xx"
                value={expectedStatus}
                onChange={e => setExpectedStatus(e.target.value)}
                min={100}
                max={599}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground/90">Check Interval</label>
              <div className="relative">
                <select
                  value={intervalSec}
                  onChange={e => setIntervalSec(parseInt(e.target.value))}
                  className="w-full appearance-none bg-muted/50 border border-border rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes</option>
                  <option value={600}>10 minutes</option>
                  <option value={1800}>30 minutes</option>
                  <option value={3600}>1 hour</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground/90">Timeout</label>
              <div className="relative">
                <select
                  value={timeoutSec}
                  onChange={e => setTimeoutSec(parseInt(e.target.value))}
                  className="w-full appearance-none bg-muted/50 border border-border rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id="showOnStatusPage"
              checked={showOnStatusPage}
              onChange={e => setShowOnStatusPage(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <label htmlFor="showOnStatusPage" className="text-sm text-foreground/80">
              Show on public status page
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add Monitor
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CloudMonitorsManagement({ projects }: { projects: Project[] }) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      const savedId = localStorage.getItem("ezmon_active_project");
      const isValid = projects.some(p => p.id === savedId);
      setSelectedProject(isValid && savedId ? savedId : projects[0].id);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    const handleProjectChange = (e: any) => {
      if (e.detail?.id) setSelectedProject(e.detail.id);
    };
    window.addEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange as EventListener);
  }, []);
  const [monitors, setMonitors] = useState<CloudMonitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    fetch(`/api/dashboard/cloud-monitors?projectId=${selectedProject}`)
      .then(r => r.json())
      .then(d => { if (d.success) setMonitors(d.data); })
      .finally(() => setLoading(false));
  }, [selectedProject]);

  async function handleToggle(monitor: CloudMonitor) {
    setTogglingId(monitor.id);
    const newStatus = monitor.status === "active" ? "paused" : "active";
    try {
      const res = await fetch("/api/dashboard/cloud-monitors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: monitor.id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setMonitors(prev =>
          prev.map(m => m.id === monitor.id ? { ...m, status: newStatus } : m)
        );
      }
    } catch { /* silent */ } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this monitor? All check history will be removed.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/dashboard/cloud-monitors?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMonitors(prev => prev.filter(m => m.id !== id));
      }
    } catch { /* silent */ } finally {
      setDeletingId(null);
    }
  }

  async function handleCheckNow(monitor: CloudMonitor) {
    setCheckingId(monitor.id);
    try {
      const res = await fetch("/api/dashboard/cloud-monitors/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorId: monitor.id }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state dengan hasil check terbaru
        setMonitors(prev =>
          prev.map(m =>
            m.id === monitor.id
              ? {
                  ...m,
                  lastStatus: data.data.status,
                  lastLatencyMs: data.data.latencyMs,
                  lastCheckedAt: new Date().toISOString(),
                  ...(data.data.tlsDaysRemaining !== null
                    ? { tlsExpiresAt: new Date(Date.now() + data.data.tlsDaysRemaining * 86400000).toISOString() }
                    : {}),
                }
              : m
          )
        );
      }
    } catch { /* silent */ } finally {
      setCheckingId(null);
    }
  }

  if (!projects.length) {
    return (
      <div className="mt-2 p-8 text-center text-muted-foreground text-sm">
        Create a project first to add cloud monitors.
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2 font-mono text-sm">
            <span>Monitors</span>
            <span className="text-xs">/</span>
            <span className="text-foreground">External Services</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-1">Cloud Monitors</h1>
          <p className="text-muted-foreground text-sm">
            Monitor external URLs for uptime and SSL health. Max 20 per project.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button 
            disabled={!selectedProject}
            className="gap-2 w-full md:w-auto" 
            onClick={() => setShowAdd(true)}
          >
            <Plus size={18} />
            Add Monitor
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Total Monitors", value: monitors.length, icon: Globe },
          { label: "Currently Up", value: monitors.filter(m => m.lastStatus === "up").length, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Currently Down", value: monitors.filter(m => m.lastStatus === "down").length, icon: XCircle, color: "text-red-400" },
        ].map(stat => (
          <Card key={stat.label} className="bg-card/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-muted rounded-md">
                <stat.icon size={14} className={stat.color ?? "text-muted-foreground"} />
              </div>
              <div>
                <div className={`text-xl font-bold font-display ${stat.color ?? "text-foreground"}`}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monitors Table */}
      <Card>
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <h3 className="font-medium text-sm">Active Monitors</h3>
          <span className="text-xs text-muted-foreground">{monitors.length} / 20</span>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="animate-spin mx-auto mb-2" size={24} />
              Loading monitors...
            </div>
          ) : monitors.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                <Globe size={32} className="text-muted-foreground/50" />
              </div>
              <p className="text-sm mb-1 font-medium">No monitors yet</p>
              <p className="text-xs mb-4">Add a URL to start monitoring uptime, TLS expiry, or keyword presence.</p>
              <Button size="sm" className="gap-2" onClick={() => setShowAdd(true)}>
                <Plus size={14} /> Add First Monitor
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {monitors.map(monitor => (
                <div
                  key={monitor.id}
                  className="flex flex-col"
                >
                  {/* Monitor Row */}
                  <div className={`flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors ${
                    monitor.status === "paused" ? "opacity-60" : ""
                  }`}>
                  {/* Left: Icon + Type */}
                  <div className="p-2 bg-muted rounded-md shrink-0">
                    <TypeIcon type={monitor.type} />
                  </div>

                  {/* Center: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-foreground truncate">{monitor.name}</span>
                      <TypeLabel type={monitor.type} />
                      {monitor.status === "paused" && (
                        <Badge variant="secondary" className="text-[10px] h-5">Paused</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <a
                        href={monitor.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground flex items-center gap-1 truncate max-w-xs transition-colors"
                      >
                        <span className="truncate">{monitor.url}</span>
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                    </div>
                    {monitor.type === "tls" && monitor.tlsExpiresAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        TLS expires: {new Date(monitor.tlsExpiresAt).toLocaleDateString()}
                        {(() => {
                          const days = Math.floor((new Date(monitor.tlsExpiresAt).getTime() - Date.now()) / 86400000);
                          return days <= 30
                            ? <span className="ml-1.5 text-amber-400 font-medium">({days}d left)</span>
                            : <span className="ml-1.5 text-emerald-400">({days}d left)</span>;
                        })()}
                      </div>
                    )}
                    {monitor.type === "keyword" && monitor.keyword && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Keyword: <code className="font-mono bg-muted px-1 rounded">{monitor.keyword}</code>
                      </div>
                    )}
                  </div>

                  {/* Right: Status + Metrics + Actions */}
                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-right hidden sm:block">
                      <StatusBadge status={monitor.lastStatus} />
                      {monitor.lastLatencyMs !== null && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{monitor.lastLatencyMs}ms</div>
                      )}
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock size={10} />
                        {formatLastChecked(monitor.lastCheckedAt)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">every {formatInterval(monitor.intervalSec)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Check now"
                        disabled={checkingId === monitor.id || monitor.status === "paused"}
                        onClick={() => handleCheckNow(monitor)}
                      >
                        {checkingId === monitor.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <RefreshCw size={14} />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 transition-colors ${
                          expandedId === monitor.id
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="View history"
                        onClick={() => setExpandedId(prev => prev === monitor.id ? null : monitor.id)}
                      >
                        <BarChart2 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={monitor.status === "active" ? "Pause monitor" : "Resume monitor"}
                        disabled={togglingId === monitor.id}
                        onClick={() => handleToggle(monitor)}
                      >
                        {togglingId === monitor.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : monitor.status === "active"
                            ? <Pause size={14} />
                            : <Play size={14} />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete monitor"
                        disabled={deletingId === monitor.id}
                        onClick={() => handleDelete(monitor.id)}
                      >
                        {deletingId === monitor.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </Button>
                    </div>
                  </div>
                  </div>
                  {/* ↑ end of inner monitor row */}

                  {/* Expandable History Chart */}
                  {expandedId === monitor.id && (
                    <MonitorHistoryChart monitorId={monitor.id} />
                  )}
                </div>
              
              ))}


            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Modal */}
      {showAdd && selectedProject && (
        <AddMonitorModal
          projectId={selectedProject}
          onClose={() => setShowAdd(false)}
          onCreated={monitor => setMonitors(prev => [...prev, monitor])}
        />
      )}
    </div>
  );
}
