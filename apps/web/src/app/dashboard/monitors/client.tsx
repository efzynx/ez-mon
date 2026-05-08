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
