// Tujuan: API Endpoint untuk memvalidasi pendaftaran & mengirimkan 6-digit OTP code ke email (10 menit expiry)
// Caller: /register UI page (Step 1)
// Dependensi: @/lib/db, @ezmon/db (users, passwordResetTokens), sendRegistrationVerificationCodeEmail, @ezmon/shared (registerSchema)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens, eq } from "@ezmon/db";
import { sendRegistrationVerificationCodeEmail } from "@/lib/email";
import { registerSchema } from "@ezmon/shared";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Input tidak valid" },
        { status: 400 }
      );
    }

    const { email: rawEmail } = parsed.data;
    const email = rawEmail.trim().toLowerCase();
    const database = db();

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

    // Generate 6-digit OTP code & 10 minute expiration
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Clean up existing tokens for this email
    await database
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.email, email));

    // Insert new verification token
    await database.insert(passwordResetTokens).values({
      email,
      token: code,
      expiresAt,
    });

    // Send email with verification code
    await sendRegistrationVerificationCodeEmail({
      to: email,
      code,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Kode verifikasi 6-digit telah dikirim ke ${email}. Kode berlaku selama 10 menit.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Send Registration Code Error]:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengirimkan kode verifikasi email" },
      { status: 500 }
    );
  }
}
