/**
 * Tujuan: Landing page publik EZMON dengan aksen warna selaras & branding minimalis
 * Caller: Next.js (root route /)
 * Dependensi: framer-motion, lucide-react, @/components/ui/button, @/components/navbar
 * Main Functions: HomePage component
 * Side Effects: None (Stateless UI)
 * Style: Context7-compliant (Modular, Clean, Standardized)
 */

"use client";

import Link from "next/link";
import { useState } from "react";
import { Shield, Zap, ChevronRight, Terminal, Server, Globe, Activity, ExternalLink, Copy, Check, Clock, Layers, ArrowUpRight } from "lucide-react";
import { motion, Variants } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";

export default function HomePage() {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedEvalUrl, setCopiedEvalUrl] = useState(false);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 20 }
    },
  };

  const cloneCmd = `git clone https://github.com/efzynx/ez-mon.git
cd ez-mon
npm install
npm --prefix apps/web run dev`;

  const copyToClipboard = (text: string, setFn: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  const vercelDeployUrl = "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fefzynx%2Fez-mon&env=DATABASE_URL,CRON_SECRET,NEXTAUTH_SECRET,NEXTAUTH_URL&envDescription=Neon%20Postgres%20DATABASE_URL%2C%20CRON_SECRET%20for%20evaluator%2C%20and%20NextAuth%20secrets&project-name=ezmon-hub&repository-name=ezmon";

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#020617] relative overflow-hidden font-sans text-slate-200 selection:bg-primary/30">
      <Navbar />

      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[100vw] h-[100vw] rounded-full bg-primary/5 blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vw] rounded-full bg-primary/5 blur-[150px]" />

        {/* Animated Grid */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik02MCAwaC0xdjYwaDFWMEpNMCA1OXYxaDYwdi0xSDBaIiBmaWxsPSIjMWUyOTNiIiBmaWxsLW9wYWNpdHk9IjAuNSIvPjwvZz48L3N2Zz4=')] opacity-[0.1]" />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/80 to-[#020617]" />
      </div>

      <main className="relative z-10 w-full max-w-6xl px-6 pt-44 pb-32">
        {/* Hero Section */}
        <motion.div
          className="flex flex-col items-center text-center"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Version Badge */}
          <motion.div
            variants={itemVariants}
            className="group flex items-center gap-2 mb-10 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/10 backdrop-blur-md hover:bg-primary/20 transition-all cursor-default"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-primary group-hover:text-primary transition-colors">
              Stable Version v0.1.18 Available
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-7xl lg:text-8xl font-display font-extrabold tracking-tight mb-8 leading-[1.1]"
          >
            Next-Gen Infrastructure
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-primary to-green-500">
              Monitoring.
            </span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl leading-relaxed"
          >
            The open-source, serverless monitoring platform for modern engineering teams.
            Monitor anything, anywhere, without the operational overhead.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-20"
          >
            <Link href={vercelDeployUrl} target="_blank" className="w-full sm:w-auto">
              <Button size="lg" className="w-full text-base px-8 h-14 rounded-2xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-[0_0_40px_-10px_rgba(34,197,94,0.5)] group border-0">
                Deploy Hub to Vercel
                <ArrowUpRight size={20} className="ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
            </Link>
            <Link href="#deploy-hub" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full text-base px-8 h-14 rounded-2xl bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 hover:border-primary/50 text-slate-300 hover:text-white transition-all">
                Self-Host Guide
              </Button>
            </Link>
          </motion.div>

          {/* Visual Showcase (Code/Terminal) */}
          <motion.div
            variants={itemVariants}
            className="w-full max-w-4xl relative mb-24"
          >
            <div className="absolute inset-0 bg-primary/10 blur-[100px] -z-10 rounded-full" />
            <div className="rounded-2xl border border-white/10 bg-[#0f172a]/80 backdrop-blur-xl shadow-2xl overflow-hidden text-left">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40" />
                  <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/40" />
                  <div className="ml-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    EZMON One-Line Agent Installer
                  </div>
                </div>
              </div>
              <div className="p-6 md:p-8 font-mono text-sm md:text-base leading-relaxed">
                <div className="flex gap-4">
                  <span className="text-slate-600 shrink-0 select-none">1</span>
                  <p className="text-slate-300">
                    <span className="text-primary">curl</span> -sSL https://ezmon.web.id/install.sh | <span className="text-primary/80">sudo bash</span>
                  </p>
                </div>
                <div className="flex gap-4 mt-2">
                  <span className="text-slate-600 shrink-0 select-none">2</span>
                  <p className="text-slate-500 italic"># EZMON Agent starts collecting metrics instantly</p>
                </div>
                <div className="flex gap-4 mt-4">
                  <span className="text-slate-600 shrink-0 select-none">3</span>
                  <p className="text-slate-400">
                    <span className="text-primary">✓</span> Initialized system collector...
                  </p>
                </div>
                <div className="flex gap-4 mt-1">
                  <span className="text-slate-600 shrink-0 select-none">4</span>
                  <p className="text-slate-400">
                    <span className="text-primary">✓</span> Connected to hub at app.ezmon.web.id
                  </p>
                </div>
                <div className="flex gap-4 mt-1">
                  <span className="text-slate-600 shrink-0 select-none">5</span>
                  <p className="text-slate-400">
                    <span className="text-primary">✓</span> Sending metrics & heartbeats every 30s
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ─── Hub Deployment & Self-Host Section ─────────────────────────────── */}
        <motion.div
          id="deploy-hub"
          className="mt-16 pt-16 border-t border-white/5 scroll-mt-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold font-mono uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
              Deployment Paths
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-extrabold text-white mt-4 mb-4">
              Deploy Your EZMON Hub
            </h2>
            <p className="text-slate-400 text-base md:text-lg leading-relaxed">
              Host your monitoring backend in seconds on Vercel with zero infrastructure maintenance, or self-host anywhere using Git.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Option 1: One-Click Vercel Deploy */}
            <motion.div
              variants={itemVariants}
              className="p-8 rounded-3xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 backdrop-blur-md flex flex-col justify-between hover:border-emerald-500/40 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-black border border-white/10 text-white">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M24 22.5D24 22.5 12 1.5 12 1.5D12 1.5 0 22.5 0 22.5H24Z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Vercel One-Click Deploy</h3>
                      <p className="text-xs text-slate-400">Recommended for instant serverless hub</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    FASTEST
                  </span>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  Click below to automatically clone EZMON, provision environment variables, and deploy your Hub app to Vercel in 1 click.
                </p>

                <div className="space-y-2 mb-8 bg-black/40 border border-white/5 rounded-2xl p-4 text-xs font-mono text-slate-400">
                  <div className="text-slate-300 font-semibold mb-1">Required Environment Variables:</div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>DATABASE_URL</span>
                    <span className="text-slate-500">Neon Postgres URL</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>CRON_SECRET</span>
                    <span className="text-slate-500">Evaluator Bearer Token</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>NEXTAUTH_SECRET</span>
                    <span className="text-slate-500">Random 32-char String</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>NEXTAUTH_URL</span>
                    <span className="text-slate-500">https://your-hub.vercel.app</span>
                  </div>
                </div>
              </div>

              <Link href={vercelDeployUrl} target="_blank" className="w-full">
                <Button className="w-full h-13 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-white/5 transition-all">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 22.5D24 22.5 12 1.5 12 1.5D12 1.5 0 22.5 0 22.5H24Z" />
                  </svg>
                  Deploy to Vercel Now
                  <ExternalLink size={16} className="ml-1 opacity-70" />
                </Button>
              </Link>
            </motion.div>

            {/* Option 2: Self-Host via Git Clone */}
            <motion.div
              variants={itemVariants}
              className="p-8 rounded-3xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 backdrop-blur-md flex flex-col justify-between hover:border-primary/40 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                      <Terminal size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Self-Host via Git Clone</h3>
                      <p className="text-xs text-slate-400">Full control on your own VPS or bare-metal</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                    MANUAL
                  </span>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  Clone the monorepo repository and run locally or inside your Docker / Node.js production server.
                </p>

                <div className="relative bg-[#090d16] border border-white/10 rounded-2xl p-4 mb-8">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(cloneCmd, setCopiedCmd)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-white p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    title="Copy commands"
                  >
                    {copiedCmd ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                  <pre className="font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto">
                    {cloneCmd}
                  </pre>
                </div>
              </div>

              <Link href="https://github.com/efzynx/ez-mon" target="_blank" className="w-full">
                <Button variant="outline" className="w-full h-13 rounded-xl bg-white/5 border-white/10 hover:bg-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2">
                  <Github size={18} />
                  View GitHub Repository
                  <ChevronRight size={16} className="opacity-70" />
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* ─── Cron-job.org / Evaluator Setup Card ──────────────────────────── */}
          <motion.div
            variants={itemVariants}
            className="mt-8 p-8 rounded-3xl bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-slate-950 border border-emerald-500/20 backdrop-blur-md"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 pb-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Periodic Evaluator Setup (cron-job.org)</h3>
                  <p className="text-xs text-slate-400">Automate host offline detection & notification dispatch every minute</p>
                </div>
              </div>
              <Link href="https://cron-job.org" target="_blank">
                <Button variant="outline" size="sm" className="rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-mono text-xs">
                  Open cron-job.org <ExternalLink size={14} className="ml-1.5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-500 font-mono uppercase text-[10px] mb-1">1. Target URL</div>
                <div className="font-mono text-slate-200 font-semibold truncate">
                  https://&lt;your-hub&gt;/api/internal/evaluate
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-500 font-mono uppercase text-[10px] mb-1">2. HTTP Method</div>
                <div className="font-mono text-emerald-400 font-bold">
                  POST
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-500 font-mono uppercase text-[10px] mb-1">3. Authorization Header</div>
                <div className="font-mono text-slate-200 truncate">
                  Bearer &lt;CRON_SECRET&gt;
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <div className="text-slate-500 font-mono uppercase text-[10px] mb-1">4. Schedule Interval</div>
                <div className="font-mono text-amber-400 font-bold">
                  Every 1 minute (* * * * *)
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 w-full"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {[
            {
              icon: <Terminal className="text-primary" size={22} />,
              title: "Serverless Hub",
              desc: "Built for Vercel and Neon. Scale infinitely with zero persistent backend maintenance.",
              gradient: "from-primary/10 to-transparent"
            },
            {
              icon: <Zap className="text-primary" size={22} />,
              title: "Push-First Agents",
              desc: "Lightweight Go agents push metrics via HTTPS. Works perfectly behind any firewall.",
              gradient: "from-primary/10 to-transparent"
            },
            {
              icon: <Shield className="text-primary" size={22} />,
              title: "Proactive Alerts",
              desc: "Get notified via Telegram, Discord, or Webhooks the moment a server goes offline.",
              gradient: "from-primary/10 to-transparent"
            },
            {
              icon: <Globe className="text-primary" size={22} />,
              title: "Global Visibility",
              desc: "A unified dashboard for all your cloud and on-premise infrastructure worldwide.",
              gradient: "from-primary/10 to-transparent"
            },
            {
              icon: <Activity className="text-primary" size={22} />,
              title: "Real-time Metrics",
              desc: "CPU, RAM, Disk, Network, and Docker stats aggregated in 5-minute buckets.",
              gradient: "from-primary/10 to-transparent"
            },
            {
              icon: <Server className="text-primary" size={22} />,
              title: "Open Source",
              desc: "Complete transparency. Host it yourself or use our managed platform. You're in control.",
              gradient: "from-primary/10 to-transparent"
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              whileHover={{ y: -5, borderColor: "rgba(34,197,94,0.3)" }}
              className={`p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-sm flex flex-col items-start gap-4 transition-all duration-300 bg-gradient-to-br ${feature.gradient}`}
            >
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                {feature.icon}
              </div>
              <h3 className="text-xl font-display font-bold text-white tracking-tight">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer Text */}
        <motion.div
          variants={itemVariants}
          className="mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6"
        >
          <div className="text-slate-500 text-sm flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary opacity-50" />
            © 2026 EZMON Infrastructure. Built with precision by <Link href="https://github.com/efzynx" target="_blank" className="text-slate-400 hover:text-primary transition-colors">efzynx</Link>.
          </div>
          <div className="flex items-center gap-6 text-slate-500">
            <Link href="https://github.com/efzynx/ez-mon" target="_blank" className="hover:text-primary transition-colors">
              <Github size={20} />
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function Github({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}


