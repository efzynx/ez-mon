/**
 * Tujuan: Monitor History Chart — desain status-timeline bar + latency sparkline
 * Caller: cloud-monitors.tsx (expandable row per monitor)
 * Dependensi: /api/dashboard/cloud-monitors/history, recharts (LineChart), lucide-react
 * Main Functions: MonitorHistoryChart (default export)
 * Visual Design: BERBEDA dari agents/overview charts:
 *   - Status Timeline: deretan kotak-kotak kecil berwarna (hijau=up, merah=down, abu=no data)
 *     mirip UptimeRobot/BetterUptime — bukan area chart
 *   - Latency Sparkline: garis tipis minimalis di bawah timeline, bukan panel besar
 *   - Summary pills: uptime%, avg latency, p95 — compact dan horizontal
 *   - Dark glassmorphism card tanpa border card tebal
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Loader2, TrendingUp, Clock, Activity, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckPoint {
  id: string;
  status: string;
  httpStatus: number | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

interface HistoryData {
  monitor: { id: string; name: string; url: string; type: string; intervalSec: number };
  hours: number;
  summary: {
    total: number;
    upCount: number;
    downCount: number;
    uptime: number | null;
    avgLatency: number | null;
    p95Latency: number | null;
  };
  results: CheckPoint[];
}

interface MonitorHistoryChartProps {
  monitorId: string;
  hours?: number;
}

// ─── Status Timeline (signature UptimeRobot-style boxes) ─────────────────────

function StatusTimeline({ results, intervalSec }: { results: CheckPoint[]; intervalSec: number }) {
  // Max 90 boxes (tampilan yang nyaman)
  const maxBoxes = 90;
  const displayed = results.slice(-maxBoxes);

  if (displayed.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground/60 py-2">
        <AlertCircle size={12} />
        No check data yet
      </div>
    );
  }

  const intervalLabel = intervalSec < 60
    ? `${intervalSec}s interval`
    : `${Math.floor(intervalSec / 60)}m interval`;

  return (
    <div>
      <div className="flex items-end gap-[2px] h-8">
        {displayed.map((point, i) => {
          const isUp = point.status === "up";
          const isDown = point.status === "down";
          return (
            <div
              key={point.id}
              className="group relative flex-1 min-w-0"
              style={{ height: "100%" }}
            >
              <div
                className={`w-full h-full rounded-[2px] transition-opacity ${
                  isUp
                    ? "bg-emerald-500 group-hover:bg-emerald-400"
                    : isDown
                    ? "bg-red-500 group-hover:bg-red-400"
                    : "bg-muted-foreground/20"
                }`}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-popover border border-border rounded-md shadow-xl p-2 text-[10px] whitespace-nowrap">
                  <div className={`font-semibold mb-0.5 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {isUp ? "UP" : isDown ? "DOWN" : "Unknown"}
                  </div>
                  {point.httpStatus && (
                    <div className="text-muted-foreground">HTTP {point.httpStatus}</div>
                  )}
                  {point.latencyMs !== null && (
                    <div className="text-muted-foreground">{point.latencyMs}ms</div>
                  )}
                  {point.error && (
                    <div className="text-red-400 max-w-[160px] truncate">{point.error}</div>
                  )}
                  <div className="text-muted-foreground/60 mt-0.5">
                    {new Date(point.checkedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-1">
        <span>{displayed.length > 0 ? new Date(displayed[0].checkedAt).toLocaleDateString() : ""}</span>
        <span className="text-center">{intervalLabel}</span>
        <span>Now</span>
      </div>
    </div>
  );
}

// ─── Latency Sparkline ────────────────────────────────────────────────────────

function LatencySparkline({ results }: { results: CheckPoint[] }) {
  const data = useMemo(() => {
    return results
      .filter(r => r.latencyMs !== null)
      .slice(-60) // Max 60 puntos
      .map(r => ({
        time: new Date(r.checkedAt).getTime(),
        latency: r.latencyMs,
        status: r.status,
      }));
  }, [results]);

  if (data.length < 2) {
    return null;
  }

  const maxLatency = Math.max(...data.map(d => d.latency ?? 0));
  const avgLatency = Math.round(data.reduce((a, b) => a + (b.latency ?? 0), 0) / data.length);

  // Custom tooltip yang minimalis
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border/50 rounded px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
        {payload[0]?.value}ms
      </div>
    );
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
          Latency
        </span>
        <span className="text-[10px] text-muted-foreground/60">peak {maxLatency}ms</span>
      </div>
      <div className="h-14 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <defs>
              <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.6}/>
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <ReferenceLine
              y={avgLatency}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="2 2"
              strokeOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="latency"
              stroke="#0ea5e9"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorLatency)"
              activeDot={{ r: 4, fill: "#0ea5e9", stroke: "hsl(var(--background))", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Summary Pills ────────────────────────────────────────────────────────────

function SummaryPills({ summary }: { summary: HistoryData["summary"] }) {
  const uptimeColor =
    summary.uptime === null
      ? "text-muted-foreground"
      : summary.uptime >= 99
      ? "text-emerald-400"
      : summary.uptime >= 95
      ? "text-amber-400"
      : "text-red-400";

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <Activity size={11} className={uptimeColor} />
        <span className={`text-xs font-bold tabular-nums ${uptimeColor}`}>
          {summary.uptime !== null ? `${summary.uptime}%` : "—"}
        </span>
        <span className="text-[10px] text-muted-foreground/60">uptime</span>
      </div>

      {summary.avgLatency !== null && (
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-muted-foreground/60" />
          <span className="text-xs font-bold tabular-nums text-foreground/80">
            {summary.avgLatency}ms
          </span>
          <span className="text-[10px] text-muted-foreground/60">avg</span>
        </div>
      )}

      {summary.p95Latency !== null && (
        <div className="flex items-center gap-1.5">
          <TrendingUp size={11} className="text-muted-foreground/60" />
          <span className="text-xs font-bold tabular-nums text-foreground/80">
            {summary.p95Latency}ms
          </span>
          <span className="text-[10px] text-muted-foreground/60">p95</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground/60">
        <span>
          <span className="inline-block w-2 h-2 rounded-[1px] bg-emerald-500 mr-1 align-middle" />
          {summary.upCount} up
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-[1px] bg-red-500 mr-1 align-middle" />
          {summary.downCount} down
        </span>
        <span>{summary.total} total checks</span>
      </div>
    </div>
  );
}

// ─── Time Range Selector ──────────────────────────────────────────────────────

const TIME_RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function MonitorHistoryChart({ monitorId, hours: defaultHours = 24 }: MonitorHistoryChartProps) {
  const [hours, setHours] = useState(defaultHours);
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/cloud-monitors/history?monitorId=${monitorId}&hours=${hours}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d.data);
        else setError(d.error ?? "Failed to load");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [monitorId, hours]);

  return (
    <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-border/50">
      {/* Time Range Tabs */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-medium">
          Check History
        </span>
        <div className="flex items-center gap-0.5 bg-muted/30 rounded-md p-0.5">
          {TIME_RANGES.map(range => (
            <button
              key={range.hours}
              onClick={() => setHours(range.hours)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded transition-colors ${
                hours === range.hours
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 size={12} className="animate-spin" />
          Loading check history...
        </div>
      ) : error ? (
        <div className="text-xs text-destructive py-2">{error}</div>
      ) : data ? (
        <div className="space-y-3">
          {/* Summary stats */}
          <SummaryPills summary={data.summary} />

          {/* Status timeline boxes */}
          <StatusTimeline results={data.results} intervalSec={data.monitor.intervalSec} />

          {/* Latency sparkline */}
          <LatencySparkline results={data.results} />
        </div>
      ) : null}
    </div>
  );
}
