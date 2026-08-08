// Tujuan: Global Search — Command Palette Modal (Mac Spotlight / Raycast style) dengan pintasan keyboard CTRL+K / CMD+K
// Caller: Layout (apps/web/src/app/dashboard/layout.tsx) & global keyboard listener
// Dependensi: /api/dashboard/overview, /api/dashboard/cloud-monitors, /api/dashboard/incidents
// Main Functions: GlobalSearch
// Side Effects: Listen global keydown (Ctrl+K / Cmd+K), fetch search data across Agents, Cloud Monitors, & Incidents

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  Server,
  LayoutDashboard,
  AlertTriangle,
  Bell,
  Globe,
  Settings,
  MonitorCheck,
  ArrowRight,
  Loader2,
  User,
  Activity,
} from "lucide-react";
import type { DashboardAgent, DashboardIncident } from "@ezmon/shared";

// ─── Nav pages ──────────────────────────────────────────────────────────────

const NAV_PAGES = [
  { label: "Dashboard Overview", href: "/dashboard", icon: LayoutDashboard, description: "Real-time overview of system performance, incidents, and host metrics" },
  { label: "Agents Fleet", href: "/dashboard/agents", icon: Server, description: "Manage host monitoring agents and Linux servers" },
  { label: "Cloud Monitors", href: "/dashboard/monitors", icon: MonitorCheck, description: "Monitor HTTP availability, SSL certificates, & APIs" },
  { label: "Incidents Log", href: "/dashboard/incidents", icon: AlertTriangle, description: "View active and historical host downtime incidents" },
  { label: "Public Status Page", href: "/dashboard/status-page", icon: Globe, description: "Public status page accessible to teams and users" },
  { label: "Project Settings", href: "/dashboard/settings", icon: Settings, description: "Manage API keys, webhooks, & project configurations" },
  { label: "Profile Settings", href: "/dashboard/profile", icon: User, description: "Manage profile details, email, & password security" },
];

interface CloudMonitorItem {
  id: string;
  name: string;
  target: string;
  type: string;
  status: string;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultItem =
  | { kind: "page"; label: string; description: string; href: string; Icon: React.ElementType }
  | { kind: "agent"; label: string; description: string; href: string; status: string }
  | { kind: "monitor"; label: string; description: string; href: string; status: string; type: string }
  | { kind: "incident"; label: string; description: string; href: string; status: string; type: string };

// ─── Component ───────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  className?: string;
  collapsed?: boolean;
}

