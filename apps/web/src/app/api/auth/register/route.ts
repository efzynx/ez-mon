import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users, eq } from "@ezmon/db";
import { registerSchema } from "@ezmon/shared";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email: rawEmail, password, name } = parsed.data;
    const email = rawEmail.trim().toLowerCase();

    // Check if user already exists
    const existing = await db()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const result = await db()
      .insert(users)
      .values({
        email,
        passwordHash,
        name: name ?? null,
      })
      .returning({ id: users.id, email: users.email });

    return NextResponse.json(
      {
        success: true,
        data: { id: result[0].id, email: result[0].email },
        message: "Account created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[auth/register] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
