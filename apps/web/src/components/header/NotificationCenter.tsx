// Tujuan: Notification Center — Bell icon dengan popover live incidents terbaru
// Caller: TopAppBar (apps/web/src/app/dashboard/layout.tsx)
// Dependensi: /api/dashboard/incidents (GET, status=open), localStorage (ezmon_active_project)
// Main Functions: NotificationCenter
// Side Effects: Fetch GET /api/dashboard/incidents on mount + saat project berubah

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DashboardIncident } from "@ezmon/shared";

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationCenter() {
  const [incidents, setIncidents] = useState<DashboardIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const fetchIncidents = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/incidents?projectId=${pid}&status=open&limit=10`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.success) setIncidents(data.data as DashboardIncident[]);
    } catch {
      // silent fail — bell will show cached state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const pid = localStorage.getItem("ezmon_active_project");
    if (pid) {
      setProjectId(pid);
      fetchIncidents(pid);
    }

    const handleProjectChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        setProjectId(detail.id);
        fetchIncidents(detail.id);
      }
    };

    window.addEventListener("ezmon_project_changed", handleProjectChange);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange);
  }, [fetchIncidents]);

  // Auto-refresh setiap 30 detik saat popover terbuka (Rule 27 — interval moderat)
  useEffect(() => {
    if (!open || !projectId) return;
    const interval = setInterval(() => fetchIncidents(projectId), 30_000);
    return () => clearInterval(interval);
  }, [open, projectId, fetchIncidents]);

  const unreadCount = incidents.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            id="notification-center-trigger"
            variant="ghost"
            size="icon"
            className="relative rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Open notification center"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground shadow-md">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {unreadCount === 0 && (
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full opacity-70" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-80 p-0 overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
          <p className="text-sm font-semibold text-foreground">
            Open Incidents
          </p>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                {unreadCount} open
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => projectId && fetchIncidents(projectId)}
              disabled={loading}
              aria-label="Refresh incidents"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="max-h-80">
          {loading && incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <CheckCircle2 className="h-8 w-8 text-primary/50" />
              <span className="text-sm font-medium">All clear!</span>
              <span className="text-xs text-muted-foreground/70">No open incidents</span>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="mt-0.5 shrink-0">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {incident.agentName ?? "Unknown Agent"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {incident.message ?? incident.type ?? "Heartbeat missed"}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/60" />
                      <span className="text-[10px] text-muted-foreground/60">
                        {timeAgo(incident.startedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <Link href="/dashboard/incidents" onClick={() => setOpen(false)}>
            <Button
              variant="ghost"
              className="w-full h-8 text-xs text-muted-foreground hover:text-foreground justify-center"
            >
              View all incidents →
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
