"use client";

import { useEffect, useState, useCallback } from "react";
import { Copy, Check, Activity, X, RefreshCw, Clock, Key } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [cmdCopied, setCmdCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [detected, setDetected] = useState(false);

  const [regToken, setRegToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(300);
  const [loadingToken, setLoadingToken] = useState<boolean>(true);

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-hub.vercel.app";

  const installCmd = `curl -fsSL ${appUrl}/install.sh | EZMON_SERVER_URL=${appUrl} sh`;

  // Generate One-Time Registration Token (5-minute TTL)
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
      }
    } catch {
      /* silent */
    } finally {
      setLoadingToken(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRegToken();
  }, [fetchRegToken]);

  // Countdown Timer 5 Menit
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const diffMs = new Date(expiresAt).getTime() - Date.now();
      const diffSec = Math.max(0, Math.floor(diffMs / 1000));
      setTimeLeftSec(diffSec);
      if (diffSec === 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  function copyCmd() {
    navigator.clipboard.writeText(installCmd);
    setCmdCopied(true);
    setTimeout(() => setCmdCopied(false), 2000);
  }

  function copyToken() {
    if (!regToken) return;
    navigator.clipboard.writeText(regToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  // Format MM:SS
  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const isExpired = timeLeftSec === 0;

  // Poll setiap 5 detik — auto-close saat agent baru terdeteksi
  useEffect(() => {
    let initialCount: number | null = null;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/dashboard/overview?projectId=${projectId}`);
        const data = await res.json();
        if (!data.success) return;
        const count: number = data.data.totalAgents;
        if (initialCount === null) {
          initialCount = count;
          return;
        }
        if (count > initialCount) {
          setDetected(true);
          clearInterval(poll);
          setTimeout(() => onClose(), 1800);
        }
      } catch {
        /* silent */
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [projectId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card rounded-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-muted/30 border-b border-border px-6 py-5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">Install New Agent</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Deploy the EZMON agent to your infrastructure
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Installation Command */}
          <div className="bg-background border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="bg-muted/50 border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary">
                  1
                </div>
                <h3 className="font-semibold text-sm text-foreground">
                  Run installer on target server
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

          {/* Registration Token & Timer Card */}
          <div className="bg-background border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-primary" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  One-Time Registration Token
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
                  {regToken || projectId}
                </span>
              )}

              {!isExpired && !loadingToken && (regToken || projectId) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const activeToken = regToken || projectId;
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
          </div>

          {/* Heartbeat status */}
          {detected ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5 flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/20 rounded-full shrink-0">
                <Activity size={18} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-emerald-400">Agent detected!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Heartbeat received. Closing automatically...
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4 border-l-4 border-l-primary/50">
              <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                <div className="absolute inset-0 rounded-full border-2 border-muted" />
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <Activity size={16} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Waiting for heartbeat...</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Run the command on your target server. This dialog closes automatically once the
                  agent is detected.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
