/**
 * Tujuan: CRUD endpoint untuk Cloud Monitors (Phase 5)
 * Caller: Dashboard UI (cloud-monitors.tsx), Cloudflare Worker evaluator (baca data langsung via Neon)
 * Dependensi: db() singleton, auth(), cloudMonitors table, createCloudMonitorSchema, updateCloudMonitorSchema
 * Main Functions: GET (list monitors), POST (create), PATCH (update/toggle), DELETE (hapus)
 * Side Effects:
 *   - GET: DB SELECT (JOIN projects untuk project-scoped auth)
 *   - POST: DB INSERT cloud_monitors, SET nextCheckAt = NOW() agar evaluator segera memproses
 *   - PATCH: DB UPDATE cloud_monitors (partial fields)
 *   - DELETE: DB DELETE cloud_monitors CASCADE ke cloud_check_results
 *
 * DB Justification:
 *   - Semua query filter by project_id yang merupakan FK terindeks di cloud_monitors
 *   - JOIN ke projects untuk memastikan user hanya akses project miliknya (ownership check)
 *   - Limit 20 monitors per project enforced di POST untuk menjaga biaya free-tier
 *   - nextCheckAt di-set = NOW() saat create agar evaluator segera tahu ada monitor baru
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  cloudMonitors,
  projects,
  eq,
  and,
  sql,
} from "@ezmon/db";
import {
  createCloudMonitorSchema,
  updateCloudMonitorSchema,
} from "@ezmon/shared";

// ─── GET — List cloud monitors (project-scoped) ───────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
  }

  // Verifikasi project milik user yang sedang login
  const [project] = await db()
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  const monitors = await db()
    .select()
    .from(cloudMonitors)
    .where(eq(cloudMonitors.projectId, projectId))
    .orderBy(cloudMonitors.createdAt);

  return NextResponse.json({ success: true, data: monitors });
}

// ─── POST — Create new cloud monitor ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createCloudMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const { projectId, name, url, type, intervalSec, timeoutSec, keyword, expectedStatus, showOnStatusPage } = parsed.data;

  // Verifikasi ownership project
  const [project] = await db()
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }

  // Limit 20 monitors per project — free-tier friendly
  const [{ count }] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(cloudMonitors)
    .where(eq(cloudMonitors.projectId, projectId));

  if (count >= 20) {
    return NextResponse.json(
      { success: false, error: "Maximum 20 monitors per project" },
      { status: 429 }
    );
  }

  // Set nextCheckAt = NOW() agar evaluator langsung bisa memproses di run berikutnya
  const [monitor] = await db()
    .insert(cloudMonitors)
    .values({
      projectId,
      name,
      url,
      type,
      intervalSec,
      timeoutSec,
      keyword: keyword ?? null,
      expectedStatus: expectedStatus ?? null,
      showOnStatusPage,
      status: "active",
      lastStatus: "unknown",
      nextCheckAt: new Date(),
    })
    .returning();

  return NextResponse.json({ success: true, data: monitor }, { status: 201 });
}

// ─── PATCH — Update / toggle monitor ─────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateCloudMonitorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  const { id, ...updates } = parsed.data;

  // Verifikasi monitor milik user via JOIN ke projects
  const [monitor] = await db()
    .select({ id: cloudMonitors.id, projectId: cloudMonitors.projectId })
    .from(cloudMonitors)
    .innerJoin(projects, eq(cloudMonitors.projectId, projects.id))
    .where(and(eq(cloudMonitors.id, id), eq(projects.userId, session.user.id)))
    .limit(1);

  if (!monitor) {
    return NextResponse.json({ success: false, error: "Monitor not found" }, { status: 404 });
  }

  // Jika intervalSec diubah, reset nextCheckAt agar evaluator segera re-schedule
  const extraUpdates: Record<string, unknown> = {};
  if (updates.intervalSec !== undefined) {
    extraUpdates.nextCheckAt = new Date();
  }

  const [updated] = await db()
    .update(cloudMonitors)
    .set({ ...updates, ...extraUpdates, updatedAt: new Date() })
    .where(eq(cloudMonitors.id, id))
    .returning();

  return NextResponse.json({ success: true, data: updated });
}

// ─── DELETE — Remove monitor ──────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }

  // Verifikasi ownership via JOIN ke projects
  const [monitor] = await db()
    .select({ id: cloudMonitors.id })
    .from(cloudMonitors)
    .innerJoin(projects, eq(cloudMonitors.projectId, projects.id))
    .where(and(eq(cloudMonitors.id, id), eq(projects.userId, session.user.id)))
    .limit(1);

  if (!monitor) {
    return NextResponse.json({ success: false, error: "Monitor not found" }, { status: 404 });
  }

  // CASCADE ke cloud_check_results sudah dihandle oleh FK constraint di schema
  await db().delete(cloudMonitors).where(eq(cloudMonitors.id, id));

  return NextResponse.json({ success: true });
}
