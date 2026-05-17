/**
 * Tujuan: Slide-over panel detail untuk satu Cloud Monitor
 * Caller: cloud-monitors.tsx (klik baris monitor)
 * Dependensi: MonitorHistoryChart, lucide-react, Button (shadcn)
 * Main Functions: MonitorDetailPanel
 * Side Effects: none (data di-pass dari parent)
 */

"use client";

import { useEffect } from "react";
import {
  X,
  Globe,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Loader2,
  ExternalLink,
  Calendar,
  AlertTriangle,
  Activity,
  Key,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MonitorHistoryChart } from "@/app/dashboard/monitors/history-chart";

// ─── Types ─────────────────────────────────────────────────────────────────────

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

interface MonitorDetailPanelProps {
  monitor: CloudMonitor;
  onClose: () => void;
  onCheckNow: (monitor: CloudMonitor) => void;
  onToggle: (monitor: CloudMonitor) => void;
  onDelete: (id: string) => void;
  checkingId: string | null;
  togglingId: string | null;
  deletingId: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatInterval(sec: number) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatRelative(iso: string | null) {
  if (!iso) return "Never";
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// ─── TLS Expiry Gauge ─────────────────────────────────────────────────────────

function TlsExpiryGauge({ tlsExpiresAt }: { tlsExpiresAt: string | null }) {
  if (!tlsExpiresAt) {
    return (
      <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-center">
        <Shield size={20} className="mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">TLS expiry not yet checked</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Run "Check Now" to fetch certificate info</p>
      </div>
    );
  }

  const daysLeft = Math.floor((new Date(tlsExpiresAt).getTime() - Date.now()) / 86400000);
  const maxDays = 90; // referensi Let's Encrypt
  const pct = Math.min(Math.max((daysLeft / maxDays) * 100, 0), 100);

  const color = daysLeft <= 7
    ? { bar: "#ef4444", text: "text-red-400", label: "Critical" }
    : daysLeft <= 30
    ? { bar: "#f59e0b", text: "text-amber-400", label: "Expiring Soon" }
    : { bar: "#10b981", text: "text-emerald-400", label: "Valid" };

  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className={color.text} />
          <span className="text-xs font-medium text-foreground">SSL Certificate</span>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] h-5 border-current ${color.text}`}
        >
          {color.label}
        </Badge>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
          <span>Expiry</span>
          <span className={`font-bold tabular-nums ${color.text}`}>
            {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
          </span>
        </div>
        <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color.bar }}
          />
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Expires on</span>
        <span className="tabular-nums">{new Date(tlsExpiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
      </div>
    </div>
  );
}

// ─── Status Header ────────────────────────────────────────────────────────────

function StatusHeader({ status }: { status: LastStatus }) {
  if (status === "up") {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <div className="relative">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
        </div>
        <div>
          <div className="text-sm font-bold text-emerald-400">Operational</div>
          <div className="text-[10px] text-emerald-400/60">Monitor is responding normally</div>
        </div>
      </div>
    );
  }
  if (status === "down") {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
        <XCircle size={20} className="text-red-400" />
        <div>
          <div className="text-sm font-bold text-red-400">Down</div>
          <div className="text-[10px] text-red-400/60">Monitor is not responding</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-muted/30 border border-border/50">
      <HelpCircle size={20} className="text-muted-foreground" />
      <div>
        <div className="text-sm font-bold text-muted-foreground">Pending</div>
        <div className="text-[10px] text-muted-foreground/60">Waiting for first check</div>
      </div>
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value, mono = false }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
        <Icon size={12} />
        {label}
      </div>
      <div className={`text-xs text-right ${mono ? "font-mono" : ""} text-foreground/80 max-w-[60%] break-all`}>
        {value}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function MonitorDetailPanel({
  monitor,
  onClose,
  onCheckNow,
  onToggle,
  onDelete,
  checkingId,
  togglingId,
  deletingId,
}: MonitorDetailPanelProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const typeConfig = {
    http: { icon: Globe, label: "HTTP Status", color: "text-primary", badgeClass: "border-primary/30 text-primary" },
    tls: { icon: Shield, label: "TLS/SSL", color: "text-blue-400", badgeClass: "border-blue-400/30 text-blue-400" },
    keyword: { icon: Search, label: "Keyword", color: "text-amber-400", badgeClass: "border-amber-400/30 text-amber-400" },
  }[monitor.type];

  const TypeIcon = typeConfig.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full z-[70] w-full max-w-md bg-background border-l border-border/60 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header — sticky agar tombol X selalu terlihat saat scroll di mobile */}
        <div className="flex items-start justify-between p-5 border-b border-border/50 shrink-0 sticky top-0 bg-background z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 bg-muted rounded-lg shrink-0`}>
              <TypeIcon size={18} className={typeConfig.color} />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-foreground truncate">{monitor.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={`text-[10px] h-4 ${typeConfig.badgeClass}`}>
                  {typeConfig.label}
                </Badge>
                {monitor.status === "paused" && (
                  <Badge variant="secondary" className="text-[10px] h-4">Paused</Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Status */}
            <StatusHeader status={monitor.lastStatus} />

            {/* TLS Gauge — hanya untuk TLS monitor */}
            {monitor.type === "tls" && (
              <TlsExpiryGauge tlsExpiresAt={monitor.tlsExpiresAt} />
            )}

            {/* Keyword info — hanya untuk keyword monitor */}
            {monitor.type === "keyword" && monitor.keyword && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Key size={13} className="text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Keyword to Match</span>
                </div>
                <code className="text-sm font-mono bg-muted/50 px-2 py-1 rounded text-foreground">
                  {monitor.keyword}
                </code>
              </div>
            )}

