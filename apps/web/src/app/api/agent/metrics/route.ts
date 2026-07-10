import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { agents, agentState, metricBuckets, eq, and, sql } from "@ezmon/db";
import { metricsSchema, DEFAULTS } from "@ezmon/shared";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Round a timestamp down to the nearest bucket boundary.
 * For 5-minute buckets: floor to nearest 5-minute mark.
 */
function getBucketStart(timestamp: Date, bucketSizeSec: number): Date {
  const ms = timestamp.getTime();
  const bucketMs = bucketSizeSec * 1000;
  return new Date(Math.floor(ms / bucketMs) * bucketMs);
}

export async function POST(req: NextRequest) {
  try {
    // Extract Bearer token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing authorization header" },
        { status: 401 }
      );
    }
    const rawToken = authHeader.slice(7);
    const tokenHash = hashToken(rawToken);

    const body = await req.json();
    const parsed = metricsSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[agent/metrics] Validation Error:", JSON.stringify(parsed.error.errors));
      console.error("[agent/metrics] Body received:", JSON.stringify(body));
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid payload" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify agent token
    const agentResult = await db()
      .select({ id: agents.id, projectId: agents.projectId })
      .from(agents)
      .where(and(eq(agents.id, data.agentId), eq(agents.tokenHash, tokenHash)))
      .limit(1);

    if (agentResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid agent credentials" },
        { status: 401 }
      );
    }

    const collectedAt = new Date(data.timestamp);

    // 1. Upsert latest snapshot (agent_state)
    await db()
      .insert(agentState)
      .values({
        agentId: data.agentId,
        cpuPct: data.cpuPct,
        cpuCores: data.cpuCores ?? null,
        memUsedMb: data.memUsedMb,
        memTotalMb: data.memTotalMb,
        diskUsedMb: data.diskUsedMb,
        diskTotalMb: data.diskTotalMb,
        load1: data.load1 ?? null,
        netRxBps: data.netRxBps ?? null,
        netTxBps: data.netTxBps ?? null,
        containersRunning: data.containersRunning ?? null,
        collectedAt,
      })
      .onConflictDoUpdate({
        target: agentState.agentId,
        set: {
          cpuPct: data.cpuPct,
          cpuCores: data.cpuCores ?? null,
          memUsedMb: data.memUsedMb,
          memTotalMb: data.memTotalMb,
          diskUsedMb: data.diskUsedMb,
          diskTotalMb: data.diskTotalMb,
          load1: data.load1 ?? null,
          netRxBps: data.netRxBps ?? null,
          netTxBps: data.netTxBps ?? null,
          containersRunning: data.containersRunning ?? null,
          collectedAt,
        },
      });

    // 2. Aggregate into metric bucket (1-minute)
    const bucketStart = getBucketStart(collectedAt, DEFAULTS.BUCKET_SIZE_SEC);
    const cpuCoresJson = data.cpuCores ? JSON.stringify(data.cpuCores) : null;

    // Use raw SQL for the upsert with incremental aggregation
    await db().execute(sql`
      INSERT INTO metric_buckets (id, agent_id, bucket_start, bucket_size_sec, cpu_avg, cpu_max, cpu_cores_avg, mem_avg, disk_avg, load_avg, rx_sum, tx_sum, sample_count)
      VALUES (gen_random_uuid(), ${data.agentId}, ${bucketStart}, ${DEFAULTS.BUCKET_SIZE_SEC},
              ${data.cpuPct}, ${data.cpuPct}, cast(${cpuCoresJson} as json),
              ${(data.memUsedMb / data.memTotalMb) * 100},
              ${(data.diskUsedMb / data.diskTotalMb) * 100},
              ${data.load1 ?? 0},
              ${data.netRxBps ?? 0}, ${data.netTxBps ?? 0}, 1)
      ON CONFLICT (agent_id, bucket_start, bucket_size_sec) DO UPDATE SET
        cpu_avg = (metric_buckets.cpu_avg * metric_buckets.sample_count + ${data.cpuPct}) / (metric_buckets.sample_count + 1),
        cpu_max = GREATEST(metric_buckets.cpu_max, ${data.cpuPct}),
        cpu_cores_avg = cast(${cpuCoresJson} as json),
        mem_avg = (metric_buckets.mem_avg * metric_buckets.sample_count + ${(data.memUsedMb / data.memTotalMb) * 100}) / (metric_buckets.sample_count + 1),
        disk_avg = (metric_buckets.disk_avg * metric_buckets.sample_count + ${(data.diskUsedMb / data.diskTotalMb) * 100}) / (metric_buckets.sample_count + 1),
        load_avg = (COALESCE(metric_buckets.load_avg, 0) * metric_buckets.sample_count + ${data.load1 ?? 0}) / (metric_buckets.sample_count + 1),
        rx_sum = metric_buckets.rx_sum + ${data.netRxBps ?? 0},
        tx_sum = metric_buckets.tx_sum + ${data.netTxBps ?? 0},
        sample_count = metric_buckets.sample_count + 1
    `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[agent/metrics] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
