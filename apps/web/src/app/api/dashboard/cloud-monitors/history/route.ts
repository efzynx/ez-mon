/**
 * Tujuan: History endpoint untuk Cloud Monitor — ambil hasil check terbaru
 * Caller: Dashboard UI (monitor history chart di /dashboard/monitors)
 * Dependensi: db(), auth(), cloudCheckResults table, cloudMonitors table
 * Main Functions: GET (paginated check results untuk satu monitor)
 * Side Effects: DB SELECT (index: monitor_id + checked_at)
 *
 * Query Design:
 *   - Filter by monitorId (indexed FK)
 *   - hours parameter untuk lookback window (default 24h, max 168h/7 hari)
 *   - ORDER BY checked_at DESC untuk chart timeline
 *   - Max 500 rows per request (cukup untuk 1 minggu di interval 1 menit)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  cloudCheckResults,
  cloudMonitors,
  projects,
  eq,
  and,
  gte,
  desc,
  sql,
} from "@ezmon/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const monitorId = searchParams.get("monitorId");
  const hoursRaw = parseInt(searchParams.get("hours") ?? "24");
  const hours = Math.min(Math.max(hoursRaw, 1), 168); // clamp 1h–7d

  if (!monitorId) {
    return NextResponse.json({ success: false, error: "monitorId is required" }, { status: 400 });
  }

  // Verifikasi ownership monitor via JOIN ke projects
  const [monitor] = await db()
    .select({
      id: cloudMonitors.id,
      name: cloudMonitors.name,
      url: cloudMonitors.url,
      type: cloudMonitors.type,
      intervalSec: cloudMonitors.intervalSec,
    })
    .from(cloudMonitors)
    .innerJoin(projects, eq(cloudMonitors.projectId, projects.id))
    .where(
      and(
        eq(cloudMonitors.id, monitorId),
        eq(projects.userId, session.user.id)
      )
    )
    .limit(1);

  if (!monitor) {
    return NextResponse.json({ success: false, error: "Monitor not found" }, { status: 404 });
  }

  // Hitung cutoff time
  const cutoff = new Date(Date.now() - hours * 3600 * 1000);

  // Ambil check results dalam window — index pada (monitor_id, checked_at)
  const results = await db()
    .select({
      id: cloudCheckResults.id,
      status: cloudCheckResults.status,
      httpStatus: cloudCheckResults.httpStatus,
      latencyMs: cloudCheckResults.latencyMs,
      error: cloudCheckResults.error,
      keywordFound: cloudCheckResults.keywordFound,
      tlsDaysRemaining: cloudCheckResults.tlsDaysRemaining,
      checkedAt: cloudCheckResults.checkedAt,
    })
    .from(cloudCheckResults)
    .where(
      and(
        eq(cloudCheckResults.monitorId, monitorId),
        gte(cloudCheckResults.checkedAt, cutoff)
      )
    )
    .orderBy(desc(cloudCheckResults.checkedAt))
    .limit(500);

  // Hitung summary stats dari window
  const total = results.length;
  const upCount = results.filter(r => r.status === "up").length;
  const downCount = results.filter(r => r.status === "down").length;
  const uptime = total > 0 ? Math.round((upCount / total) * 10000) / 100 : null;

  const validLatencies = results
    .map(r => r.latencyMs)
    .filter((v): v is number => v !== null);
  const avgLatency = validLatencies.length > 0
    ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
    : null;
  const p95Latency = validLatencies.length > 0
    ? (() => {
        const sorted = [...validLatencies].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.95)] ?? null;
      })()
    : null;

  return NextResponse.json({
    success: true,
    data: {
      monitor,
      hours,
      summary: { total, upCount, downCount, uptime, avgLatency, p95Latency },
      // Results sudah DESC, reverse untuk chart timeline (kiri = lama, kanan = baru)
      results: results.reverse(),
    },
  });
}
