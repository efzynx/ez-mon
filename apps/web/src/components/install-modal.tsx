"use client";

import { useEffect, useState } from "react";
import { Server, Copy, Check, Activity, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"interactive" | "direct">("interactive");
  const [copied, setCopied] = useState(false);
  const [detected, setDetected] = useState(false);
  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-hub.vercel.app";

  const interactiveCmd = `curl -fsSL ${appUrl}/install.sh | EZMON_SERVER_URL=${appUrl} sh`;
  const directCmd = `curl -fsSL ${appUrl}/install.sh | EZMON_SERVER_URL=${appUrl} EZMON_TOKEN=${projectId} sh`;
  const currentCmd = mode === "interactive" ? interactiveCmd : directCmd;

  function copyToClipboard() {
    navigator.clipboard.writeText(currentCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Poll setiap 5 detik — auto-close saat agent baru terdeteksi
  useEffect(() => {
    let initialCount: number | null = null;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/dashboard/overview?projectId=${projectId}`);
        const data = await res.json();
        if (!data.success) return;
        const count: number = data.data.totalAgents;
        if (initialCount === null) { initialCount = count; return; }
        if (count > initialCount) {
          setDetected(true);
          clearInterval(poll);
          setTimeout(() => onClose(), 1800);
        }
      } catch { /* silent */ }
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
            <p className="text-sm text-muted-foreground mt-1">Deploy the EZMON agent to your infrastructure</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Mode Selector */}
          <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-lg border border-border">
            <button
              onClick={() => setMode("interactive")}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                mode === "interactive"
                  ? "bg-background text-foreground shadow-sm border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Interactive (Secure)
            </button>
            <button
              onClick={() => setMode("direct")}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                mode === "direct"
                  ? "bg-background text-foreground shadow-sm border border-border/80"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Direct (One-liner)
            </button>
          </div>

          {/* Command */}
          <div className="bg-background border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="bg-muted/50 border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary">1</div>
                <h3 className="font-semibold text-sm text-foreground">
                  {mode === "interactive"
                    ? "Run on target server (Interactive Prompt)"
                    : "Run on target server (Direct Token)"}
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
                  {mode === "interactive" ? (
                    <>
                      <span className="text-blue-400">curl</span> <span className="text-zinc-400">-fsSL</span> <span className="text-emerald-400">{appUrl}/install.sh</span> <span className="text-zinc-500">|</span> <span className="text-purple-400">EZMON_SERVER_URL</span><span className="text-zinc-300">=</span><span className="text-emerald-400">{appUrl}</span> <span className="text-blue-400">sh</span>
                    </>
                  ) : (
                    <>
                      <span className="text-blue-400">curl</span> <span className="text-zinc-400">-fsSL</span> <span className="text-emerald-400">{appUrl}/install.sh</span> <span className="text-zinc-500">|</span> <span className="text-purple-400">EZMON_SERVER_URL</span><span className="text-zinc-300">=</span><span className="text-emerald-400">{appUrl}</span> <span className="text-purple-400">EZMON_TOKEN</span><span className="text-zinc-300">=</span><span className="text-orange-300">{projectId}</span> <span className="text-blue-400">sh</span>
                    </>
                  )}
                </pre>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 h-8 w-8 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </Button>
              </div>

              {mode === "interactive" && (
                <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
                  <Server size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-200/80 leading-relaxed">
                    <strong className="text-emerald-400">Interactive Secure Mode:</strong> The installer will prompt you for your Project Token on execution. Your token will <strong>NOT</strong> be recorded in shell history (<code className="font-mono bg-emerald-950/60 px-1 rounded border border-emerald-500/20">.bash_history</code>).
                    <br />
                    <span className="text-zinc-400 mt-1 block">Project Token: <code className="font-mono text-orange-300 select-all bg-black/40 px-1 rounded">{projectId}</code></span>
                  </p>
                </div>
              )}

              {mode === "direct" && (
                <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                  <Server size={16} className="text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-200/70 leading-relaxed">
                    The script auto-detects your system architecture, installs the binary to{" "}
                    <code className="font-mono bg-blue-900/40 px-1 rounded border border-blue-500/20">/usr/local/bin/ezmon-agent</code>, and configures a systemd service.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* DEV mode notice */}
          <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 text-xs text-yellow-200/80">
            <span className="text-yellow-400 font-bold shrink-0 mt-0.5">DEV</span>
            <span className="leading-relaxed">
              In <strong>monorepo (localhost)</strong> mode, the script will <strong>build the binary from source</strong>{" "}
              using the detected Go compiler. Run with <code className="font-mono bg-black/30 px-1 rounded">sudo</code> if needed.
            </span>
          </div>

          {/* Heartbeat status */}
          {detected ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5 flex items-center gap-4">
              <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/20 rounded-full shrink-0">
                <Activity size={18} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-emerald-400">Agent detected!</h3>
                <p className="text-xs text-muted-foreground mt-1">Heartbeat received. Closing automatically...</p>
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
                  Run the command on your target server. This dialog closes automatically once the agent is detected.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
