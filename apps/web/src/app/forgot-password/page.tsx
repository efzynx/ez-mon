"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Gagal mengirim link reset password");
      } else {
        setSuccess(true);
        setMessage(data.message);
      }
    } catch {
      setError("Terjadi kesalahan jaringan, silakan coba lagi");
    } finally {
      setLoading(false);
    }
  };

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
            Reset Password
          </h1>
          <p className="text-muted-foreground text-sm">
            Masukkan email terdaftar untuk menerima link instruksi reset password
          </p>
        </div>

        <Card className="border-border/40 shadow-2xl backdrop-blur-xl bg-card/60">
          <CardContent className="pt-8 px-8 pb-8">
            {success ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {message}
                </p>
                <Link href="/login" className="inline-block w-full mt-4">
                  <Button variant="outline" className="w-full h-11 text-sm font-medium">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center border border-destructive/20">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-[13px] font-medium text-foreground/80">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    className="h-11 bg-muted/30 border-border/50 text-foreground transition-all duration-200 focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/50 shadow-sm rounded-lg"
                    placeholder="nama@perusahaan.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                      Mengirim Link...
                    </>
                  ) : (
                    "Kirim Link Reset Password"
                  )}
                </Button>

                <div className="pt-2 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ArrowLeft className="mr-1 h-3 w-3" /> Kembali ke halaman login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