export function GlobalSearch({ className = "", collapsed = false }: GlobalSearchProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [monitors, setMonitors] = useState<CloudMonitorItem[]>([]);
  const [incidents, setIncidents] = useState<DashboardIncident[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Global Keyboard Listener for CTRL+K / CMD+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Auto focus input when modal opens
  useEffect(() => {
    if (modalOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      setQuery("");
      setActiveIndex(0);
    }
  }, [modalOpen]);

  // Load search resources (Agents, Cloud Monitors, Incidents)
  const loadSearchData = useCallback(async () => {
    const pid = localStorage.getItem("ezmon_active_project");
    if (!pid) return;
    try {
      const [overviewRes, monitorsRes, incidentsRes] = await Promise.all([
        fetch(`/api/dashboard/overview?projectId=${pid}`, { cache: "no-store" }),
        fetch(`/api/dashboard/cloud-monitors?projectId=${pid}`, { cache: "no-store" }),
        fetch(`/api/dashboard/incidents?projectId=${pid}&status=open&limit=20`, { cache: "no-store" }),
      ]);
      
      const overviewData = await overviewRes.json();
      const monitorsData = await monitorsRes.json();
      const incidentsData = await incidentsRes.json();

      if (overviewData.success && Array.isArray(overviewData.data?.agents)) {
        setAgents(overviewData.data.agents as DashboardAgent[]);
      }
      if (monitorsData.success && Array.isArray(monitorsData.data)) {
        setMonitors(monitorsData.data);
      }
      if (incidentsData.success && Array.isArray(incidentsData.data)) {
        setIncidents(incidentsData.data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (modalOpen) loadSearchData();
    const handleProjectChange = () => {
      if (modalOpen) loadSearchData();
    };
    window.addEventListener("ezmon_project_changed", handleProjectChange);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange);
  }, [modalOpen, loadSearchData]);

  // Search logic debounced
  useEffect(() => {
    if (!modalOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      // Default / empty query: show all NAV_PAGES as quick suggestions
      const defaultPages: ResultItem[] = NAV_PAGES.map((p) => ({
        kind: "page",
        label: p.label,
        description: p.description,
        href: p.href,
        Icon: p.icon,
      }));
      setResults(defaultPages);
      setActiveIndex(0);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const q = query.toLowerCase().trim();
      setLoading(true);

      const isDownKeyword = ["down", "offline", "error", "failed", "critical"].some((k) => k.includes(q) || q.includes(k));
      const isUpKeyword = ["up", "online", "healthy", "ok", "normal"].some((k) => k.includes(q) || q.includes(k));

      // 1. Pages
      const pageResults: ResultItem[] = NAV_PAGES.filter(
        (p) => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      ).map((p) => ({
        kind: "page",
        label: p.label,
        description: p.description,
        href: p.href,
        Icon: p.icon,
      }));

      // 2. Agents
      const agentResults: ResultItem[] = agents
        .filter((a) => {
          const status = (a.derivedStatus ?? a.status ?? "").toLowerCase();
          const matchesText =
            a.name.toLowerCase().includes(q) ||
            (a.hostname ?? "").toLowerCase().includes(q) ||
            (a.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
            status.includes(q);
          const matchesStatusFilter = (isDownKeyword && status === "offline") || (isUpKeyword && status === "online");
          return matchesText || matchesStatusFilter;
        })
        .slice(0, 6)
        .map((a) => ({
          kind: "agent",
          label: a.name,
          description: a.hostname ? `${a.hostname} • ${a.os}/${a.arch}` : `${a.os}/${a.arch}`,
          href: `/dashboard/agents/${a.id}`,
          status: a.derivedStatus ?? a.status,
        }));

      // 3. Cloud Monitors
      const monitorResults: ResultItem[] = monitors
        .filter((m) => {
          const status = (m.status ?? "").toLowerCase();
          const matchesText =
            m.name.toLowerCase().includes(q) ||
            m.target.toLowerCase().includes(q) ||
            m.type.toLowerCase().includes(q) ||
            status.includes(q);
          const matchesStatusFilter = (isDownKeyword && status === "down") || (isUpKeyword && status === "up");
          return matchesText || matchesStatusFilter;
        })
        .slice(0, 6)
        .map((m) => ({
          kind: "monitor",
          label: m.name,
          description: `${m.type.toUpperCase()} • ${m.target}`,
          href: "/dashboard/monitors",
          status: m.status,
          type: m.type,
        }));

      // 4. Active Incidents
      const incidentResults: ResultItem[] = incidents
        .filter((inc) => {
          const name = inc.agentName ?? inc.metadata?.monitor_name ?? "";
          const msg = inc.message ?? "";
          const type = inc.type ?? "";
          const status = inc.status ?? "";
          const matchesText =
            name.toLowerCase().includes(q) ||
            msg.toLowerCase().includes(q) ||
            type.toLowerCase().includes(q) ||
            status.toLowerCase().includes(q);
          const matchesStatusFilter = isDownKeyword && status === "open";
          return matchesText || matchesStatusFilter;
        })
        .slice(0, 5)
        .map((inc) => ({
          kind: "incident",
          label: inc.agentName ?? inc.metadata?.monitor_name ?? "System Alert",
          description: `${inc.type.replace(/_/g, " ")}: ${inc.message ?? "Active downtime incident"}`,
          href: "/dashboard/incidents",
          status: inc.status,
          type: inc.type,
        }));

      setResults([...pageResults, ...agentResults, ...monitorResults, ...incidentResults]);
      setActiveIndex(0);
      setLoading(false);
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, agents, monitors, incidents, modalOpen]);

  // ESC Key Listener (Capture Phase) to close search modal immediately
  useEffect(() => {
    if (!modalOpen) return;
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscapeKey, true);
    return () => window.removeEventListener("keydown", handleEscapeKey, true);
  }, [modalOpen]);

  const navigate = (href: string) => {
    router.push(href);
    setModalOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setModalOpen(false);
      return;
    }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIndex]) navigate(results[activeIndex].href);
    }
  };

  // Render Spotlight Modal via Portal to document.body
  const renderModal = () => {
    if (!modalOpen || !mounted) return null;

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
        {/* Backdrop Blur Overlay */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
          onClick={() => setModalOpen(false)}
        />

        {/* Spotlight Modal Box (Center top of window) */}
        <div className="relative z-10 w-full max-w-xl bg-card/95 dark:bg-card/90 border border-border/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-150">
          {/* Top Search Field */}
          <div className="flex items-center px-4 py-3.5 border-b border-border/60 gap-3">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search agents, monitors, errors (up/down), pages..."
              className="w-full bg-transparent text-sm md:text-base font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {loading && <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />}
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
              title="Close (ESC)"
            >
              <kbd className="text-[10px] font-mono bg-muted/60 border border-border/60 px-1.5 py-0.5 rounded text-muted-foreground">
                ESC
              </kbd>
            </button>
          </div>

          {/* Results / Suggestions List */}
          <div className="max-h-96 overflow-y-auto py-2">
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div className="space-y-3 px-2">
                {/* Group: Pages / Navigation */}
                {results.some((r) => r.kind === "page") && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      {!query.trim() ? "Quick Navigation" : "Pages"}
                    </p>
                    <div className="space-y-0.5">
                      {results
                        .filter((r) => r.kind === "page")
                        .map((item) => {
                          const idx = results.indexOf(item);
                          const isActive = idx === activeIndex;
                          if (item.kind !== "page") return null;
                          const Icon = item.Icon;
                          return (
                            <button
                              key={item.href}
                              type="button"
                              onClick={() => navigate(item.href)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                                isActive
                                  ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                                  : "text-foreground hover:bg-muted/50 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold truncate">{item.label}</span>
                                  <span className="text-[11px] text-muted-foreground truncate">{item.description}</span>
                                </div>
                              </div>
                              <ArrowRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${isActive ? "translate-x-1 text-primary" : "opacity-30"}`} />
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Group: Agents */}
                {results.some((r) => r.kind === "agent") && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border-t border-border/40 pt-2">
                      Agents Fleet
                    </p>
                    <div className="space-y-0.5">
                      {results
                        .filter((r) => r.kind === "agent")
                        .map((item) => {
                          if (item.kind !== "agent") return null;
                          const idx = results.indexOf(item);
                          const isActive = idx === activeIndex;
                          const isOnline = item.status === "online";
                          return (
                            <button
                              key={item.href + item.label}
                              type="button"
                              onClick={() => navigate(item.href)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                                isActive
                                  ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                                  : "text-foreground hover:bg-muted/50 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                  <Server className="h-4 w-4 text-muted-foreground" />
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${
                                      isOnline ? "bg-emerald-500" : "bg-destructive"
                                    }`}
                                  />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold truncate">{item.label}</span>
                                  <span className="text-[11px] text-muted-foreground truncate">{item.description}</span>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                  isOnline
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : "bg-destructive/10 text-destructive border-destructive/20"
                                }`}
                              >
                                {item.status}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Group: Cloud Monitors */}
                {results.some((r) => r.kind === "monitor") && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border-t border-border/40 pt-2">
                      Cloud Monitors
                    </p>
                    <div className="space-y-0.5">
                      {results
                        .filter((r) => r.kind === "monitor")
                        .map((item) => {
                          if (item.kind !== "monitor") return null;
                          const idx = results.indexOf(item);
                          const isActive = idx === activeIndex;
                          const isUp = item.status === "up";
                          return (
                            <button
                              key={item.href + item.label}
                              type="button"
                              onClick={() => navigate(item.href)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                                isActive
                                  ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                                  : "text-foreground hover:bg-muted/50 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                  <MonitorCheck className="h-4 w-4 text-muted-foreground" />
                                  <span
                                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${
                                      isUp ? "bg-emerald-500" : "bg-destructive"
                                    }`}
                                  />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold truncate">{item.label}</span>
                                  <span className="text-[11px] text-muted-foreground truncate">{item.description}</span>
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase ${
                                  isUp
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : "bg-destructive/10 text-destructive border-destructive/20"
                                }`}
                              >
                                {item.status}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Group: Active Incidents */}
                {results.some((r) => r.kind === "incident") && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive/90 border-t border-border/40 pt-2 flex items-center gap-1.5">
                      <AlertTriangle size={12} />
                      Active Incidents
                    </p>
                    <div className="space-y-0.5">
                      {results
                        .filter((r) => r.kind === "incident")
                        .map((item) => {
                          if (item.kind !== "incident") return null;
                          const idx = results.indexOf(item);
                          const isActive = idx === activeIndex;
                          return (
                            <button
                              key={item.href + item.label + item.description}
                              type="button"
                              onClick={() => navigate(item.href)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                                isActive
                                  ? "bg-destructive/10 text-destructive font-semibold border border-destructive/20"
                                  : "text-foreground hover:bg-muted/50 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold truncate">{item.label}</span>
                                  <span className="text-[11px] text-muted-foreground truncate">{item.description}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-bold uppercase">
                                {item.status}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Controls Bar */}
          <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground/70 bg-muted/20">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-muted/60 border border-border/60 px-1 py-0.5 rounded text-[9px]">UP</kbd>
                <kbd className="font-mono bg-muted/60 border border-border/60 px-1 py-0.5 rounded text-[9px]">DOWN</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-muted/60 border border-border/60 px-1 py-0.5 rounded text-[9px]">ENTER</kbd> Open
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-muted/60 border border-border/60 px-1 py-0.5 rounded text-[9px]">ESC</kbd> Close
            </span>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (collapsed) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`w-full h-9 rounded-xl border border-border/50 bg-muted/40 hover:bg-muted/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer ${className}`}
          title="Quick search (CTRL+K)"
        >
          <Search size={16} />
        </button>
        {renderModal()}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/60 text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer group ${className}`}
      >
        <div className="flex items-center gap-2">
          <Search size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="font-medium truncate">Search...</span>
        </div>
        <kbd className="text-[10px] font-mono bg-background/80 border border-border/80 px-1.5 py-0.5 rounded text-muted-foreground/80 group-hover:text-foreground transition-colors shadow-2xs">
          CTRL+K
        </kbd>
      </button>
      {renderModal()}
    </>
  );
}
