/**
 * Tujuan: Endpoint "Check Now" untuk Cloud Monitor — menjalankan HTTP/TLS/Keyword check secara inline
 * Caller: Dashboard UI (tombol "Check Now" di cloud-monitors.tsx)
 * Dependensi: db() singleton, auth(), cloudMonitors + cloudCheckResults tables
 * Main Functions: POST (jalankan check langsung untuk satu monitor)
 * Side Effects:
 *   - HTTP GET/HEAD ke URL target monitor (outbound)
 *   - DB INSERT cloud_check_results
 *   - DB UPDATE cloud_monitors (lastStatus, lastCheckedAt, lastLatencyMs, nextCheckAt)
 *
 * Catatan: Endpoint ini dimaksudkan untuk trigger manual/testing.
 *   Di production, Worker Cron yang menjalankan check secara periodik.
 *   Di local dev, gunakan endpoint ini karena Worker tidak berjalan.
 *
 * DB Justification:
 *   - Single INSERT + single UPDATE per call — minimal I/O
 *   - Verifikasi ownership via JOIN ke projects sebelum check
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  cloudMonitors,
  cloudCheckResults,
  projects,
  eq,
  and,
} from "@ezmon/db";

// ─── Inline Check Logic (mirror dari Worker, tanpa crt.sh untuk TLS) ──────────

interface CheckResult {
  status: "up" | "down";
  httpStatus: number | null;
  latencyMs: number | null;
  error: string | null;
  keywordFound: boolean | null;
  tlsDaysRemaining: number | null;
}

async function runHttpCheck(
  url: string,
  expectedStatus: number | null,
  timeoutSec: number
): Promise<CheckResult> {
  const startMs = Date.now();
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutSec * 1000),
    });
    const latencyMs = Date.now() - startMs;
    const isUp =
      expectedStatus !== null
        ? resp.status === expectedStatus
        : resp.status >= 200 && resp.status < 300;
    return {
      status: isUp ? "up" : "down",
      httpStatus: resp.status,
      latencyMs,
      error: isUp ? null : `Unexpected status ${resp.status}`,
      keywordFound: null,
      tlsDaysRemaining: null,
    };
  } catch (e) {
    return {
      status: "down",
      httpStatus: null,
      latencyMs: Date.now() - startMs,
      error: String(e),
      keywordFound: null,
      tlsDaysRemaining: null,
    };
  }
}

async function runTlsCheck(
  url: string,
  timeoutSec: number
): Promise<CheckResult> {
  const startMs = Date.now();
  if (!url.startsWith("https://")) {
    return {
      status: "down",
      httpStatus: null,
      latencyMs: 0,
      error: "URL must use HTTPS for TLS check",
      keywordFound: null,
      tlsDaysRemaining: null,
    };
  }
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutSec * 1000),
    });
    const latencyMs = Date.now() - startMs;

    // Lookup TLS expiry via crt.sh
    let tlsDaysRemaining: number | null = null;
    try {
      const hostname = new URL(url).hostname;
      const crtResp = await fetch(
        `https://crt.sh/?q=${hostname}&output=json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (crtResp.ok) {
        const certs = (await crtResp.json()) as Array<{ not_after: string }>;
        if (certs.length > 0) {
          const sorted = certs
            .map((c) => ({
              daysLeft: Math.floor(
                (new Date(c.not_after).getTime() - Date.now()) / 86400000
              ),
            }))
            .filter((c) => c.daysLeft >= 0)
            .sort((a, b) => b.daysLeft - a.daysLeft);
          tlsDaysRemaining = sorted[0]?.daysLeft ?? null;
        }
      }
    } catch {
      // crt.sh unreachable — tidak blocking
    }

    const isUp = resp.status >= 200 && resp.status < 400;
    return {
      status: isUp ? "up" : "down",
      httpStatus: resp.status,
      latencyMs,
      error: isUp ? null : `TLS fetch returned ${resp.status}`,
      keywordFound: null,
      tlsDaysRemaining,
    };
  } catch (e) {
    return {
      status: "down",
      httpStatus: null,
      latencyMs: Date.now() - startMs,
      error: `TLS error: ${String(e)}`,
      keywordFound: null,
      tlsDaysRemaining: null,
    };
  }
}

async function runKeywordCheck(
  url: string,
  keyword: string,
  timeoutSec: number
): Promise<CheckResult> {
  const startMs = Date.now();
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutSec * 1000),
    });
    const latencyMs = Date.now() - startMs;
    const text = await resp.text();
    const keywordFound = text.includes(keyword);
    return {
      status: keywordFound ? "up" : "down",
      httpStatus: resp.status,
      latencyMs,
      error: keywordFound ? null : `Keyword "${keyword}" not found`,
      keywordFound,
      tlsDaysRemaining: null,
    };
  } catch (e) {
    return {
      status: "down",
      httpStatus: null,
      latencyMs: Date.now() - startMs,
      error: String(e),
      keywordFound: false,
      tlsDaysRemaining: null,
    };
  }
}

// ─── POST /api/dashboard/cloud-monitors/check ─────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { monitorId } = body as { monitorId?: string };

  if (!monitorId) {
    return NextResponse.json({ success: false, error: "monitorId is required" }, { status: 400 });
  }

  // Ambil monitor + verifikasi ownership via JOIN ke projects
  const [monitor] = await db()
    .select({
      id: cloudMonitors.id,
      url: cloudMonitors.url,
      type: cloudMonitors.type,
      keyword: cloudMonitors.keyword,
      expectedStatus: cloudMonitors.expectedStatus,
      timeoutSec: cloudMonitors.timeoutSec,
      intervalSec: cloudMonitors.intervalSec,
      status: cloudMonitors.status,
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

  if (monitor.status === "paused") {
    return NextResponse.json({ success: false, error: "Monitor is paused" }, { status: 400 });
  }

  // Jalankan check sesuai type
  let result: CheckResult;
  if (monitor.type === "tls") {
    result = await runTlsCheck(monitor.url, monitor.timeoutSec);
  } else if (monitor.type === "keyword" && monitor.keyword) {
    result = await runKeywordCheck(monitor.url, monitor.keyword, monitor.timeoutSec);
  } else {
    result = await runHttpCheck(monitor.url, monitor.expectedStatus, monitor.timeoutSec);
  }

  // Simpan hasil ke cloud_check_results
  await db().insert(cloudCheckResults).values({
    monitorId: monitor.id,
    status: result.status,
    httpStatus: result.httpStatus,
    latencyMs: result.latencyMs,
    error: result.error,
    keywordFound: result.keywordFound,
    tlsDaysRemaining: result.tlsDaysRemaining,
  });

  // Update cloud_monitors snapshot
  const nextCheckAt = new Date(Date.now() + monitor.intervalSec * 1000);
  const tlsExpiresAt =
    result.tlsDaysRemaining !== null
      ? new Date(Date.now() + result.tlsDaysRemaining * 86400000)
      : undefined;

  await db()
    .update(cloudMonitors)
    .set({
      lastStatus: result.status,
      lastCheckedAt: new Date(),
      lastLatencyMs: result.latencyMs,
      nextCheckAt,
      ...(tlsExpiresAt ? { tlsExpiresAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(cloudMonitors.id, monitor.id));

  return NextResponse.json({
    success: true,
    data: {
      status: result.status,
      httpStatus: result.httpStatus,
      latencyMs: result.latencyMs,
      error: result.error,
      keywordFound: result.keywordFound,
      tlsDaysRemaining: result.tlsDaysRemaining,
    },
  });
}
