// Tujuan: Notification channels CRUD API — list, create, toggle, delete
// Caller: Dashboard notifications page (/dashboard/notifications)
// Dependensi: @ezmon/db (notificationChannels, projects), @/lib/auth, @/lib/db, @ezmon/shared validators
// Main Functions: GET, POST, PATCH, DELETE handlers
// Side Effects: DB SELECT/INSERT/UPDATE/DELETE di tabel notification_channels

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notificationChannels, projects, eq, and } from "@ezmon/db";
import { createNotificationChannelSchema } from "@ezmon/shared";

// ─── Helper: Verify project ownership ────────────────────────────────────────

async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await db()
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return project.length > 0;
}

// ─── Helper: Verify channel belongs to user's project ────────────────────────

async function verifyChannelOwnership(
  channelId: string,
  userId: string
): Promise<{ projectId: string } | null> {
  const rows = await db()
    .select({ projectId: notificationChannels.projectId })
    .from(notificationChannels)
    .innerJoin(projects, eq(notificationChannels.projectId, projects.id))
    .where(
      and(
        eq(notificationChannels.id, channelId),
        eq(projects.userId, userId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

// ─── GET — List channels for a project ───────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ success: false, error: "projectId required" }, { status: 400 });
    }

    const owned = await verifyProjectOwnership(projectId, session.user.id);
    if (!owned) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const channels = await db()
      .select()
      .from(notificationChannels)
      .where(eq(notificationChannels.projectId, projectId))
      .orderBy(notificationChannels.createdAt);

    return NextResponse.json({ success: true, data: channels });
  } catch (error) {
    console.error("[notifications] GET Error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// ─── POST — Create new channel ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, ...rest } = body;

    if (!projectId) {
      return NextResponse.json({ success: false, error: "projectId required" }, { status: 400 });
    }

    // Validate channel config via Zod (Rule 11)
    const parsed = createNotificationChannelSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const owned = await verifyProjectOwnership(projectId, session.user.id);
    if (!owned) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const { type, name, config, enabled, notifyOn } = parsed.data;
    const result = await db()
      .insert(notificationChannels)
      .values({ projectId, type, name, configJson: config, enabled, notifyOn })
      .returning();

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error) {
    console.error("[notifications] POST Error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// ─── PATCH — Toggle enabled/disabled ─────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { channelId, enabled, notifyOn } = body;

    if (!channelId || (typeof enabled !== "boolean" && !notifyOn)) {
      return NextResponse.json(
        { success: false, error: "channelId and at least one of enabled or notifyOn required" },
        { status: 400 }
      );
    }

    const owned = await verifyChannelOwnership(channelId, session.user.id);
    if (!owned) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const setData: Record<string, unknown> = {};
    if (typeof enabled === "boolean") setData.enabled = enabled;
    if (notifyOn) setData.notifyOn = notifyOn;

    const result = await db()
      .update(notificationChannels)
      .set(setData)
      .where(eq(notificationChannels.id, channelId))
      .returning({ id: notificationChannels.id, enabled: notificationChannels.enabled, notifyOn: notificationChannels.notifyOn });

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("[notifications] PATCH Error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

// ─── DELETE — Remove channel ──────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const channelId = req.nextUrl.searchParams.get("channelId");
    if (!channelId) {
      return NextResponse.json({ success: false, error: "channelId required" }, { status: 400 });
    }

    // Verify ownership before delete (Rule 24 — least privilege)
    const owned = await verifyChannelOwnership(channelId, session.user.id);
    if (!owned) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    await db()
      .delete(notificationChannels)
      .where(eq(notificationChannels.id, channelId));

    return NextResponse.json({ success: true, message: "Channel deleted" });
  } catch (error) {
    console.error("[notifications] DELETE Error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
