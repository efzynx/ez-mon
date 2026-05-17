"use client";

import { toast } from "sonner";

import { useEffect, useState } from "react";
import { Plus, FolderPlus, Tags, Loader2, X, Server, Bell, Pencil, CheckCircle, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Checkbox } from "@/components/ui/checkbox";

import { AlertChannelsManagement } from "./alert-channels";

function TagsManagement({ projects, onUpdateProject }: { projects: any[], onUpdateProject: (id: string, data: any) => void }) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  
  // Managing Agents for a Tag
  const [managingTag, setManagingTag] = useState<string | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      const savedId = localStorage.getItem("ezmon_active_project");
      const isValid = projects.some(p => p.id === savedId);
      setSelectedProject(isValid && savedId ? savedId : projects[0].id);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    fetch(`/api/dashboard/overview?projectId=${selectedProject}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setAgents(data.data.agents);
      })
      .finally(() => setLoading(false));

    const handleProjectChange = (e: any) => {
      if (e.detail?.id) setSelectedProject(e.detail.id);
    };
    window.addEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange as EventListener);
  }, [selectedProject]);

  const activeProject = projects.find(p => p.id === selectedProject);
  const projectTags = activeProject?.tags || [];

  async function handleAddTag() {
    if (!newTagInput.trim() || !activeProject) return;
    const tag = newTagInput.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    if (projectTags.includes(tag)) {
      setNewTagInput("");
      setIsAddingTag(false);
      return;
    }
    
    const newTags = [...projectTags, tag];
    
    try {
      const res = await fetch("/api/dashboard/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeProject.id, tags: newTags })
      });
      const data = await res.json();
      if (data.success) {
        onUpdateProject(activeProject.id, { tags: newTags });
        setNewTagInput("");
        setIsAddingTag(false);
        toast.success(`Tag "${tag}" created`);
      } else toast.error(data.error || "Failed to create tag");
    } catch { toast.error("Network error"); }
  }

  async function handleRemoveTag(tagToRemove: string) {
    if (!activeProject) return;
    
    const affectedAgents = agents.filter(a => a.tags?.includes(tagToRemove));
    const newTags = projectTags.filter((t: string) => t !== tagToRemove);
    
    try {
      const res = await fetch("/api/dashboard/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeProject.id, tags: newTags })
      });
      const data = await res.json();
      
      if (data.success) {
        onUpdateProject(activeProject.id, { tags: newTags });
        toast.success(`Tag "${tagToRemove}" removed`);
        
        // Cascading delete for agents that have this tag
        if (affectedAgents.length > 0) {
          for (const agent of affectedAgents) {
            const agentNewTags = agent.tags.filter((t: string) => t !== tagToRemove);
            await fetch(`/api/dashboard/agents`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId: agent.id, tags: agentNewTags })
            });
          }
          // Update local agents state
          setAgents(prev => prev.map(a => {
            if (a.tags?.includes(tagToRemove)) {
              return { ...a, tags: a.tags.filter((t: string) => t !== tagToRemove) };
            }
            return a;
          }));
        }
      }
    } catch { toast.error("Network error"); }
  }

  function openManageModal(tag: string) {
    setManagingTag(tag);
    // find which agents currently have this tag
    const assigned = agents.filter(a => a.tags?.includes(tag)).map(a => a.id);
    setSelectedAgentIds(assigned);
  }

  async function handleSaveAssignments() {
    if (!managingTag || !activeProject) return;
    setSavingAssignments(true);

    try {
      // Find agents that need to be updated
      const updates = agents.map(agent => {
        const hasTagCurrently = agent.tags?.includes(managingTag) || false;
        const shouldHaveTag = selectedAgentIds.includes(agent.id);
        
        if (hasTagCurrently !== shouldHaveTag) {
          let newTags = [...(agent.tags || [])];
          if (shouldHaveTag) newTags.push(managingTag);
          else newTags = newTags.filter(t => t !== managingTag);
          return { agentId: agent.id, tags: newTags };
        }
        return null;
      }).filter(Boolean) as { agentId: string, tags: string[] }[];

      // Send requests sequentially
      for (const update of updates) {
        await fetch(`/api/dashboard/agents`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: update.agentId, tags: update.tags })
        });
      }

      // Refresh agents locally
      const updatedAgents = agents.map(a => {
        const update = updates.find(u => u.agentId === a.id);
        return update ? { ...a, tags: update.tags } : a;
      });
      setAgents(updatedAgents);
      setManagingTag(null);
      toast.success("Assignments saved");
    } catch {
      toast.error("Network error while saving assignments");
    } finally {
      setSavingAssignments(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground/90">Agent Tags Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Create tags and assign them to multiple agents.</p>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <h3 className="font-medium text-sm">Project Tags</h3>
          <Button size="sm" className="h-8 gap-2" onClick={() => setIsAddingTag(true)}>
            <Plus size={14} /> Create Tag
          </Button>
        </div>
        <CardContent className="p-0">
          {isAddingTag && (
            <div className="p-4 border-b border-border bg-muted/10 flex items-center gap-3">
              <input 
                autoFocus
                placeholder="e.g. production, database" 
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm w-full max-w-xs focus:outline-none focus:ring-1 focus:ring-primary"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddTag()}
              />
              <Button size="sm" onClick={handleAddTag}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setIsAddingTag(false); setNewTagInput(""); }}>Cancel</Button>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto mb-2" size={24} /> Loading...</div>
          ) : projectTags.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No tags created yet. Create a tag to start grouping your agents.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {projectTags.map((tag: string) => {
                const assignedCount = agents.filter(a => a.tags?.includes(tag)).length;
                return (
                  <div key={tag} className="flex items-center justify-between p-4 gap-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-md shrink-0"><Tags size={16} className="text-primary" /></div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                          <span className="truncate">{tag}</span>
                          <Badge variant="secondary" className="text-[10px] h-5 shrink-0">{assignedCount} agents</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 px-2.5" onClick={() => openManageModal(tag)}>
                        <Server size={13} />
                        <span className="hidden sm:inline">Assign</span>
                        <span className="sm:hidden">Assign</span>
                      </Button>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        title="Delete Tag"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {managingTag && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h3 className="font-display font-semibold">Assign Agents to <Badge className="ml-1">{managingTag}</Badge></h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setManagingTag(null)}>
                <X size={16} />
              </Button>
            </div>
            <div className="p-0 max-h-[50vh] overflow-y-auto">
              {agents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No agents available in this project.</div>
              ) : (
                <div className="divide-y divide-border">
                  {agents.map(agent => (
                    <label key={agent.id} className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox 
                        checked={selectedAgentIds.includes(agent.id)} 
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedAgentIds([...selectedAgentIds, agent.id]);
                          else setSelectedAgentIds(selectedAgentIds.filter(id => id !== agent.id));
                        }} 
                      />
                      <div>
                        <div className="text-sm font-medium">{agent.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{agent.hostname || "Unknown host"}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManagingTag(null)}>Cancel</Button>
              <Button variant="default" onClick={handleSaveAssignments} disabled={savingAssignments}>
                {savingAssignments ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Save Assignments
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [projects, setProjects] = useState<{ id: string; name: string; slug: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"projects" | "agent-tags" | "alert-channels">("projects");
  
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<{id: string, name: string} | null>(null);
  const [savingProjectName, setSavingProjectName] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/projects").then((r) => r.json()).then((d) => {
      if (d.success) setProjects(d.data);
    }).finally(() => setLoading(false));

    const savedId = localStorage.getItem("ezmon_active_project");
    if (savedId) setActiveProjectId(savedId);

    const handleProjectChange = (e: any) => {
      if (e.detail?.id) setActiveProjectId(e.detail.id);
    };
    window.addEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange as EventListener);
  }, []);

  function handleSetActiveProject(id: string) {
    setActiveProjectId(id);
    localStorage.setItem("ezmon_active_project", id);
    window.dispatchEvent(new CustomEvent("ezmon_project_changed", { detail: { id } }));
  }

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
        window.dispatchEvent(new CustomEvent("ezmon_projects_updated"));
        setShowCreate(false); setName(""); setSlug("");
        toast.success("Project created");
      } else setError(data.error || "Failed");
    } finally { setSaving(false); }
  }

  async function handleSaveProjectName() {
    if (!editingProject || !editingProject.name.trim()) return;
    setSavingProjectName(true);
    try {
      const res = await fetch("/api/dashboard/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: editingProject.id, name: editingProject.name.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setProjects(p => p.map(x => x.id === editingProject.id ? { ...x, name: editingProject.name.trim() } : x));
        window.dispatchEvent(new CustomEvent("ezmon_projects_updated"));
        setShowEditProjectModal(false);
        toast.success("Project renamed");
      } else {
        toast.error(data.error || "Failed to update project name");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingProjectName(false);
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("Are you sure you want to delete this project? All agents, incidents, and monitors will be deleted forever. This cannot be undone.")) return;
    setDeletingProjectId(id);
    try {
      const res = await fetch(`/api/dashboard/projects?projectId=${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setProjects(p => p.filter(x => x.id !== id));
        window.dispatchEvent(new CustomEvent("ezmon_projects_updated"));
        toast.success("Project deleted");
        if (activeProjectId === id) {
          const rem = projects.filter(x => x.id !== id);
          if (rem.length > 0) handleSetActiveProject(rem[0].id);
          else localStorage.removeItem("ezmon_active_project");
        }
      } else {
        toast.error(data.error || "Failed to delete project");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeletingProjectId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in w-full pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2 font-mono text-sm">
            <span>Settings</span>
            <span className="text-xs">/</span>
            <span className="text-foreground font-medium">Workspace</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-1 tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Central hub for managing projects, tags, and workspace configurations.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-56 shrink-0">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveTab("projects")}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "projects"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <FolderPlus size={16} />
              Workspace Projects
            </button>
            <button
              onClick={() => setActiveTab("agent-tags")}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "agent-tags"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Tags size={16} />
              Agent Tags
            </button>
            <button
              onClick={() => setActiveTab("alert-channels")}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "alert-channels"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Bell size={16} />
              Alert Channels
            </button>
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          {activeTab === "projects" && (
            <div className="mt-2">
              <div className="mb-6">
                <h2 className="text-lg font-display font-semibold text-foreground/90">Workspace Projects</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage all projects in your workspace.</p>
              </div>

              <Card>
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                  <h3 className="font-medium text-sm">Projects List</h3>
                  <Button size="sm" className="h-8 gap-2" onClick={() => setShowCreate(true)}>
                    <Plus size={14} /> New Project
                  </Button>
                </div>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto mb-2" size={24} /> Loading...</div>
                  ) : projects.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                        <FolderPlus size={32} className="text-muted-foreground" />
                      </div>
                      <p className="mb-4">Create your first project to start monitoring.</p>
                      <Button onClick={() => setShowCreate(true)} className="gap-2" size="sm"><Plus size={16} />Create Project</Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {projects.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                          {/* Icon */}
                          <div className="p-2 bg-primary/10 rounded-md shrink-0">
                            <FolderPlus size={16} className="text-primary" />
                          </div>

                          {/* Info — flex-1 agar compress jika perlu */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm truncate">{p.name}</span>
                              {activeProjectId === p.id && (
                                <Badge variant="outline" className="text-[9px] h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1 shrink-0">
                                  ACTIVE
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditingProject({id: p.id, name: p.name}); setShowEditProjectModal(true); }}
                                className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil size={11} />
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                              {p.slug} <span className="opacity-40">·</span> {p.id.slice(0, 8)}...
                            </div>
                          </div>

                          {/* Actions — shrink-0 agar tidak menyusut */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {activeProjectId !== p.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetActiveProject(p.id)}
                                className="h-7 text-xs px-2.5 whitespace-nowrap"
                              >
                                Set Active
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProject(p.id)}
                              disabled={deletingProjectId === p.id}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              {deletingProjectId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

        {activeTab === "agent-tags" && !loading && projects.length > 0 && (
          <TagsManagement 
            projects={projects} 
            onUpdateProject={(id, data) => {
              setProjects(projects.map(p => p.id === id ? { ...p, ...data } : p));
            }}
          />
        )}

        {activeTab === "alert-channels" && (
          <AlertChannelsManagement />
        )}
        </div>
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

      {/* Edit Project Name Modal */}
      {showEditProjectModal && editingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => !savingProjectName && setShowEditProjectModal(false)} />
          <Card className="relative w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 shadow-2xl border-border/50 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h3 className="font-display font-bold text-foreground">Edit Project Name</h3>
              {!savingProjectName && (
                <button
                  onClick={() => setShowEditProjectModal(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium mb-2 text-foreground/90">Project Name</label>
              <input 
                className="bg-muted/50 border border-border rounded-md py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
                value={editingProject.name}
                onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveProjectName()}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
              <button
                onClick={() => setShowEditProjectModal(false)}
                disabled={savingProjectName}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProjectName}
                disabled={savingProjectName || !editingProject.name.trim()}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingProjectName ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : "Save"}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
