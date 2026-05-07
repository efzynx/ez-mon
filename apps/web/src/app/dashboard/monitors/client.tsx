/**
 * Tujuan: Client component untuk halaman Monitors — fetch projects lalu render CloudMonitorsManagement
 * Caller: /dashboard/monitors/page.tsx
 * Dependensi: CloudMonitorsManagement, /api/dashboard/projects
 * Main Functions: MonitorsPageClient
 * Side Effects: GET /api/dashboard/projects saat mount
 */

"use client";

import { useEffect, useState } from "react";
import { MonitorCheck } from "lucide-react";
import { CloudMonitorsManagement } from "../settings/cloud-monitors";

interface Project {
  id: string;
  name: string;
}

export function MonitorsPageClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/projects")
      .then(r => r.json())
      .then(d => {
        if (d.success) setProjects(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
            <MonitorCheck size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              Cloud Monitors
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor external URLs for uptime, TLS/SSL health, and keyword presence.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-16 text-center text-muted-foreground text-sm">
          Loading...
        </div>
      ) : (
        <CloudMonitorsManagement projects={projects} />
      )}
    </div>
  );
}
