"use client";

import { useEffect, useState, useCallback } from "react";
import { Copy, Check, X, ArrowUpCircle, Server, ShieldCheck, Key, Clock, RefreshCw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpdateAgentModal({
  agentName,
  projectId,
  currentVersion,
  latestVersion,
  onClose,
}: {
  agentName: string;
  projectId: string;
  currentVersion: string;
  latestVersion: string;
  onClose: () => void;
}) {
  const [cmdCopied, setCmdCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [updated, setUpdated] = useState(false);

  const [regToken, setRegToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(300);
  const [loadingToken, setLoadingToken] = useState<boolean>(true);

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-hub.vercel.app";

  const updateCmd = `curl -fsSL ${appUrl}/install.sh | EZMON_SERVER_URL=${appUrl} sh`;

  // Fetch temporary token for updating agent
  const fetchRegToken = useCallback(async () => {
    setLoadingToken(true);
    try {
      const res = await fetch("/api/dashboard/projects/reg-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setRegToken(data.data.token);
        setExpiresAt(data.data.expiresAt);
      } else {
        setExpiresAt(new Date(Date.now() + 5 * 60 * 1000).toISOString());
      }
    } catch {
      setExpiresAt(new Date(Date.now() + 5 * 60 * 1000).toISOString());
    } finally {
      setLoadingToken(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRegToken();
  }, [fetchRegToken]);

  // Countdown Timer 5 Menit (Smooth tick)
  useEffect(() => {
    const getRemainingSec = () => {
      if (!expiresAt) return 300;
      const diffMs = new Date(expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diffMs / 1000));
    };

    setTimeLeftSec(getRemainingSec());

    const interval = setInterval(() => {
      const remaining = getRemainingSec();
      setTimeLeftSec(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const modalOpenedAt = useState(() => Date.now())[0];

  // Poll setiap 2.5 detik untuk mendeteksi update / re-registrasi agent
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/dashboard/overview?projectId=${projectId}`);
        const data = await res.json();
        if (!data.success || !data.data) return;
        const targetAgent = data.data.agents?.find(
          (a: any) => a.name === agentName || a.id === agentName || a.hostname === agentName
        );
        if (targetAgent) {
          const cleanVer = (targetAgent.version || "").replace(/^v/, "").trim();
          const cleanLatest = latestVersion.replace(/^v/, "").trim();
          const lastSeenTime = targetAgent.lastSeenAt ? new Date(targetAgent.lastSeenAt).getTime() : 0;

          // Terdeteksi update jika versi cocok ATAU agent mengirim heartbeat baru setelah modal dibuka
          if (cleanVer === cleanLatest || lastSeenTime > modalOpenedAt) {
            setUpdated(true);
            clearInterval(poll);
            setTimeout(() => onClose(), 1800);
          }
        }
      } catch {
        /* silent */
      }
    }, 2500);
    return () => clearInterval(poll);
  }, [projectId, agentName, latestVersion, onClose, modalOpenedAt]);

  function copyCmd() {
    navigator.clipboard.writeText(updateCmd);
    setCmdCopied(true);
    setTimeout(() => setCmdCopied(false), 2000);
  }

  const activeToken = regToken || projectId;

  // Format MM:SS
  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const isExpired = timeLeftSec === 0;

  const formattedCurrent = currentVersion.startsWith("v")
    ? currentVersion
    : `v${currentVersion}`;
  const formattedLatest = latestVersion.startsWith("v")
    ? latestVersion
    : `v${latestVersion}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card rounded-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-muted/30 border-b border-border px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowUpCircle size={22} />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">
                Update Agent: {agentName}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Align agent binary with Hub version
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Updated Banner */}
          {updated ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5 flex items-center gap-4 animate-in fade-in">
              <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/20 rounded-full shrink-0">
                <Activity size={18} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-emerald-400">
                  Agent Updated Successfully!
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Agent is now running version {formattedLatest}. Closing dialog automatically...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Version Comparison Card */}
              <div className="grid grid-cols-2 gap-4 bg-muted/40 border border-border rounded-lg p-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Installed Version
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold text-amber-400">
                      {formattedCurrent}
                    </span>
                    <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                      Outdated
                    </span>
                  </div>
                </div>
                <div className="space-y-1 border-l border-border pl-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Latest Hub Version
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold text-emerald-400">
                      {formattedLatest}
                    </span>
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                      Recommended
                    </span>
                  </div>
                </div>
              </div>

              {/* Update Command Block */}
              <div className="bg-background border border-border rounded-lg overflow-hidden shadow-sm">
                <div className="bg-muted/50 border-b border-border px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server size={16} className="text-primary" />
                    <h3 className="font-semibold text-sm text-foreground">
                      Run update command on target host
                    </h3>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                    <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                  </div>
                </div>
                <div className="p-5 bg-zinc-950 relative group flex flex-col gap-4">
                  <div className="relative bg-black border border-zinc-800 rounded-md p-4 overflow-x-auto">
                    <pre className="text-sm text-zinc-300 font-mono whitespace-pre">
                      <span className="text-blue-400">curl</span> <span className="text-zinc-400">-fsSL</span>{" "}
                      <span className="text-emerald-400">{appUrl}/install.sh</span>{" "}
                      <span className="text-zinc-500">|</span>{" "}
                      <span className="text-purple-400">EZMON_SERVER_URL</span>
                      <span className="text-zinc-300">=</span>
                      <span className="text-emerald-400">{appUrl}</span>{" "}
                      <span className="text-blue-400">sh</span>
                    </pre>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={copyCmd}
                      className="absolute top-2 right-2 h-8 w-8 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {cmdCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* One-Time Registration Token & Timer Card for Update */}
              <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key size={16} className="text-primary" />
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Registration Token for Terminal Prompt
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpired ? (
                      <span className="text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-full border border-destructive/20">
                        Expired
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <Clock size={12} className="animate-spin text-emerald-400" />
                        <span>{timeFormatted}</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={fetchRegToken}
                      disabled={loadingToken}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      title="Generate new token"
                    >
                      <RefreshCw size={12} className={loadingToken ? "animate-spin" : ""} />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-muted/40 border border-border/80 rounded-md p-3 font-mono text-sm">
                  {loadingToken ? (
                    <span className="text-xs text-muted-foreground animate-pulse">Generating token...</span>
                  ) : isExpired ? (
                    <span className="text-xs text-destructive">
                      Token expired. Click refresh to generate a new token.
                    </span>
                  ) : (
                    <span className="text-orange-300 font-bold select-all tracking-wider">
                      {activeToken}
                    </span>
                  )}

                  {!isExpired && !loadingToken && activeToken && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(activeToken);
                        setTokenCopied(true);
                        setTimeout(() => setTokenCopied(false), 2000);
                      }}
                      className="h-7 text-xs bg-background border-border text-foreground hover:bg-muted"
                    >
                      {tokenCopied ? (
                        <>
                          <Check size={12} className="mr-1 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} className="mr-1" /> Copy Token
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  When prompted <code className="font-mono text-foreground bg-muted px-1 py-0.5 rounded">Enter EZMON Project Token:</code> in your SSH terminal, paste this token.
                </p>
              </div>

              {/* Safe Update Info */}
              <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
                <ShieldCheck size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-200/80 leading-relaxed">
                  <strong>In-Place Safe Upgrade:</strong> The script will download the latest binary, verify its SHA-256 integrity hash, and smoothly restart the <code className="font-mono bg-emerald-950/60 px-1 rounded border border-emerald-500/20">ezmon-agent.service</code> without resetting your custom agent name or settings.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
