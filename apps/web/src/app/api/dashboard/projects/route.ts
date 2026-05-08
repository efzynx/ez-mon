import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, eq, and } from "@ezmon/db";
import { createProjectSchema, updateProjectNameSchema } from "@ezmon/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await db()
      .select()
      .from(projects)
      .where(eq(projects.userId, session.user.id));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[dashboard/projects] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { name, slug, timezone } = parsed.data;

    // Check if slug is already taken by this user
    const existing = await db()
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "Project slug already in use" },
        { status: 409 }
      );
    }

    const result = await db()
      .insert(projects)
      .values({
        userId: session.user.id,
        name,
        slug,
        timezone,
      })
      .returning();

    return NextResponse.json(
      { success: true, data: result[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("[dashboard/projects] POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    if (!body.projectId) {
      return NextResponse.json({ success: false, error: "Project ID required" }, { status: 400 });
    }

    if (body.tags && Array.isArray(body.tags)) {
      await db()
        .update(projects)
        .set({ tags: body.tags })
        .where(and(eq(projects.id, body.projectId), eq(projects.userId, session.user.id)));
      return NextResponse.json({ success: true });
    }

    if (body.name) {
      const parsed = updateProjectNameSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
      }

      await db()
        .update(projects)
        .set({ name: parsed.data.name })
        .where(and(eq(projects.id, body.projectId), eq(projects.userId, session.user.id)));
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    console.error("[dashboard/projects] PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Project ID required" }, { status: 400 });
    }

    await db()
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[dashboard/projects] DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
