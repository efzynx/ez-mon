"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden text-foreground selection:bg-primary/30">
      {/* Minimalist Grid Background */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      {/* Subtle Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-[100%] bg-primary/10 blur-[100px] opacity-50 pointer-events-none" />

      <div className="relative z-10 w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shadow-sm">
              <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
            </div>
          </Link>
          <h1 className="text-3xl font-display font-medium tracking-tight mb-2">
            Welcome back
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your credentials to access your dashboard
          </p>
        </div>

        <Card className="border-border/40 shadow-2xl backdrop-blur-xl bg-card/60">
          <CardContent className="pt-8 px-8 pb-8">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-border/60 hover:bg-muted/50 transition-all font-medium flex items-center justify-center gap-2 rounded-lg"
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Continue with GitHub
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[13px] font-medium text-foreground/80"
                >
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  className="h-11 bg-muted/30 border-border/50 text-foreground transition-all duration-200 focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/50 shadow-sm rounded-lg"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="password"
                    className="text-[13px] font-medium text-foreground/80"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { window.location.href = "/forgot-password"; }}
                    className="text-[13px] text-muted-foreground hover:text-primary transition-colors cursor-pointer font-medium hover:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="h-11 bg-muted/30 border-border/50 text-foreground transition-all duration-200 focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/50 shadow-sm rounded-lg pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-primary hover:text-primary/80 font-medium transition-colors underline underline-offset-4 decoration-primary/30"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
