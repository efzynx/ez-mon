import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users, passwordResetTokens, eq, and } from "@ezmon/db";
import { registerWithCodeSchema } from "@ezmon/shared";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerWithCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Input tidak valid" },
        { status: 400 }
      );
    }

    const { email: rawEmail, password, name, code } = parsed.data;
    const email = rawEmail.trim().toLowerCase();
    const database = db();

    // Verify 6-digit OTP code & 10 minute expiration
    const codeRecord = await database
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.email, email),
          eq(passwordResetTokens.token, code)
        )
      )
      .limit(1);

    if (codeRecord.length === 0) {
      return NextResponse.json(
        { success: false, error: "Kode verifikasi salah. Periksa kembali email Anda." },
        { status: 400 }
      );
    }

    const tokenData = codeRecord[0];
    if (new Date(tokenData.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: "Kode verifikasi telah kadaluwarsa (berlaku 10 menit). Silakan minta kode baru." },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "Email sudah terdaftar. Silakan login." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const result = await database
      .insert(users)
      .values({
        email,
        passwordHash,
        name: name ?? null,
      })
      .returning({ id: users.id, email: users.email });

    // Clean up used token
    await database
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.email, email));

    return NextResponse.json(
      {
        success: true,
        data: { id: result[0].id, email: result[0].email },
        message: "Akun berhasil dibuat!",
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

