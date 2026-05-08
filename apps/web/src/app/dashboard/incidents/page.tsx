// Tujuan: Halaman Incidents — tampilkan riwayat incident dengan filter status
// Caller: Next.js dashboard router (/dashboard/incidents)
// Dependensi: /api/dashboard/incidents, /api/dashboard/projects
// Main Functions: IncidentsPage component
// Side Effects: HTTP GET ke incidents API dan projects API

"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle, Filter } from "lucide-react";
import type { DashboardIncident } from "@ezmon/shared";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type FilterStatus = "all" | "open" | "resolved";

const STATUS_TABS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
];

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<DashboardIncident[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load projects once on mount
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
        } else {
          setLoading(false);
        }
      } catch {
        setError("Failed to load projects");
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  // Fetch incidents when project or filter changes
  const fetchIncidents = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        projectId: selectedProject,
        status: filterStatus,
        limit: "100",
      });
      const res = await fetch(`/api/dashboard/incidents?${params}`);
      const data = await res.json();
      if (data.success) {
        setIncidents(data.data);
      } else {
        setError(data.error ?? "Failed to load incidents");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [selectedProject, filterStatus]);

  useEffect(() => {
    fetchIncidents();
    
    const handleProjectChange = (e: any) => {
      if (e.detail?.id) {
        setSelectedProject(e.detail.id);
        setLoading(true);
      }
    };
    window.addEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange as EventListener);
  }, [fetchIncidents]);

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2 font-mono text-sm">
            <span>Alerts</span>
            <span className="text-xs">/</span>
            <span className="text-foreground font-medium">Incident History</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-1 tracking-tight">
            Incidents
          </h1>
          <p className="text-sm text-muted-foreground">
            Track and manage monitoring incidents across your infrastructure
          </p>
        </div>

      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg w-fit border border-border/50">
        <Filter size={14} className="ml-2 text-muted-foreground" />
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              filterStatus === tab.value
                ? "bg-card text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card className="mt-6 border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-14 w-14 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={28} className="text-destructive" />
            </div>
            <h3 className="text-lg font-display font-bold mb-1 text-foreground">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={fetchIncidents}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : incidents.length === 0 ? (
        <Card className="mt-6 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <h3 className="text-xl font-display font-bold mb-2 text-foreground">
              {filterStatus === "open" ? "No open incidents" : filterStatus === "resolved" ? "No resolved incidents" : "All clear!"}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
              {filterStatus === "open"
                ? "All systems are running normally. No active incidents."
                : filterStatus === "resolved"
                ? "No resolved incidents in this period."
                : "No incidents recorded. Your systems are running smoothly."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => {
            const isOpen = incident.status === "open";
            const duration = incident.resolvedAt
              ? (() => {
                  const ms = new Date(incident.resolvedAt).getTime() - new Date(incident.startedAt).getTime();
                  const mins = Math.round(ms / 60000);
                  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
                })()
              : null;

            return (
              <Card
                key={incident.id}
                className={`transition-colors shadow-sm ${isOpen ? "border-destructive/20 hover:border-destructive/40" : "hover:border-border/80"}`}
              >
                <CardContent className="p-5 flex items-start gap-4">
                  {/* Status Icon */}
                  <div className="mt-0.5 shrink-0">
                    {isOpen ? (
                      <div className="bg-destructive/10 p-2 rounded-full">
                        <AlertTriangle size={18} className="text-destructive" />
                      </div>
                    ) : (
                      <div className="bg-emerald-500/10 p-2 rounded-full">
                        <CheckCircle size={18} className="text-emerald-500" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{incident.agentName}</p>
                      <Badge
                        className={`uppercase text-[10px] tracking-wider font-bold shrink-0 ${
                          isOpen
                            ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
                            : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            isOpen ? "bg-destructive animate-pulse" : "bg-emerald-500"
                          }`}
                        />
                        {incident.status}
                      </Badge>
                    </div>

                    {/* Incident type */}
                    <p className="text-xs font-mono font-bold text-muted-foreground mt-1 tracking-wider uppercase">
                      {incident.type.replace(/_/g, " ")}
                    </p>

                    {/* Message */}
                    {incident.message && (
                      <p className="text-sm text-foreground/80 mt-2 bg-muted/30 px-3 py-2 rounded-md border border-border/50 leading-relaxed">
                        {incident.message}
                      </p>
                    )}

                    {/* Timestamps */}
                    <div className="flex items-center gap-4 mt-3 font-mono text-xs text-muted-foreground flex-wrap">
                      <span>
                        Started{" "}
                        <span className="text-foreground/70" title={new Date(incident.startedAt).toLocaleString()}>
                          {formatRelativeTime(incident.startedAt)}
                        </span>
                      </span>
                      {incident.resolvedAt && (
                        <span>
                          Resolved{" "}
                          <span className="text-emerald-500" title={new Date(incident.resolvedAt).toLocaleString()}>
                            {formatRelativeTime(incident.resolvedAt)}
                          </span>
                        </span>
                      )}
                      {duration && (
                        <span className="text-muted-foreground/70">
                          Duration: <span className="text-foreground/60">{duration}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
