import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users, passwordResetTokens, eq, gt, and } from "@ezmon/db";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token dibutuhkan"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Input tidak valid" },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    // Find valid token in database
    const tokenResult = await db()
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    const resetRecord = tokenResult[0];

    if (!resetRecord) {
      return NextResponse.json(
        { success: false, error: "Link reset password tidak valid atau sudah kadaluarsa" },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hash(password, 12);

    // Update user password
    await db()
      .update(users)
      .set({ passwordHash })
      .where(eq(users.email, resetRecord.email));

    // Delete used reset token
    await db()
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));

    return NextResponse.json({
      success: true,
      message: "Password Anda berhasil diperbarui. Silakan login kembali.",
    });
  } catch (error) {
    console.error("[auth/reset-password] Error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
