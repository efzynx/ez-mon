// Tujuan: Global Search — command palette dropdown untuk mencari agents, nav pages, incidents
// Caller: TopAppBar (apps/web/src/app/dashboard/layout.tsx) — desktop inline + mobile overlay
// Dependensi: /api/dashboard/overview (agents list), localStorage (ezmon_active_project)
// Main Functions: GlobalSearch
// Side Effects: Fetch GET /api/dashboard/overview saat query berubah (debounced)

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DashboardAgent } from "@ezmon/shared";

// ─── Nav pages ──────────────────────────────────────────────────────────────

const NAV_PAGES = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, description: "Dashboard overview" },
  { label: "Agents", href: "/dashboard/agents", icon: Server, description: "Manage your agents" },
  { label: "Incidents", href: "/dashboard/incidents", icon: AlertTriangle, description: "Active & resolved incidents" },
  { label: "Monitors", href: "/dashboard/monitors", icon: MonitorCheck, description: "Cloud monitors" },
  { label: "Status Page", href: "/dashboard/status-page", icon: Globe, description: "Public status page" },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, description: "Alert channels" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, description: "Project settings" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultItem =
  | { kind: "page"; label: string; description: string; href: string; Icon: React.ElementType }
  | { kind: "agent"; label: string; description: string; href: string; status: string };

// ─── Component ───────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  className?: string;
  autoFocus?: boolean;
}

export function GlobalSearch({ className = "", autoFocus = false }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus input saat autoFocus prop true (mobile overlay)
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // Load agents once (from overview) — lightweight single fetch
  const loadAgents = useCallback(async () => {
    const pid = localStorage.getItem("ezmon_active_project");
    if (!pid) return;
    try {
      const res = await fetch(`/api/dashboard/overview?projectId=${pid}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) setAgents(data.data.agents as DashboardAgent[]);
    } catch {
      // silent — agents list optional for search
    }
  }, []);

  useEffect(() => {
    loadAgents();
    const handleProjectChange = () => loadAgents();
    window.addEventListener("ezmon_project_changed", handleProjectChange);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange);
  }, [loadAgents]);

  // Search logic — debounced 150ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const q = query.toLowerCase();
      setLoading(true);

      const pageResults: ResultItem[] = NAV_PAGES.filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      ).map((p) => ({
        kind: "page",
        label: p.label,
        description: p.description,
        href: p.href,
        Icon: p.icon,
      }));

      const agentResults: ResultItem[] = agents
        .filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.hostname ?? "").toLowerCase().includes(q) ||
            (a.tags ?? []).some((t) => t.toLowerCase().includes(q))
        )
        .slice(0, 6)
        .map((a) => ({
          kind: "agent",
          label: a.name,
          description: a.hostname ?? "No hostname",
          href: `/dashboard/agents/${a.id}`,
          status: a.derivedStatus ?? a.status,
        }));

      setResults([...pageResults, ...agentResults]);
      setActiveIndex(0);
      setOpen(true);
      setLoading(false);
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, agents]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navigate = (href: string) => {
    router.push(href);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIndex]) navigate(results[activeIndex].href);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
      )}
      <Input
        ref={inputRef}
        id="global-search-input"
        className="pl-9 pr-8 h-9 rounded-full bg-muted/40 border-border/50 focus-visible:ring-1 focus-visible:border-primary transition-all shadow-none"
        placeholder="Search agents, pages..."
        type="search"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => query.trim() && setOpen(true)}
        aria-label="Global search"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-2 left-0 right-0 z-50 rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-xl overflow-hidden"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="py-1 max-h-72 overflow-y-auto">
              {/* Group: Pages */}
              {results.some((r) => r.kind === "page") && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    Pages
                  </p>
                  {results
                    .filter((r) => r.kind === "page")
                    .map((item, i) => {
                      const idx = results.indexOf(item);
                      const isActive = idx === activeIndex;
                      if (item.kind !== "page") return null;
                      const Icon = item.Icon;
                      return (
                        <button
                          key={item.href}
                          role="option"
                          aria-selected={isActive}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                            isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"
                          }`}
                          onClick={() => navigate(item.href)}
                          onMouseEnter={() => setActiveIndex(idx)}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-70" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{item.label}</span>
                            <span className="block text-[11px] text-muted-foreground truncate">
                              {item.description}
                            </span>
                          </div>
                          <ArrowRight className="h-3 w-3 opacity-40 shrink-0" />
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Group: Agents */}
              {results.some((r) => r.kind === "agent") && (
                <div>
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 border-t border-border/30 mt-1 pt-2">
                    Agents
                  </p>
                  {results
                    .filter((r) => r.kind === "agent")
                    .map((item) => {
                      if (item.kind !== "agent") return null;
                      const idx = results.indexOf(item);
                      const isActive = idx === activeIndex;
                      const isOnline = item.status === "online";
                      return (
                        <button
                          key={item.href}
                          role="option"
                          aria-selected={isActive}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                            isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"
                          }`}
                          onClick={() => navigate(item.href)}
                          onMouseEnter={() => setActiveIndex(idx)}
                        >
                          <div className="relative shrink-0">
                            <Server className="h-4 w-4 opacity-70" />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${
                                isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium">{item.label}</span>
                            <span className="block text-[11px] text-muted-foreground truncate">
                              {item.description}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-medium shrink-0 ${
                              isOnline ? "text-emerald-500" : "text-muted-foreground"
                            }`}
                          >
                            {item.status}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border/30 px-3 py-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/50 bg-muted/10">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span><kbd className="font-mono">Esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
  );
}
