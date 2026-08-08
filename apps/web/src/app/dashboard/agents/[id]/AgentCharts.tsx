// Tujuan: Komponen UI chart history metrics agent (CPU per-core, RAM, Disk, Net, Load)
// Caller: AgentDetailPage (apps/web/src/app/dashboard/agents/[id]/page.tsx)
// Dependensi: recharts, lucide-react, UI components, /api/dashboard/agents/[id]/metrics
// Main Functions: AgentCharts
// Side Effects: HTTP GET /api/dashboard/agents/[id]/metrics (interval 1 menit)

"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2, Calendar, Cpu } from "lucide-react";
import { Input } from "@/components/ui/input";

const RANGES = [
  { label: "5m", value: "5m" },
  { label: "10m", value: "10m" },
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "Custom", value: "custom" },
];

/**
 * Generate a visually distinct color for any core index using HSL.
 * Distributes hues evenly around the color wheel — supports 64+ cores.
 * Even cores: full saturation. Odd cores: slightly lighter for contrast.
 */
function getCoreColor(index: number, total: number): string {
  const hue = Math.round((index / Math.max(total, 1)) * 360);
  const saturation = 85;
  const lightness = index % 2 === 0 ? 58 : 70; // alternate lightness for visual separation
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}


function MiniCoreChart({
  data,
  coreKey,
  label,
  color,
  gradientId,
}: {
  data: any[];
  coreKey: string;
  label: string;
  color: string;
  gradientId: string;
}) {
  const CustomTooltip = ({ active, payload, label: lbl }: any) => {
    if (active && payload && payload.length) {
      const isGap = payload[0]?.payload?.isGap;
      const val = payload[0]?.value;
      return (
        <div className="bg-popover border border-border px-3 py-2 rounded-lg shadow-xl text-xs font-mono">
          <p className="text-muted-foreground mb-1">{payload[0]?.payload?.fullDate || lbl}</p>
          {isGap || val === null || val === undefined ? (
            <p className="font-bold text-destructive">Offline / Gap</p>
          ) : (
            <p style={{ color }} className="font-bold">
              {Number(val).toFixed(1)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const hasData = data.some((d) => d[coreKey] !== undefined && d[coreKey] !== null);

  return (
    <div className="bg-card/60 border border-border/60 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-foreground">{label}</span>
        </div>
        {hasData && (
          <span className="text-xs font-mono font-bold" style={{ color }}>
            {Number(data[data.length - 1]?.[coreKey] ?? 0).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="h-[120px] w-full">
        {!hasData ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-[11px] text-muted-foreground opacity-50">No data</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-[0.07]" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "currentColor", opacity: 0.4 }} tickLine={false} axisLine={false} minTickGap={40} />
              <YAxis tick={{ fontSize: 9, fill: "currentColor", opacity: 0.4 }} tickLine={false} axisLine={false} domain={[0, 100]} tickCount={3} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={coreKey}
                stroke={color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function AgentCharts({
  agentId,
  selectedMetric,
  onClose,
}: {
  agentId: string;
  selectedMetric: "cpu" | "ram" | "disk" | "load" | "net" | null;
  onClose?: () => void;
}) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState("1h");
  const [coreCount, setCoreCount] = useState(0);

  const [sinceDate, setSinceDate] = useState("");
  const [untilDate, setUntilDate] = useState("");

  useEffect(() => {
    let mounted = true;
    async function fetchMetrics() {
      if (!selectedMetric) return;
      try {
        setLoading(true);
        let url = `/api/dashboard/agents/${agentId}/metrics?range=${range}`;
        if (range === "custom" && sinceDate && untilDate) {
          url += `&since=${new Date(sinceDate).toISOString()}&until=${new Date(untilDate).toISOString()}`;
        }

        const res = await fetch(url);
        const result = await res.json();

        if (!mounted) return;

        if (result.success) {
          // First pass: find maximum core count across all buckets
          let maxCores = 0;
          for (const row of result.data) {
            let cores = row.cpuCoresAvg || [];
            if (typeof cores === "string") {
              try { cores = JSON.parse(cores); } catch { cores = []; }
            }
            if (Array.isArray(cores) && cores.length > maxCores) {
              maxCores = cores.length;
            }
          }
          if (maxCores > 0) setCoreCount(maxCores);

          // Sort raw buckets by bucketStart ascending
          const sortedBuckets = [...result.data].sort(
            (a: any, b: any) => new Date(a.bucketStart).getTime() - new Date(b.bucketStart).getTime()
          );

          const formatted: any[] = [];

          for (let i = 0; i < sortedBuckets.length; i++) {
            const row = sortedBuckets[i];
            const date = new Date(row.bucketStart);
            const timeMs = date.getTime();
            const bucketSizeSec = row.bucketSizeSec || 60;
            const maxGapMs = Math.max(bucketSizeSec * 2.5 * 1000, 2 * 60 * 1000); // 2.5x bucket size or min 2 mins

            // If there's a gap between previous bucket and current bucket
            if (i > 0) {
              const prevDate = new Date(sortedBuckets[i - 1].bucketStart);
              const prevMs = prevDate.getTime();
              const gapMs = timeMs - prevMs;

              if (gapMs > maxGapMs) {
                const gapStart = new Date(prevMs + bucketSizeSec * 1000);
                const gapEnd = new Date(timeMs - bucketSizeSec * 1000);

                const nullCores: Record<string, null> = {};
                for (let c = 0; c < maxCores; c++) {
                  nullCores[`core_${c}`] = null;
                }

                formatted.push({
                  time: gapStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  fullDate: `${gapStart.toLocaleString()} (Offline / Gap)`,
                  cpu: null,
                  cpuMax: null,
                  ram: null,
                  disk: null,
                  load: null,
                  rx: null,
                  tx: null,
                  isGap: true,
                  ...nullCores,
                });

                if (gapEnd.getTime() > gapStart.getTime() + bucketSizeSec * 1000) {
                  formatted.push({
                    time: gapEnd.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    fullDate: `${gapEnd.toLocaleString()} (Offline / Gap)`,
                    cpu: null,
                    cpuMax: null,
                    ram: null,
                    disk: null,
                    load: null,
                    rx: null,
                    tx: null,
                    isGap: true,
                    ...nullCores,
                  });
                }
              }
            }

            let cpuCoresAvg = row.cpuCoresAvg || [];
            if (typeof cpuCoresAvg === "string") {
              try { cpuCoresAvg = JSON.parse(cpuCoresAvg); } catch { cpuCoresAvg = []; }
            }
            if (!Array.isArray(cpuCoresAvg)) cpuCoresAvg = [];

            // Map all detected cores — null if missing in this bucket
            const coreData: Record<string, number | null> = {};
            for (let c = 0; c < maxCores; c++) {
              coreData[`core_${c}`] = cpuCoresAvg[c] !== undefined ? cpuCoresAvg[c] : null;
            }

            formatted.push({
              time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              fullDate: date.toLocaleString(),
              cpu: row.cpuAvg !== undefined && row.cpuAvg !== null ? row.cpuAvg : null,
              cpuMax: row.cpuMax !== undefined && row.cpuMax !== null ? row.cpuMax : null,
              ram: row.memAvg !== undefined && row.memAvg !== null ? row.memAvg : null,
              disk: row.diskAvg !== undefined && row.diskAvg !== null ? row.diskAvg : null,
              load: row.loadAvg !== undefined && row.loadAvg !== null ? row.loadAvg : null,
              rx: row.rxSum ? row.rxSum / (row.bucketSizeSec * 1024 * 1024) : 0,
              tx: row.txSum ? row.txSum / (row.bucketSizeSec * 1024 * 1024) : 0,
              isGap: false,
              ...coreData,
            });
          }

          setData(formatted);
          setError("");
        } else {
          setError(result.error || "Failed to load metrics");
        }
      } catch (err: any) {
        if (mounted) setError(err.message || "Network error");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [agentId, range, sinceDate, untilDate, selectedMetric]);

  if (!selectedMetric) return null;

  const getChartTitle = () => {
    switch (selectedMetric) {
      case "cpu": return "CPU Usage Details";
      case "ram": return "Memory Usage Details";
      case "disk": return "Disk Usage Details";
      case "load": return "System Load (1m) Details";
      case "net": return "Network Traffic Details";
      default: return "";
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isGap = payload[0]?.payload?.isGap;

      return (
        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl text-sm min-w-[160px]">
          <p className="font-bold text-foreground mb-2 pb-2 border-b border-border/50 text-xs">
            {payload[0]?.payload?.fullDate || label}
          </p>
          {isGap ? (
            <div className="py-1 text-xs font-semibold text-destructive text-center">
              Agent Offline / No Data
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {payload.map((p: any, i: number) => {
                const val = p.value !== undefined && p.value !== null ? Number(p.value).toFixed(2) : "—";
                const unit = p.name.includes("Network") ? " MB/s" : p.name.includes("Load") ? "" : "%";
                return (
                  <div key={i} className="flex items-center justify-between gap-4 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-muted-foreground">{p.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{p.value !== null ? `${val}${unit}` : "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="animate-fade-in w-full h-full flex flex-col">
      {/* Header */}
      <div className="pb-4 border-b border-border/50 bg-background/50 sticky top-0 z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 pt-6">
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            {selectedMetric === "cpu" && <Cpu className="w-5 h-5 text-red-500" />}
            {getChartTitle()}
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {range === "custom" && (
              <div className="flex items-center gap-2 animate-fade-in">
                <Input
                  type="datetime-local"
                  className="h-8 text-xs font-mono w-[175px]"
                  value={sinceDate}
                  onChange={(e) => setSinceDate(e.target.value)}
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="datetime-local"
                  className="h-8 text-xs font-mono w-[175px]"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                />
              </div>
            )}
            <div className="flex bg-muted p-1 rounded-lg">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    range === r.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="ml-1 p-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6 overflow-y-auto">
        {error ? (
          <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm font-medium">
            Failed to load charts: {error}
          </div>
        ) : loading && data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-4">
            <Loader2 className="animate-spin w-8 h-8 text-primary" />
            <span className="text-sm font-medium">Loading metrics data...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-muted-foreground gap-4">
            <Calendar className="w-8 h-8 opacity-20" />
            <span className="text-sm font-medium">No metric history available for this time range.</span>
          </div>
        ) : selectedMetric === "cpu" ? (
          // ── CPU: 5-panel grid (All CPU + Core 0-3) ──────────────────────────
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* All CPU — full-width on md, spans 2 on xl */}
            <div className="md:col-span-2 xl:col-span-3 bg-card/60 border border-border/60 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-xs font-semibold text-foreground">All CPU (Average)</span>
                </div>
                <span className="text-xs font-mono font-bold text-red-400">
                  {Number(data[data.length - 1]?.cpu ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="h-[160px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAllCpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-[0.07]" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: "currentColor", opacity: 0.4 }} tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis tick={{ fontSize: 9, fill: "currentColor", opacity: 0.4 }} tickLine={false} axisLine={false} domain={[0, 100]} tickCount={5} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: 11, opacity: 0.8 }} />
                    <Area type="monotone" name="Avg Overall CPU" dataKey="cpu" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#gradAllCpu)" dot={false} connectNulls={false} isAnimationActive={false} />
                    <Line type="monotone" name="Max CPU" dataKey="cpuMax" stroke="#fca5a5" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Per-Core Mini Charts — dynamic based on actual agent core count */}
            {coreCount === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 flex items-center justify-center p-8 text-muted-foreground text-sm">
                <span>Per-core data not yet available. Waiting for agent metrics...</span>
              </div>
            ) : (
              Array.from({ length: coreCount }).map((_, i) => (
                <MiniCoreChart
                  key={`core_${i}`}
                  data={data}
                  coreKey={`core_${i}`}
                  label={`CPU Core ${i}`}
                  color={getCoreColor(i, coreCount)}
                  gradientId={`gradCore${i}`}
                />
              ))
            )}
          </div>
        ) : (
          // ── Non-CPU: single full chart ──────────────────────────────────────
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {selectedMetric === "ram" ? (
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, opacity: 0.8 }} />
                  <Area type="monotone" name="RAM Usage" dataKey="ram" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRam)" dot={false} connectNulls={false} isAnimationActive={false} />
                </AreaChart>
              ) : selectedMetric === "disk" ? (
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, opacity: 0.8 }} />
                  <Area type="monotone" name="Disk Usage" dataKey="disk" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorDisk)" dot={false} connectNulls={false} isAnimationActive={false} />
                </AreaChart>
              ) : selectedMetric === "load" ? (
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, opacity: 0.8 }} />
                  <Area type="monotone" name="Load Avg (1m)" dataKey="load" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorLoad)" dot={false} connectNulls={false} isAnimationActive={false} />
                </AreaChart>
              ) : (
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, opacity: 0.8 }} />
                  <Line type="monotone" name="Network RX" dataKey="rx" stroke="#10b981" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line type="monotone" name="Network TX" dataKey="tx" stroke="#6366f1" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
