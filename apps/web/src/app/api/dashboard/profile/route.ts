// Tujuan: API Endpoint untuk mengambil dan memperbarui data profil pengguna (nama & password)
// Caller: /dashboard/profile UI page
// Dependensi: @/lib/auth, @/lib/db, @ezmon/db (users table), bcryptjs, zod
// Main Functions: GET (fetch profile info), PATCH (update name & change password)
// Side Effects: DB UPDATE users record

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, passwordResetTokens, eq, and } from "@ezmon/db";
import { compare, hash } from "bcryptjs";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong").max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password minimal 6 karakter").optional(),
  verificationCode: z.string().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const database = db();
    const userList = await database
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (userList.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const user = userList[0];
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        hasPassword: !!user.passwordHash,
      },
    });
  } catch (error: any) {
    console.error("[Profile API GET Error]:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }

    const { name, currentPassword, newPassword, verificationCode } = parsed.data;
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
    const updateData: { name?: string; passwordHash?: string } = {};

    if (name && name !== user.name) {
      updateData.name = name.trim();
    }

    // Changing password handling with 6-digit OTP check
    if (newPassword) {
      if (!verificationCode || verificationCode.trim().length !== 6) {
        return NextResponse.json(
          { success: false, error: "Masukkan 6-digit kode verifikasi yang dikirim ke email Anda" },
          { status: 400 }
        );
      }

      if (user.passwordHash) {
        if (!currentPassword) {
          return NextResponse.json(
            { success: false, error: "Masukkan password lama Anda" },
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

      // Verify OTP code & 10 minute expiration
      const codeRecord = await database
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.email, user.email),
            eq(passwordResetTokens.token, verificationCode.trim())
          )
        )
        .limit(1);

      if (codeRecord.length === 0) {
        return NextResponse.json(
          { success: false, error: "Kode verifikasi tidak valid. Periksa kembali email Anda." },
          { status: 400 }
        );
      }

      const tokenData = codeRecord[0];
      if (new Date() > new Date(tokenData.expiresAt)) {
        return NextResponse.json(
          { success: false, error: "Kode verifikasi telah kadaluarsa (lebih dari 10 menit). Silakan minta kode baru." },
          { status: 400 }
        );
      }

      const hashed = await hash(newPassword, 10);
      updateData.passwordHash = hashed;

      // Delete token after successful use
      await database
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, tokenData.id));
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada perubahan data",
      });
    }

    await database
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      message: newPassword ? "Password dan profil berhasil diperbarui" : "Profil berhasil diperbarui",
    });
  } catch (error: any) {
    console.error("[Profile API PATCH Error]:", error);
    return NextResponse.json({ success: false, error: "Failed to update profile" }, { status: 500 });
  }
}
