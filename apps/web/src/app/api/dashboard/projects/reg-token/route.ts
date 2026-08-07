import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, agentRegistrationTokens, eq, and } from "@ezmon/db";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { projectId } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { success: false, error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify user owns the project
    const projectList = await db()
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, session.user.id)))
      .limit(1);

    if (projectList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found or forbidden" },
        { status: 404 }
      );
    }

    // Generate a temporary 1-time registration token (valid 5 minutes)
    const rawToken = `reg_${nanoid(24)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    await db().insert(agentRegistrationTokens).values({
      projectId,
      token: rawToken,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      data: {
        token: rawToken,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[reg-token] Error generating token:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
