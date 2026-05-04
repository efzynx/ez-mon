"use client";

import Link from "next/link";
import { Shield, Zap, ChevronRight, Terminal } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    },
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background relative overflow-hidden font-sans text-foreground selection:bg-primary/30">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-blue-600/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-emerald-500/5 blur-[120px]" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik02MCAwaC0xdjYwaDFWMEpNMCA1OXYxaDYwdi0xSDBaIiBmaWxsPSIjMWUyOTNiIiBmaWxsLW9wYWNpdHk9IjAuNSIvPjwvZz48L3N2Zz4=')] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
      </div>

      {/* Main Content */}
      <motion.div 
        className="relative z-10 w-full max-w-5xl flex flex-col items-center pt-20 pb-32"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Status Badge */}
        <motion.div 
          variants={itemVariants}
          className="inline-flex items-center gap-3 mb-12 px-4 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 backdrop-blur-md cursor-default hover:bg-emerald-500/20 transition-colors shadow-sm"
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
            <div className="relative w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <span className="text-sm font-bold tracking-widest uppercase text-emerald-500">
            Open Source
          </span>
        </motion.div>

        {/* Hero Typography */}
        <motion.h1 
          variants={itemVariants}
          className="text-6xl sm:text-7xl lg:text-8xl font-display font-extrabold tracking-tight mb-8 text-center text-foreground"
        >
          Monitor without
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500">
            the complexity.
          </span>
        </motion.h1>

        <motion.p 
          variants={itemVariants}
          className="text-xl sm:text-2xl text-muted-foreground mb-12 text-center max-w-3xl leading-relaxed"
        >
          Deploy your hub to Vercel in seconds. Monitor your Linux servers using lightweight, push-based Go agents. 
          No polling, no heavy setup.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-20"
        >
          <Link href="/register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full text-lg px-8 h-14 rounded-xl shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)] group">
              Start Monitoring
              <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full text-lg px-8 h-14 rounded-xl bg-background/50 backdrop-blur-md border-border/80">
              Sign In to Dashboard
            </Button>
          </Link>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full"
        >
          {[
            {
              icon: <Terminal className="text-blue-500" size={24} />,
              title: "Serverless Native",
              desc: "Built for Vercel and Neon. Zero persistent backend servers required for the central hub.",
              bg: "bg-blue-500/10 border border-blue-500/20"
            },
            {
              icon: <Zap className="text-emerald-500" size={24} />,
              title: "Push-based Agents",
              desc: "Agents send data to the hub via HTTP. No inbound firewall rules required on your servers.",
              bg: "bg-emerald-500/10 border border-emerald-500/20"
            },
            {
              icon: <Shield className="text-indigo-500" size={24} />,
              title: "Secure & Lightweight",
              desc: "Compiled Go binaries consume <10MB RAM. Data is transmitted securely via HTTPS.",
              bg: "bg-indigo-500/10 border border-indigo-500/20"
            }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              variants={itemVariants}
              whileHover={{ y: -5 }}
              className="p-8 rounded-2xl bg-card/40 border border-border/50 backdrop-blur-sm flex flex-col items-start gap-4 hover:border-primary/30 transition-colors shadow-sm"
            >
              <div className={`p-3 rounded-xl ${feature.bg}`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-display font-semibold text-foreground tracking-tight">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
