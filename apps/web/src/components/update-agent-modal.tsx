"use client";

import { useState } from "react";
import { Copy, Check, X, ArrowUpCircle, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpdateAgentModal({
  agentName,
  currentVersion,
  latestVersion,
  onClose,
}: {
  agentName: string;
  currentVersion: string;
  latestVersion: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-hub.vercel.app";

  const updateCmd = `curl -fsSL ${appUrl}/install.sh | EZMON_SERVER_URL=${appUrl} sh`;

  function copyToClipboard() {
    navigator.clipboard.writeText(updateCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
                  onClick={copyToClipboard}
                  className="absolute top-2 right-2 h-8 w-8 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </Button>
              </div>
            </div>
          </div>

          {/* Safe Update Info */}
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
            <ShieldCheck size={16} className="text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              <strong>In-Place Safe Upgrade:</strong> The script will download the latest binary, verify its SHA-256 integrity hash, and smoothly restart the <code className="font-mono bg-emerald-950/60 px-1 rounded border border-emerald-500/20">ezmon-agent.service</code> without losing your agent registration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
