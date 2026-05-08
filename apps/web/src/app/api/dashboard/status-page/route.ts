// Tujuan: API handler untuk mengatur konfigurasi status page
// Caller: Dashboard status page settings
// Dependensi: @ezmon/db (statusPages), @ezmon/shared (saveStatusPageSchema)
// Main Functions: GET, POST
// Side Effects: DB SELECT/INSERT/UPDATE status_pages

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusPages, projects, eq, and } from "@ezmon/db";
import { saveStatusPageSchema } from "@ezmon/shared";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ success: false, error: "projectId is required" }, { status: 400 });
    }

    // Cek kepemilikan project
    const project = await db()
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const pageConfig = await db()
      .select()
      .from(statusPages)
      .where(eq(statusPages.projectId, projectId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: pageConfig.length > 0 ? {
        id: pageConfig[0].id,
        projectId: pageConfig[0].projectId,
        title: pageConfig[0].title,
        description: pageConfig[0].description,
        published: pageConfig[0].published,
        customSlug: pageConfig[0].customSlug ?? null,
        createdAt: pageConfig[0].createdAt.toISOString(),
        updatedAt: pageConfig[0].updatedAt.toISOString(),
      } : null
    });
  } catch (error) {
    console.error("[status-page] GET Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = saveStatusPageSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: "Invalid input", issues: result.error.issues }, { status: 400 });
    }

    const { projectId, title, description, published, customSlug } = result.data;

    // Check if customSlug is already taken by a different project's status page
    if (customSlug) {
      const slugConflict = await db()
        .select({ id: statusPages.id, projectId: statusPages.projectId })
        .from(statusPages)
        .where(eq(statusPages.customSlug, customSlug))
        .limit(1);

      if (slugConflict.length > 0 && slugConflict[0].projectId !== projectId) {
        return NextResponse.json({ success: false, error: "Slug already in use by another project" }, { status: 409 });
      }
    }

    const project = await db()
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    // Upsert (insert or update on conflict)
    const existing = await db()
      .select({ id: statusPages.id })
      .from(statusPages)
      .where(eq(statusPages.projectId, projectId))
      .limit(1);

    if (existing.length > 0) {
      await db()
        .update(statusPages)
        .set({ title, description, published, customSlug: customSlug ?? null, updatedAt: new Date() })
        .where(eq(statusPages.id, existing[0].id));
    } else {
      await db()
        .insert(statusPages)
        .values({
          projectId,
          title,
          description,
          published,
          customSlug: customSlug ?? null,
        });
    }

    return NextResponse.json({ success: true, message: "Status page saved successfully" });
  } catch (error) {
    console.error("[status-page] POST Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
