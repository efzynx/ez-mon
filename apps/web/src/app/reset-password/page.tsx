"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto border border-destructive/20">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm text-destructive font-medium">
          Token reset password tidak ditemukan pada URL.
        </p>
        <Link href="/forgot-password" className="inline-block mt-2">
          <Button variant="outline" size="sm">
            Minta Link Reset Baru
          </Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Gagal memperbarui password");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch {
      setError("Terjadi kesalahan jaringan, silakan coba lagi");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-medium text-foreground">Password Berhasil Diperbarui!</h3>
        <p className="text-sm text-muted-foreground">
          Anda akan diarahakan otomatis ke halaman login dalam 3 detik...
        </p>
        <Link href="/login" className="inline-block w-full mt-4">
          <Button className="w-full h-11 text-sm font-medium">
            Login Sekarang
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center border border-destructive/20">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-medium text-foreground/80">
          Password Baru
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          className="h-11 bg-muted/30 border-border/50 text-foreground transition-all duration-200 focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/50 shadow-sm rounded-lg"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="text-[13px] font-medium text-foreground/80">
          Konfirmasi Password Baru
        </label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="h-11 bg-muted/30 border-border/50 text-foreground transition-all duration-200 focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/50 shadow-sm rounded-lg"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      <Button
        type="submit"
        className="w-full mt-4 h-11 text-[15px] font-medium transition-all shadow-sm rounded-lg"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Memperbarui Password...
          </>
        ) : (
          "Simpan Password Baru"
        )}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden text-foreground selection:bg-primary/30">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-[100%] bg-primary/10 blur-[100px] opacity-50 pointer-events-none" />

      <div className="relative z-10 w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shadow-sm">
              <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
            </div>
          </Link>
          <h1 className="text-3xl font-display font-medium tracking-tight mb-2">
            Buat Password Baru
          </h1>
          <p className="text-muted-foreground text-sm">
            Masukkan password baru untuk akun EZMON Anda
          </p>
        </div>

        <Card className="border-border/40 shadow-2xl backdrop-blur-xl bg-card/60">
          <CardContent className="pt-8 px-8 pb-8">
            <Suspense fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            }>
              <ResetPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
