// Tujuan: Halaman UI Profile Settings — ubah nama, ganti password dengan OTP 10 menit & validasi password match
// Caller: Next.js Dashboard router (/dashboard/profile)
// Dependensi: /api/dashboard/profile (GET & PATCH), /api/dashboard/profile/send-code (POST), next-auth/react, sonner, lucide-react
// Main Functions: ProfilePage component
// Side Effects: Fetch profile, send OTP code, verify OTP code & update password, dispatch ezmon_user_updated event

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  User,
  KeyRound,
  Shield,
  CheckCircle2,
  Loader2,
  Mail,
  Calendar,
  Eye,
  EyeOff,
  Save,
  Send,
  Lock,
  Clock,
  AlertCircle,
  X,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();

  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    hasPassword: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingResetLink, setSendingResetLink] = useState(false);

  // Form states
  const [nameInput, setNameInput] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP Modal & Verification states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  // Toggle password visibility
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/dashboard/profile");
        const data = await res.json();
        if (data.success) {
          setProfile(data.data);
          setNameInput(data.data.name || "");
        } else {
          toast.error(data.error || "Gagal memuat data profil");
        }
      } catch (err) {
        toast.error("Terjadi kesalahan saat memuat data profil");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  // 10-minute countdown timer for OTP code
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showOtpModal && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, timeLeft]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) {
      toast.error("Nama tidak boleh kosong");
      return;
    }

    setSavingName(true);
    try {
      const res = await fetch("/api/dashboard/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Nama berhasil diperbarui");
        setProfile((prev) => (prev ? { ...prev, name: nameInput.trim() } : prev));

        // Update NextAuth session and dispatch instant topbar event
        await updateSession({ name: nameInput.trim() });
        window.dispatchEvent(
          new CustomEvent("ezmon_user_updated", { detail: { name: nameInput.trim() } })
        );
      } else {
        toast.error(data.error || "Gagal memperbarui nama");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setSavingName(false);
    }
  }

  // Step 1: Send 6-digit OTP code to email
  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();

    if (profile?.hasPassword && !currentPassword) {
      toast.error("Masukkan password lama Anda");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Password baru 1 dan password baru 2 harus sama persis");
      return;
    }

    setSendingCode(true);
    try {
      const res = await fetch("/api/dashboard/profile/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Kode verifikasi telah dikirim ke email Anda");
        setOtpCode("");
        setTimeLeft(600); // reset 10-minute timer
        setShowOtpModal(true);
      } else {
        toast.error(data.error || "Gagal mengirim kode verifikasi email");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setSendingCode(false);
    }
  }

  // Step 2: Confirm OTP code & Update Password
  async function handleConfirmOtp(e: React.FormEvent) {
    e.preventDefault();

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      toast.error("Masukkan 6-digit kode verifikasi yang valid");
      return;
    }

    if (timeLeft <= 0) {
      toast.error("Kode verifikasi telah kadaluarsa. Silakan minta kode baru.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/dashboard/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword,
          verificationCode: otpCode.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Password berhasil diperbarui!");
        setShowOtpModal(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setOtpCode("");
        setProfile((prev) => (prev ? { ...prev, hasPassword: true } : prev));
      } else {
        toast.error(data.error || "Gagal mengonfirmasi kode verifikasi");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground font-mono">Memuat profil pengguna...</span>
      </div>
    );
  }

  const initial = profile?.name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || "U";
  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isFormValid =
    newPassword.length >= 6 &&
    passwordsMatch &&
    (!profile?.hasPassword || currentPassword.length > 0);

  async function handleForgotPassword() {
    if (!profile?.email) return;
    setSendingResetLink(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Instruksi reset password telah dikirim ke ${profile.email}`);
      } else {
        toast.error(data.error || "Gagal mengirim link reset password");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat terhubung ke server");
    } finally {
      setSendingResetLink(false);
    }
  }

  return (
    <div className="space-y-8 pb-16 animate-fade-in w-full max-w-[1920px] mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-card to-background border border-primary/20 shadow-lg">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-primary/40 shadow-md">
            <AvatarFallback className="bg-primary/20 text-primary font-display font-black text-2xl">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-bold text-foreground">{profile?.name || "Pengguna EZMON"}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1">
                <Mail size={13} className="text-primary" />
                {profile?.email}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-muted-foreground" />
                Terdaftar {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" }) : "-"}
              </span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 px-3 py-1 text-xs font-mono flex items-center gap-1.5">
          <CheckCircle2 size={14} />
          {profile?.hasPassword ? "Akun Terverifikasi (Password)" : "Akun OAuth (GitHub)"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Information Form */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="border-border/60 shadow-lg h-full flex flex-col justify-between">
            <div>
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <User size={18} className="text-primary" />
                  Informasi Profil
                </CardTitle>
                <CardDescription>Perbarui nama lengkap dan tampilan akun Anda.</CardDescription>
              </CardHeader>
              <form id="name-form" onSubmit={handleUpdateName}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Nama lengkap Anda"
                      className="w-full bg-background border border-border/80 rounded-lg px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Alamat Email (Read-Only)
                    </label>
                    <input
                      type="email"
                      value={profile?.email || ""}
                      disabled
                      className="w-full bg-muted/30 border border-border/40 rounded-lg px-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground/70">
                      Alamat email terikat pada otentikasi utama dan tidak dapat diubah secara langsung.
                    </p>
                  </div>
                </CardContent>
              </form>
            </div>
            <CardFooter className="border-t border-border/50 pt-4 flex justify-end">
              <Button type="submit" form="name-form" disabled={savingName} className="gap-2">
                {savingName ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Simpan Nama
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Change Password Form */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="border-border/60 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <KeyRound size={18} className="text-amber-500" />
                Keamanan & Password
              </CardTitle>
              <CardDescription>
                {profile?.hasPassword
                  ? "Ubah password akun dengan verifikasi kode OTP 6-digit ke email."
                  : "Buat password baru untuk akun yang didaftarkan via OAuth."}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRequestCode}>
              <CardContent className="space-y-4">
                {profile?.hasPassword && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Password Lama
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={sendingResetLink}
                        className="text-xs text-primary hover:underline font-medium flex items-center gap-1 disabled:opacity-50 transition-colors"
                      >
                        {sendingResetLink && <Loader2 size={12} className="animate-spin" />}
                        Lupa Password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-background border border-border/80 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full bg-background border border-border/80 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      className={`w-full bg-background border rounded-lg px-3.5 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 transition-all ${
                        passwordsMismatch
                          ? "border-destructive focus:ring-destructive/40"
                          : passwordsMatch
                          ? "border-emerald-500 focus:ring-emerald-500/40"
                          : "border-border/80 focus:ring-primary/40"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Real-time Match Validation Status */}
                  {passwordsMismatch && (
                    <p className="text-xs text-destructive flex items-center gap-1.5 mt-1 font-medium">
                      <AlertCircle size={13} />
                      Password baru 1 dan password baru 2 tidak cocok.
                    </p>
                  )}
                  {passwordsMatch && (
                    <p className="text-xs text-emerald-500 flex items-center gap-1.5 mt-1 font-medium">
                      <Check size={13} />
                      Password baru cocok.
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="border-t border-border/50 pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={sendingCode || !isFormValid}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                >
                  {sendingCode ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Kirim Kode Verifikasi Email
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>

      {/* OTP Code Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 relative">
            <button
              onClick={() => setShowOtpModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                <Mail size={24} />
              </div>
              <h3 className="text-xl font-display font-bold text-foreground">Masukkan Kode Verifikasi</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kode verifikasi 6-digit telah dikirimkan ke email <strong className="text-foreground font-mono">{profile?.email}</strong>.
              </p>
            </div>

            <form onSubmit={handleConfirmOtp} className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider">Kode OTP 6-Digit</span>
                  <span className={`font-mono font-bold flex items-center gap-1 ${timeLeft < 120 ? 'text-destructive animate-pulse' : 'text-amber-500'}`}>
                    <Clock size={12} />
                    {formatTimer(timeLeft)}
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="123456"
                  className="w-full text-center tracking-[12px] font-mono text-2xl font-bold bg-background border border-border/80 rounded-xl py-3 px-4 text-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  autoFocus
                />
                {timeLeft <= 0 && (
                  <p className="text-xs text-destructive text-center font-medium mt-1">
                    Kode verifikasi telah kadaluarsa (10 menit). Silakan minta kode baru di bawah.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={sendingCode}
                  onClick={handleRequestCode}
                  className="flex-1 text-xs"
                >
                  {sendingCode ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                  Kirim Ulang Kode
                </Button>
                <Button
                  type="submit"
                  disabled={savingPassword || otpCode.trim().length !== 6 || timeLeft <= 0}
                  className="flex-1 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                  Verifikasi & Simpan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
