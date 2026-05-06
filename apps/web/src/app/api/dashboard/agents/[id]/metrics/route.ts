// Tujuan: Endpoint fetch history metrics bucket (5-minute aggregated)
// Caller: Dashboard agent detail page chart component
// Dependensi: @ezmon/db (agents, projects, metricBuckets), @/lib/auth, @/lib/db
// Main Functions: GET handler
// Side Effects: DB SELECT from metric_buckets

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { agents, projects, metricBuckets, eq, and, gte, lte, asc } from "@ezmon/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const agentId = resolvedParams.id;

    // Verify ownership
    const agentRows = await db()
      .select({ id: agents.id })
      .from(agents)
      .innerJoin(projects, eq(agents.projectId, projects.id))
      .where(and(eq(agents.id, agentId), eq(projects.userId, session.user.id)))
      .limit(1);

    if (agentRows.length === 0) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const rangeParam = req.nextUrl.searchParams.get("range") || "24h";
    let since = new Date(Date.now() - 24 * 60 * 60 * 1000); // default 24h
    let until = new Date(); // now

    if (rangeParam === "5m") {
      since = new Date(Date.now() - 5 * 60 * 1000);
    } else if (rangeParam === "10m") {
      since = new Date(Date.now() - 10 * 60 * 1000);
    } else if (rangeParam === "30m") {
      since = new Date(Date.now() - 30 * 60 * 1000);
    } else if (rangeParam === "1h") {
      since = new Date(Date.now() - 60 * 60 * 1000);
    } else if (rangeParam === "24h") {
      since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (rangeParam === "7d") {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (rangeParam === "custom") {
      const sinceParam = req.nextUrl.searchParams.get("since");
      const untilParam = req.nextUrl.searchParams.get("until");
      if (sinceParam) since = new Date(sinceParam);
      if (untilParam) until = new Date(untilParam);

      // Validate custom min 5m max 7d (rough check)
      const diffMs = until.getTime() - since.getTime();
      const minMs = 5 * 60 * 1000;
      const maxMs = 7 * 24 * 60 * 60 * 1000;
      
      if (diffMs < minMs) {
        since = new Date(until.getTime() - minMs);
      } else if (diffMs > maxMs) {
        since = new Date(until.getTime() - maxMs);
      }
    }

    const history = await db()
      .select()
      .from(metricBuckets)
      .where(
        and(
          eq(metricBuckets.agentId, agentId),
          gte(metricBuckets.bucketStart, since),
          lte(metricBuckets.bucketStart, until)
        )
      )
      .orderBy(asc(metricBuckets.bucketStart));

    return NextResponse.json({ success: true, data: history });
  } catch (error) {
    console.error("[agent/metrics] GET Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
