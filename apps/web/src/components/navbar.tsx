/**
 * Tujuan: Navigasi global untuk halaman publik EZMON dengan branding minimalis & stabil
 * Caller: apps/web/src/app/page.tsx (dan halaman publik lainnya)
 * Dependensi: next/link, lucide-react, @/components/ui/button
 * Main Functions: Navbar component
 * Side Effects: None (Stateless UI)
 * Style: Context7-compliant (Modular, Clean, Standardized)
 */

"use client";

import Link from "next/link";
import { Github, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center p-6 pointer-events-none"
    >
      <div className="w-full max-w-7xl flex items-center justify-between px-6 py-3 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl pointer-events-auto shadow-2xl">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* Branding minimalis: Dot Pulse Hijau + Teks Bold */}
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.8)] transition-all group-hover:scale-125" />
            <span className="text-xl font-display font-bold tracking-tight text-white group-hover:text-primary transition-colors">
              EZMON
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="https://docs.ezmon.web.id" 
              target="_blank"
              className="text-sm font-medium text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5"
            >
              Documentation
              <ExternalLink size={14} className="opacity-50" />
            </Link>
            <Link 
              href="https://github.com/efzynx/ez-mon" 
              target="_blank"
              className="text-sm font-medium text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5"
            >
              GitHub
              <Github size={14} className="opacity-50" />
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/5 rounded-lg">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90 font-semibold rounded-lg shadow-lg shadow-primary/20 transition-all">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
