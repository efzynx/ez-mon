// Tujuan: API Endpoint untuk memvalidasi password & meng-generate 6-digit OTP code ke email (10 menit expiry)
// Caller: /dashboard/profile UI page
// Dependensi: @/lib/auth, @/lib/db, @ezmon/db (users, passwordResetTokens), bcryptjs, sendPasswordVerificationCodeEmail
// Main Functions: POST (generate OTP, insert DB, send email)

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, passwordResetTokens, eq } from "@ezmon/db";
import { compare } from "bcryptjs";
import { sendPasswordVerificationCodeEmail } from "@/lib/email";
import { z } from "zod";

const sendCodeSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password minimal 6 karakter"),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = sendCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const database = db();

    const userList = await database
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (userList.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const user = userList[0];

    // If user already has a password, verify current password first before sending code
    if (user.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: "Masukkan password lama Anda terlebih dahulu" },
          { status: 400 }
        );
      }

      const isMatch = await compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: "Password lama yang Anda masukkan salah" },
          { status: 400 }
        );
      }
    }

    // Generate 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Clean up existing tokens for this email
    await database
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.email, user.email));

    // Insert new verification token
    await database.insert(passwordResetTokens).values({
      email: user.email,
      token: code,
      expiresAt,
    });

    // Send email with code
    await sendPasswordVerificationCodeEmail({
      to: user.email,
      code,
    });

    return NextResponse.json({
      success: true,
      message: `Kode verifikasi telah dikirim ke ${user.email}. Kode berlaku selama 10 menit.`,
    });
  } catch (error: any) {
    console.error("[Send Verification Code Error]:", error);
    return NextResponse.json({ success: false, error: "Gagal mengirim kode verifikasi email" }, { status: 500 });
  }
}
