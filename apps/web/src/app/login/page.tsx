"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
                <label
                  htmlFor="password"
                  className="text-[13px] font-medium text-foreground/80 flex justify-between"
                >
                  Password
                  <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">Forgot?</Link>
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
