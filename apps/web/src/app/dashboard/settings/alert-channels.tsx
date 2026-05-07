// Tujuan: Halaman Notifications — CRUD notification channels (Telegram/Discord/Webhook)
// Caller: Next.js dashboard router (/dashboard/notifications)
// Dependensi: /api/dashboard/notifications (GET/POST/PATCH/DELETE), /api/dashboard/projects
// Main Functions: NotificationsPage component
// Side Effects: HTTP GET/POST/PATCH/DELETE ke notifications API

"use client";

import { useEffect, useState, useCallback, type ComponentType } from "react";
import { Bell, Plus, MessageSquare, Globe, Webhook, Trash2, ToggleLeft, ToggleRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Channel {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  notifyOn: string; // offline | online | both
  createdAt: string;
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
  const [saving, setSaving] = useState(false);
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
          setSelectedProject(data.data[0].id);
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
  }, [fetchChannels]);

  // Add new channel
  async function handleAdd() {
    if (!selectedProject || !formName) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject,
          type: formType,
          name: formName,
          config: formConfig,
          enabled: true,
          notifyOn: formNotifyOn,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChannels((prev) => [...prev, data.data]);
        setShowAdd(false);
        setFormName("");
        setFormConfig({});
        setFormType("telegram");
        setFormNotifyOn("both");
      } else {
        setError(data.error ?? "Failed to add channel");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
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
            {projects.length > 1 && (
              <select
                value={selectedProject ?? ""}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="bg-background border border-border rounded-md py-1 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => setShowAdd(true)}
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
            onClick={() => setShowAdd(false)}
          />
          <div className="relative bg-card border border-border p-6 rounded-xl w-full max-w-md animate-fade-in shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-bold text-foreground">Add Channel</h3>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
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
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !formName}
                className="bg-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground px-6 py-2 rounded-md font-medium transition-all text-sm flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Adding..." : "Add Channel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
