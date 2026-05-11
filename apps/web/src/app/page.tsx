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
import { Shield, Zap, ChevronRight, Terminal, Server, Globe, Activity } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";

export default function HomePage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 20 }
    },
  };

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
              Stable Version v0.1.3 Available
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
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-24"
          >
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full text-base px-8 h-14 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 shadow-[0_0_40px_-10px_rgba(34,197,94,0.4)] group border-0">
                Start Monitoring
                <ChevronRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="https://docs.ezmon.web.id" target="_blank" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full text-base px-8 h-14 rounded-2xl bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 hover:border-primary/50 text-slate-300 hover:text-white transition-all">
                View Documentation
              </Button>
            </Link>
          </motion.div>

          {/* Visual Showcase (Code/Terminal) */}
          <motion.div 
            variants={itemVariants}
            className="w-full max-w-4xl relative"
          >
            <div className="absolute inset-0 bg-primary/10 blur-[100px] -z-10 rounded-full" />
            <div className="rounded-2xl border border-white/10 bg-[#0f172a]/80 backdrop-blur-xl shadow-2xl overflow-hidden text-left">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/5">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
                <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/40" />
                <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary/40" />
                <div className="ml-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  EZMON Installer
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
                    <span className="text-primary">✓</span> Sending metrics every 30s
                  </p>
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
