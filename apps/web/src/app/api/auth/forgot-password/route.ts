import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { users, passwordResetTokens, eq } from "@ezmon/db";
import { sendResetPasswordEmail } from "@/lib/email";

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Input tidak valid" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();

    // Check if user exists
    const userResult = await db()
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Return generic message regardless of email existence to prevent account enumeration
    if (userResult.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Jika email terdaftar, instruksi reset password telah dikirimkan.",
      });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in database
    await db().insert(passwordResetTokens).values({
      email,
      token,
      expiresAt,
    });

    // Base URL
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send Email via Resend
    await sendResetPasswordEmail({
      to: email,
      resetUrl,
    });

    return NextResponse.json({
      success: true,
      message: "Jika email terdaftar, instruksi reset password telah dikirimkan.",
    });
  } catch (error) {
    console.error("[auth/forgot-password] Error:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
