"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardStatusPage, DashboardAgent } from "@ezmon/shared";

// Simple switch component since shadcn switch might need installation
const Switch = ({ checked, onCheckedChange }: { checked: boolean, onCheckedChange: (c: boolean) => void }) => (
  <button 
    type="button" 
    onClick={() => onCheckedChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

export default function StatusPageSettings() {
  const [projects, setProjects] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  
  const [config, setConfig] = useState<DashboardStatusPage | null>(null);
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [message, setMessage] = useState<{type: "success" | "error", text: string} | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [published, setPublished] = useState(false);

  // Project slug for preview link
  const [projectSlug, setProjectSlug] = useState("");

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/dashboard/projects");
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          setProjects(json.data);
          const savedId = localStorage.getItem("ezmon_active_project");
          const isValid = json.data.some((p: any) => p.id === savedId);
          setProjectId(isValid && savedId ? savedId : json.data[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setLoading(false);
      }
    }
    fetchProjects();

    const handleProjectChange = (e: any) => {
      if (e.detail?.id) {
        setProjectId(e.detail.id);
        setLoading(true);
      }
    };
    window.addEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange as EventListener);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    
    setLoading(true);
    
    const proj = projects.find(p => p.id === projectId);
    if (proj) setProjectSlug(proj.slug);

    const fetchConfig = async () => {
      try {
        const res = await fetch(`/api/dashboard/status-page?projectId=${projectId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setConfig(json.data);
          setTitle(json.data.title);
          setDescription(json.data.description || "");
          setPublished(json.data.published);
        } else {
          setConfig(null);
          setTitle("");
          setDescription("");
          setPublished(false);
        }
      } catch (error) {
        console.error("Failed to fetch status page config:", error);
      }
    };

    const fetchOverview = async () => {
      try {
        const res = await fetch(`/api/dashboard/overview?projectId=${projectId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setAgents(json.data.agents);
        }
      } catch (error) {
        console.error("Failed to fetch overview agents:", error);
      }
    };
    
    Promise.all([fetchConfig(), fetchOverview()]).finally(() => setLoading(false));
  }, [projectId, projects]);

  const handleToggleAgent = async (agentId: string, show: boolean) => {
    setUpdatingAgentId(agentId);
    try {
      const res = await fetch(`/api/dashboard/agents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, showOnStatusPage: show })
      });
      const json = await res.json();
      if (json.success) {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, showOnStatusPage: show } : a));
        setMessage({ type: "success", text: "Monitor visibility updated" });
      } else {
        setMessage({ type: "error", text: "Failed to update visibility" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Internal server error" });
    } finally {
      setUpdatingAgentId(null);
    }
  };

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    
    try {
      const res = await fetch(`/api/dashboard/status-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title || "System Status",
          description,
          published,
        }),
      });
      
      const json = await res.json();
      if (json.success) {
        setMessage({ type: "success", text: "Status page configured successfully" });
      } else {
        setMessage({ type: "error", text: json.error || "Failed to save configuration" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Internal server error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 w-48 bg-slate-800 rounded"></div>
      <div className="h-64 bg-slate-800 rounded-xl"></div>
    </div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-slate-400 mb-2 font-mono text-sm">
            <span>Settings</span>
            <span className="text-xs">/</span>
            <span className="text-slate-200">Status Page</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-100 mb-1">Status Page</h1>
          <p className="text-sm text-slate-400">Configure your public status page</p>
        </div>
        <div className="flex items-center gap-4">
          {projectSlug && published && (
            <Button variant="outline" className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300" onClick={() => window.open(`/status/${projectSlug}`, "_blank")}>
              View Public Page
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 h-4 w-4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md mb-6 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
          {message.text}
        </div>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-200">Public Page Settings</CardTitle>
          <CardDescription className="text-slate-400">
            Control how your public status page looks and whether it is accessible to everyone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Page Title</label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g., EZMON System Status" 
              className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Description (Optional)</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="e.g., Welcome to our system status page. Here you can monitor the uptime of our services." 
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
            />
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-950/50">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-slate-200">Publish Status Page</label>
              <p className="text-xs text-slate-500">Make the status page publicly accessible via its URL.</p>
            </div>
            <Switch checked={published} onCheckedChange={setPublished} />
          </div>
          
          <div className="pt-4 flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-200">Included Monitors</CardTitle>
          <CardDescription className="text-slate-400">
            Manage which agents are displayed on the public status page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-800 rounded-md">
              No agents configured in this project.
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-950/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{agent.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                        agent.derivedStatus === 'online' ? 'bg-emerald-500/10 text-emerald-400' :
                        agent.derivedStatus === 'offline' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {agent.derivedStatus}
                      </span>
                    </div>
                    {agent.hostname && <p className="text-xs text-slate-500 font-mono">{agent.hostname}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{agent.showOnStatusPage ? 'Visible' : 'Hidden'}</span>
                    <div className={updatingAgentId === agent.id ? "opacity-50 pointer-events-none" : ""}>
                      <Switch 
                        checked={agent.showOnStatusPage} 
                        onCheckedChange={(c) => handleToggleAgent(agent.id, c)} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
