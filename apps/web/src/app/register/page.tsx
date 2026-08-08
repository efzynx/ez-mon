"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, Mail, ArrowLeft, RefreshCw } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Resend code countdown
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send verification code to email
  const handleSendCode = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    setError("");
    setInfoMessage("");

    if (!email || !password) {
      setError("Email dan Password wajib diisi");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }

    setSendingCode(true);

    try {
      const res = await fetch("/api/auth/register/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Gagal mengirimkan kode verifikasi");
      } else {
        setInfoMessage(data.message || `Kode verifikasi 6-digit telah dikirim ke ${email}. Kode berlaku 10 menit.`);
        setStep(2);
        setResendCooldown(60);
      }
    } catch {
      setError("Terjadi kesalahan jaringan, silakan coba lagi");
    } finally {
      setSendingCode(false);
    }
  };

  // Step 2: Verify code & create user account
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!code || code.trim().length !== 6) {
      setError("Masukkan kode verifikasi 6-digit");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, email, password, code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Pendaftaran gagal");
        setLoading(false);
      } else {
        router.push("/login?registered=true");
      }
    } catch {
      setError("Terjadi kesalahan jaringan saat membuat akun");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 font-sans relative overflow-hidden text-foreground selection:bg-primary/30 py-12">
      {/* Minimalist Grid Background */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      {/* Subtle Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-[100%] bg-primary/10 blur-[100px] opacity-50 pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shadow-sm">
              <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
            </div>
          </Link>
          <h1 className="text-3xl font-display font-medium tracking-tight mb-2">
            {step === 1 ? "Create an account" : "Verifikasi Email"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {step === 1
              ? "Isi data Anda untuk memulai monitoring"
              : `Kode verifikasi 6-digit telah dikirim ke ${email}`}
          </p>
        </div>

        <Card className="border-border/40 shadow-2xl backdrop-blur-xl bg-card/60">
          <CardContent className="pt-8 px-8 pb-8">
            {step === 1 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-border/60 hover:bg-muted/50 transition-all font-medium flex items-center justify-center gap-2 rounded-lg"
                  onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  Sign up with GitHub
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or with email</span>
                  </div>
                </div>

                <form onSubmit={handleSendCode} className="space-y-5">
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center border border-destructive/20">
                      {error}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="name" className="text-[13px] font-medium text-foreground/80 flex justify-between">
                      Name <span className="text-muted-foreground/60 font-normal">Optional</span>
                    </label>
                    <Input
                      id="name"
                      type="text"
                      className="h-11 bg-muted/30 border-border/50 text-foreground transition-all duration-200 focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/50 shadow-sm rounded-lg"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-[13px] font-medium text-foreground/80">Email</label>
                    <Input
                      id="email"
                      type="email"
                      className="h-11 bg-muted/30 border-border/50 text-foreground transition-all duration-200 focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/50 shadow-sm rounded-lg"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-[13px] font-medium text-foreground/80 flex justify-between">
                      Password <span className="text-muted-foreground/60 font-normal">Min 8 chars</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className="h-11 bg-muted/30 border-border/50 text-foreground transition-all duration-200 focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/50 shadow-sm rounded-lg pr-10"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full mt-4 h-11 text-[15px] font-medium transition-all shadow-sm rounded-lg"
                    disabled={sendingCode}
                  >
                    {sendingCode ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Mengirim Kode Verifikasi...
                      </>
                    ) : (
                      "Lanjutkan & Kirim Kode Verifikasi"
                    )}
                  </Button>
                </form>
              </>
            ) : (
              /* Step 2: Verification Code Entry */
              <form onSubmit={handleRegister} className="space-y-5">
                {infoMessage && (
                  <div className="p-3.5 rounded-xl bg-primary/10 text-primary text-xs font-medium border border-primary/20 flex items-start gap-2.5">
                    <Mail size={18} className="shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{infoMessage}</span>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center border border-destructive/20">
                    {error}
                  </div>
                )}

                <div className="space-y-2 text-center py-2">
                  <label htmlFor="code" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Masukkan Kode OTP 6-Digit (Berlaku 10 Menit)
                  </label>
                  <Input
                    id="code"
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    className="h-14 text-center font-mono tracking-[0.5em] text-2xl font-bold bg-muted/40 border-border/80 text-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-[15px] font-medium transition-all shadow-sm rounded-lg"
                  disabled={loading || code.length !== 6}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Memverifikasi & Buat Akun...
                    </>
                  ) : (
                    "Verifikasi & Buat Akun"
                  )}
                </Button>

                <div className="pt-2 flex items-center justify-between border-t border-border/40 text-xs">
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(""); }}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
                  >
                    <ArrowLeft size={14} /> Ubah Data
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || sendingCode}
                    onClick={() => handleSendCode()}
                    className="text-primary hover:underline flex items-center gap-1 font-medium disabled:opacity-50 disabled:no-underline transition-all"
                  >
                    <RefreshCw size={12} className={sendingCode ? "animate-spin" : ""} />
                    {resendCooldown > 0 ? `Kirim Ulang (${resendCooldown}s)` : "Kirim Ulang Kode"}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors underline underline-offset-4 decoration-primary/30">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

