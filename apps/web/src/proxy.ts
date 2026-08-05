// Tujuan: Route guard global untuk autentikasi Next.js — public bypass & auth redirect
// Caller: Next.js runtime (otomatis dijalankan sebelum setiap request yang cocok matcher)
// Dependensi: @/lib/auth (NextAuth v5 auth helper)
// Main Functions: default export (proxy handler)
// Side Effects: HTTP redirect ke /login atau /dashboard berdasarkan session JWT

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isAuthPage =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register");
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
  const isAgentApi = nextUrl.pathname.startsWith("/api/agent");
  const isInternalApi = nextUrl.pathname.startsWith("/api/internal");
  const isPublicApi = nextUrl.pathname.startsWith("/api/public");
  const isStatusPage = nextUrl.pathname.startsWith("/status");
  const isPublicPage = nextUrl.pathname === "/";
  const isInstaller = nextUrl.pathname === "/install.sh";

  const isForgotPassword = nextUrl.pathname.startsWith("/forgot-password");
  const isResetPassword = nextUrl.pathname.startsWith("/reset-password");

  // Rute publik — bypass auth
  if (isApiAuth || isAgentApi || isInternalApi || isPublicApi || isStatusPage || isPublicPage || isInstaller || isForgotPassword || isResetPassword) {
    return NextResponse.next();
  }

  // Pengguna sudah login mencoba akses halaman auth → redirect ke dashboard
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Pengguna belum login mencoba akses halaman protected → redirect ke login
  if (!isAuthPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|install\\.sh|api/agent|api/internal|api/public).*)",
  ],
};

