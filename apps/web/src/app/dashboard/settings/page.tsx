"use client";

import { useEffect, useState } from "react";
import { Plus, FolderPlus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const [projects, setProjects] = useState<{ id: string; name: string; slug: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/projects").then((r) => r.json()).then((d) => {
      if (d.success) setProjects(d.data);
    }).finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setError(""); setSaving(true);
    try {
      const res = await fetch("/api/dashboard/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-") }),
      });
      const data = await res.json();
      if (data.success) {
        setProjects((p) => [...p, data.data]);
        setShowCreate(false); setName(""); setSlug("");
      } else setError(data.error || "Failed");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2 font-mono text-sm">
            <span>Settings</span>
            <span className="text-xs">/</span>
            <span className="text-foreground font-medium">Projects</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-1 tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage projects and workspace preferences</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 shadow-md">
          <Plus size={18} />New Project
        </Button>
      </div>

      <div>
        <h2 className="text-lg font-display font-semibold mb-4 text-foreground/90">Workspace Projects</h2>
        {loading ? (
          <div className="space-y-3 mt-4">
            {[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl bg-card border border-border" />)}
          </div>
        ) : projects.length === 0 ? (
          <Card className="mt-8 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <FolderPlus size={32} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-6 text-sm">Create your first project to start monitoring.</p>
              <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus size={18} />Create Project</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <Card key={p.id} className="hover:border-border/80 transition-colors shadow-sm group">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{p.slug} <span className="mx-2 text-border">|</span> ID: {p.id.slice(0, 8)}...</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Created</span>
                    <span className="text-sm font-mono text-foreground/80">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <Card className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 shadow-2xl border-border/50">
            <CardContent className="p-6">
              <h3 className="text-xl font-display font-bold mb-6 text-foreground tracking-tight">Create New Project</h3>
              {error && <div className="p-3 mb-4 rounded-md border border-destructive/20 bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/90">Project Name</label>
                  <input className="bg-muted/50 border border-border rounded-md py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full transition-shadow" placeholder="e.g. Production Cluster" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")); }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/90">URL Slug</label>
                  <input className="bg-muted/50 border border-border rounded-md py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full font-mono transition-shadow" placeholder="production-cluster" value={slug} onChange={(e) => setSlug(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving || !name}>
                  {saving ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