            {/* URL */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={13} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Target URL</span>
              </div>
              <a
                href={monitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-mono text-primary hover:text-primary/80 transition-colors break-all"
              >
                <span>{monitor.url}</span>
                <ExternalLink size={11} className="shrink-0" />
              </a>
            </div>

            {/* Metrics */}
            <div className="rounded-xl bg-muted/30 border border-border/50">
              <div className="px-4 pt-3 pb-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                  Monitor Info
                </span>
              </div>
              <div className="px-4 pb-3">
                <InfoRow icon={Activity} label="Last Status" value={
                  <span className={monitor.lastStatus === "up" ? "text-emerald-400 font-semibold" : monitor.lastStatus === "down" ? "text-red-400 font-semibold" : "text-muted-foreground"}>
                    {monitor.lastStatus.toUpperCase()}
                  </span>
                } />
                {monitor.lastLatencyMs !== null && (
                  <InfoRow icon={Zap} label="Last Latency" value={`${monitor.lastLatencyMs}ms`} mono />
                )}
                <InfoRow icon={Clock} label="Last Checked" value={formatRelative(monitor.lastCheckedAt)} />
                <InfoRow icon={Clock} label="Check Interval" value={`Every ${formatInterval(monitor.intervalSec)}`} />
                <InfoRow icon={Clock} label="Timeout" value={`${monitor.timeoutSec}s`} />
                {monitor.expectedStatus && (
                  <InfoRow icon={Activity} label="Expected Status" value={monitor.expectedStatus.toString()} mono />
                )}
                <InfoRow icon={Calendar} label="Created" value={formatDateTime(monitor.createdAt)} />
              </div>
            </div>

            {/* History Chart */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <MonitorHistoryChart monitorId={monitor.id} />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            {/* Tombol Close — khusus mobile agar mudah dijangkau */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden gap-1.5 text-muted-foreground"
              onClick={onClose}
            >
              <X size={13} />
              Close
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              disabled={checkingId === monitor.id || monitor.status === "paused"}
              onClick={() => onCheckNow(monitor)}
            >
              {checkingId === monitor.id
                ? <Loader2 size={13} className="animate-spin" />
                : <RefreshCw size={13} />
              }
              Check Now
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={togglingId === monitor.id}
              onClick={() => onToggle(monitor)}
            >
              {togglingId === monitor.id
                ? <Loader2 size={13} className="animate-spin" />
                : monitor.status === "active"
                ? <Pause size={13} />
                : <Play size={13} />
              }
              {monitor.status === "active" ? "Pause" : "Resume"}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
              disabled={deletingId === monitor.id}
              onClick={() => onDelete(monitor.id)}
            >
              {deletingId === monitor.id
                ? <Loader2 size={13} className="animate-spin" />
                : <Trash2 size={13} />
              }
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
