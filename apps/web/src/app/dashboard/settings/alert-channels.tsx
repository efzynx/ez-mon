// Tujuan: Halaman Notifications — CRUD notification channels (Telegram/Discord/Webhook)
// Caller: Next.js dashboard router (/dashboard/notifications)
// Dependensi: /api/dashboard/notifications (GET/POST/PATCH/DELETE), /api/dashboard/projects
// Main Functions: NotificationsPage component
// Side Effects: HTTP GET/POST/PATCH/DELETE ke notifications API

"use client";

import { useEffect, useState, useCallback, type ComponentType } from "react";
import { Bell, Plus, MessageSquare, Globe, Webhook, Trash2, ToggleLeft, ToggleRight, Loader2, X, Info, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Channel {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  notifyOn: string; // offline | online | both
  createdAt: string;
  configJson?: any;
}

type ChannelType = "telegram" | "discord" | "webhook";

const CHANNEL_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  telegram: MessageSquare,
  discord: Globe,
  webhook: Webhook,
};

const CHANNEL_LABELS: Record<string, string> = {
  telegram: "Telegram",
  discord: "Discord Webhook",
  webhook: "Generic Webhook",
};

export function AlertChannelsManagement() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formType, setFormType] = useState<ChannelType>("telegram");
  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [formCustomOffline, setFormCustomOffline] = useState("");
  const [formCustomOnline, setFormCustomOnline] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formNotifyOn, setFormNotifyOn] = useState<"offline" | "online" | "both">("both");
  const [updatingNotifyId, setUpdatingNotifyId] = useState<string | null>(null);

  // Load projects once
  useEffect(() => {
    async function load() {
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
    load();
  }, []);

  // Fetch channels when project changes
  const fetchChannels = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/notifications?projectId=${selectedProject}`);
      const d = await res.json();
      if (d.success) setChannels(d.data ?? []);
      else setError(d.error ?? "Failed to load channels");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchChannels();
    
    const handleProjectChange = (e: any) => {
      if (e.detail?.id) {
        setSelectedProject(e.detail.id);
        setLoading(true);
      }
    };
    window.addEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange as EventListener);
  }, [fetchChannels]);

  async function handleSave() {
    if (!selectedProject || !formName) return;
    setSaving(true);

    const config = {
      ...formConfig,
      customOfflineMessage: formCustomOffline || undefined,
      customOnlineMessage: formCustomOnline || undefined,
    };

    try {
      if (editingId) {
        const res = await fetch("/api/dashboard/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: editingId,
            name: formName,
            config,
            notifyOn: formNotifyOn,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setChannels((prev) =>
            prev.map((c) => (c.id === editingId ? { ...c, name: formName, configJson: config, notifyOn: formNotifyOn } : c))
          );
          closeModal();
        } else {
          setError(data.error ?? "Failed to update channel");
        }
      } else {
        const res = await fetch("/api/dashboard/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProject,
            type: formType,
            name: formName,
            config,
            enabled: true,
            notifyOn: formNotifyOn,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setChannels((prev) => [...prev, data.data]);
          closeModal();
        } else {
          setError(data.error ?? "Failed to add channel");
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const [testingType, setTestingType] = useState<"offline" | "online" | null>(null);

  async function handleTest(eventType: "offline" | "online") {
    setError("");
    setTestingType(eventType);
    const config = {
      ...formConfig,
      customOfflineMessage: formCustomOffline || undefined,
      customOnlineMessage: formCustomOnline || undefined,
    };
    try {
      const res = await fetch("/api/dashboard/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: formType, config, eventType }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? `Failed to send ${eventType} test notification`);
      }
    } catch {
      setError("Network error during test");
    } finally {
      setTestingType(null);
    }
  }

  function closeModal() {
    setShowAdd(false);
    setEditingId(null);
    setFormName("");
    setFormConfig({});
    setFormCustomOffline("");
    setFormCustomOnline("");
    setFormType("telegram");
    setFormNotifyOn("both");
  }

  function openEdit(ch: Channel) {
    setEditingId(ch.id);
    setFormType(ch.type as ChannelType);
    setFormName(ch.name);
    setFormNotifyOn(ch.notifyOn as any);
    
    const cfg = ch.configJson || {};
    setFormConfig({
      botToken: cfg.botToken || "",
      chatId: cfg.chatId || "",
      webhookUrl: cfg.webhookUrl || "",
      url: cfg.url || "",
      secret: cfg.secret || "",
    });
    setFormCustomOffline(cfg.customOfflineMessage || "");
    setFormCustomOnline(cfg.customOnlineMessage || "");
    setShowAdd(true);
  }

  // Toggle enabled/disabled
  async function handleToggle(channel: Channel) {
    setTogglingId(channel.id);
    try {
      const res = await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id, enabled: !channel.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setChannels((prev) =>
          prev.map((c) => (c.id === channel.id ? { ...c, enabled: !c.enabled } : c))
        );
      }
    } catch {
      // silent fail
    } finally {
      setTogglingId(null);
    }
  }

  // Update notifyOn
  async function handleNotifyOnChange(channel: Channel, value: "offline" | "online" | "both") {
    setUpdatingNotifyId(channel.id);
    try {
      const res = await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id, notifyOn: value }),
      });
      const data = await res.json();
      if (data.success) {
        setChannels((prev) =>
          prev.map((c) => (c.id === channel.id ? { ...c, notifyOn: value } : c))
        );
      }
    } catch { /* silent */ } finally {
      setUpdatingNotifyId(null);
    }
  }

  // Delete channel
  async function handleDelete(channelId: string) {
    if (!confirm("Remove this notification channel?")) return;
    setDeletingId(channelId);
    try {
      const res = await fetch(`/api/dashboard/notifications?channelId=${channelId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setChannels((prev) => prev.filter((c) => c.id !== channelId));
      }
    } catch {
      // silent fail
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-2 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-lg font-display font-semibold text-foreground/90">Alert Channels</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure alert channels for incident notifications.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-sm">Channels List</h3>
          </div>
          <Button
            size="sm"
            onClick={() => { closeModal(); setShowAdd(true); }}
            className="gap-2 h-8"
          >
            <Plus size={14} />
            Add Channel
          </Button>
        </div>
        
        <div className="p-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <Bell size={16} className="shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto hover:opacity-70">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Channels list */}
      {loading ? (
        <div className="space-y-3 mt-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-card border border-dashed border-border p-12 rounded-xl text-center mt-8">
          <Bell size={44} className="mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-xl font-display font-bold mb-2 text-foreground">
            No channels configured
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm">
            Add Telegram, Discord, or a webhook to receive alerts when agents go offline or recover.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-primary hover:opacity-90 text-primary-foreground px-6 py-2 rounded-md font-medium transition-all inline-flex items-center gap-2 text-sm"
          >
            <Plus size={16} />
            Add Channel
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => {
            const Icon = CHANNEL_ICONS[ch.type] ?? Bell;
            const isDeleting = deletingId === ch.id;
            const isToggling = togglingId === ch.id;

            return (
              <div
                key={ch.id}
                className={`bg-card border rounded-lg p-5 flex items-center gap-4 transition-all ${
                  ch.enabled ? "border-border hover:border-border/80" : "border-border/40 opacity-60"
                }`}
              >
                {/* Icon */}
                <div className={`p-3 rounded-lg border transition-colors ${ch.enabled ? "bg-primary/10 border-primary/20" : "bg-muted border-border"}`}>
                  <Icon size={20} className={ch.enabled ? "text-primary" : "text-muted-foreground"} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{ch.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {CHANNEL_LABELS[ch.type] ?? ch.type}
                  </p>
                </div>

                {/* Notify On selector */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Notify</span>
                  <select
                    value={ch.notifyOn ?? "both"}
                    disabled={updatingNotifyId === ch.id}
                    onChange={(e) => handleNotifyOnChange(ch, e.target.value as "offline" | "online" | "both")}
                    className="bg-muted border border-border rounded text-[11px] font-mono text-foreground py-1 px-2 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 cursor-pointer"
                  >
                    <option value="both">↕ Both</option>
                    <option value="offline">🔴 Offline</option>
                    <option value="online">🟢 Online</option>
                  </select>
                </div>

                {/* Status badge */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                    ch.enabled
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {ch.enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {ch.enabled ? "Active" : "Disabled"}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(ch)}
                    disabled={isDeleting || isToggling}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title="Edit channel"
                  >
                    <Pencil size={16} />
                  </button>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(ch)}
                    disabled={isToggling || isDeleting}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title={ch.enabled ? "Disable channel" : "Enable channel"}
                  >
                    {isToggling ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : ch.enabled ? (
                      <ToggleRight size={18} className="text-emerald-500" />
                    ) : (
                      <ToggleLeft size={18} />
                    )}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(ch.id)}
                    disabled={isDeleting || isToggling}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    title="Delete channel"
                  >
                    {isDeleting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
      </div>

      {/* Add Channel Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative flex flex-col bg-card border border-border rounded-xl w-full max-w-md max-h-[90vh] animate-fade-in shadow-2xl">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
              <h3 className="text-xl font-display font-bold text-foreground">
                {editingId ? "Edit Channel" : "Add Channel"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Notify On */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground">Notify when</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["both", "offline", "online"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormNotifyOn(opt)}
                      className={`py-2.5 px-3 rounded-md border text-sm font-medium transition-all ${
                        formNotifyOn === opt
                          ? "bg-primary/15 border-primary text-primary"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {opt === "both" ? "↕ Both" : opt === "offline" ? "🔴 Offline" : "🟢 Online"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {formNotifyOn === "offline" && "Only notify when the agent goes offline."}
                  {formNotifyOn === "online" && "Only notify when the agent comes back online."}
                  {formNotifyOn === "both" && "Notify when the agent goes offline and when it recovers."}
                </p>
              </div>

              {/* Type */}
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => { setFormType(e.target.value as ChannelType); setFormConfig({}); }}
                    className="bg-background border border-border rounded-md py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
                  >
                    <option value="telegram">Telegram</option>
                    <option value="discord">Discord Webhook</option>
                    <option value="webhook">Generic Webhook</option>
                  </select>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-foreground">Channel Name</label>
                <input
                  className="bg-background border border-border rounded-md py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full placeholder:text-muted-foreground"
                  placeholder="e.g. Ops Alert Channel"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              {/* Telegram fields */}
              {formType === "telegram" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Bot Token</label>
                    <input
                      className="bg-background border border-border rounded-md py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full font-mono placeholder:text-muted-foreground"
                      placeholder="1234567890:ABC..."
                      value={formConfig.botToken ?? ""}
                      onChange={(e) => setFormConfig((c) => ({ ...c, botToken: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Chat ID</label>
                    <input
                      className="bg-background border border-border rounded-md py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full font-mono placeholder:text-muted-foreground"
                      placeholder="-100xxxxxxxxxx"
                      value={formConfig.chatId ?? ""}
                      onChange={(e) => setFormConfig((c) => ({ ...c, chatId: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Discord field */}
              {formType === "discord" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">Webhook URL</label>
                  <input
                    className="bg-background border border-border rounded-md py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full font-mono placeholder:text-muted-foreground"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={formConfig.webhookUrl ?? ""}
                    onChange={(e) => setFormConfig((c) => ({ ...c, webhookUrl: e.target.value }))}
                  />
                </div>
              )}

              {/* Webhook field */}
              {formType === "webhook" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">URL</label>
                    <input
                      className="bg-background border border-border rounded-md py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full font-mono placeholder:text-muted-foreground"
                      placeholder="https://your-endpoint.com/webhook"
                      value={formConfig.url ?? ""}
                      onChange={(e) => setFormConfig((c) => ({ ...c, url: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">
                      Secret <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <input
                      className="bg-background border border-border rounded-md py-2.5 px-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full font-mono placeholder:text-muted-foreground"
                      placeholder="Sent as X-EZMON-Secret header"
                      value={formConfig.secret ?? ""}
                      onChange={(e) => setFormConfig((c) => ({ ...c, secret: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Custom Messages */}
              <div className="pt-4 border-t border-border mt-6">
                <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                  <Info size={16} />
                  <span className="text-sm font-medium">Custom Message Templates (Optional)</span>
                </div>
                <div className="bg-muted/30 border border-border rounded-md p-3 mb-4 text-xs text-muted-foreground space-y-1">
                  <p>Use variables to customize your message:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li><code className="bg-muted px-1 rounded">{'{project}'}</code> : Project name</li>
                    <li><code className="bg-muted px-1 rounded">{'{agent}'}</code> / <code className="bg-muted px-1 rounded">{'{monitor}'}</code> : Name of the agent or cloud monitor</li>
                    <li><code className="bg-muted px-1 rounded">{'{status}'}</code> : e.g., DOWN, OFFLINE, RECOVERED, ONLINE</li>
                    <li><code className="bg-muted px-1 rounded">{'{time}'}</code> : Event timestamp</li>
                  </ul>
                  <p className="pt-1 text-muted-foreground/80">Example: <code className="bg-muted px-1 rounded">{"{project} ({agent}) is {status} at {time}"}</code></p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Offline/Down Message</label>
                    <textarea
                      className="bg-background border border-border rounded-md py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full placeholder:text-muted-foreground resize-y min-h-[60px]"
                      placeholder="e.g. 🔴 Agent {agent} is {status}!"
                      value={formCustomOffline}
                      onChange={(e) => setFormCustomOffline(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Online/Recovered Message</label>
                    <textarea
                      className="bg-background border border-border rounded-md py-2 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full placeholder:text-muted-foreground resize-y min-h-[60px]"
                      placeholder="e.g. 🟢 Agent {agent} has {status}!"
                      value={formCustomOnline}
                      onChange={(e) => setFormCustomOnline(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-6 pt-4 border-t border-border shrink-0 bg-muted/20">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTest("offline")}
                  disabled={testingType !== null}
                  className="px-3 py-2 text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Send a dummy OFFLINE event to this channel"
                >
                  {testingType === "offline" && <Loader2 size={12} className="animate-spin" />}
                  Test Offline
                </button>
                <button
                  onClick={() => handleTest("online")}
                  disabled={testingType !== null}
                  className="px-3 py-2 text-xs font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  title="Send a dummy ONLINE recovery event to this channel"
                >
                  {testingType === "online" && <Loader2 size={12} className="animate-spin" />}
                  Test Online
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formName}
                  className="bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground px-6 py-2 rounded-md font-medium transition-all text-sm flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Saving..." : (editingId ? "Save Changes" : "Add Channel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
