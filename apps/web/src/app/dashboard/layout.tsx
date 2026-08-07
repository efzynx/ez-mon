// Tujuan: Dashboard root layout — sidebar (collapse/expand), top app bar, global nav & profile setting
// Caller: Next.js App Router (wraps semua /dashboard/* pages)
// Dependensi: next-auth (session), /api/dashboard/projects, NotificationCenter, GlobalSearch
// Main Functions: SidebarNav, GlobalProjectSwitcher, TopAppBar, DashboardLayout
// Side Effects: Fetch projects on mount, listens ezmon_project_changed / ezmon_projects_updated events, stores ezmon_sidebar_collapsed

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  Globe,
  Settings,
  LogOut,
  Menu,
  Search,
  X,
  MonitorCheck,
  Activity,
  Layers,
  ShieldCheck,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
  User,
} from "lucide-react";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { NotificationCenter } from "@/components/header/NotificationCenter";
import { GlobalSearch } from "@/components/header/GlobalSearch";
import pkg from "../../../package.json";

const navSections = [
  {
    title: "MONITORING & FLEET",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/agents", label: "Agents Fleet", icon: Server },
      { href: "/dashboard/monitors", label: "Cloud Monitors", icon: MonitorCheck },
    ],
  },
  {
    title: "ALERTS & PUBLIC PAGE",
    items: [
      { href: "/dashboard/incidents", label: "Incidents Log", icon: AlertTriangle },
      { href: "/dashboard/status-page", label: "Public Status Page", icon: Globe },
    ],
  },
];

function SidebarProjectSwitcher({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = () => {
      fetch("/api/dashboard/projects", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setProjects(data.data);
            if (data.data.length > 0) {
              const savedId = localStorage.getItem("ezmon_active_project");
              const isValid = data.data.some((p: any) => p.id === savedId);
              setSelectedProject(isValid && savedId ? savedId : data.data[0].id);
            }
          }
        });
    };

    loadProjects();

    const handleProjectChange = (e: any) => {
      if (e.detail?.id) setSelectedProject(e.detail.id);
    };

    window.addEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    window.addEventListener("ezmon_projects_updated", loadProjects);

    return () => {
      window.removeEventListener("ezmon_project_changed", handleProjectChange as EventListener);
      window.removeEventListener("ezmon_projects_updated", loadProjects);
    };
  }, []);

  if (isCollapsed) {
    return (
      <div className="mx-2 my-3 p-2 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-center" title="Active Project">
        <Layers size={18} className="text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-4 my-3 p-3 rounded-xl bg-muted/40 border border-border/60 backdrop-blur-sm flex flex-col gap-2 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-1.5">
          <Layers size={12} className="text-primary" />
          Active Workspace
        </span>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono bg-primary/5 text-primary border-primary/20">
          PROJECT
        </Badge>
      </div>

      {projects.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">No projects found</span>
      ) : (
        <select
          value={selectedProject ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedProject(id);
            localStorage.setItem("ezmon_active_project", id);
            window.dispatchEvent(new CustomEvent("ezmon_project_changed", { detail: { id } }));
          }}
          className="w-full bg-background border border-border/80 rounded-lg py-2 px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 truncate transition-all cursor-pointer"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function SidebarNav({
  isMobile = false,
  closeMenu = () => {},
  isCollapsed = false,
  toggleCollapse = () => {},
}: {
  isMobile?: boolean;
  closeMenu?: () => void;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-card/40 backdrop-blur-3xl border-r border-border/50 select-none transition-all duration-300">
      {/* Brand Header */}
      <div className={`py-5 flex items-center border-b border-border/50 ${isCollapsed && !isMobile ? "px-3 justify-center" : "px-6 justify-between"}`}>
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={closeMenu}>
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-all shrink-0">
            <Image src="/logo-nobg.svg" alt="EZMON Logo" width={28} height={28} className="object-contain" />
          </div>
          {(!isCollapsed || isMobile) && (
            <div className="flex flex-col">
              <span className="text-foreground font-display font-black tracking-widest text-xl leading-tight">EZMON</span>
              <span className="text-muted-foreground text-[10px] font-mono leading-none">v{pkg.version} • Serverless</span>
            </div>
          )}
        </Link>

        {(!isCollapsed || isMobile) && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2 py-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              LIVE
            </Badge>
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:flex"
                title="Minimize Sidebar"
              >
                <PanelLeftClose size={18} />
              </Button>
            )}
          </div>
        )}

        {isCollapsed && !isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:flex mt-2"
            title="Maximize Sidebar"
          >
            <PanelLeftOpen size={18} />
          </Button>
        )}
      </div>

      {/* Project Switcher Card in Sidebar */}
      <SidebarProjectSwitcher isCollapsed={isCollapsed && !isMobile} />

      {/* Navigation Sections */}
      <nav className={`flex-1 overflow-y-auto py-2 space-y-6 ${isCollapsed && !isMobile ? "px-2" : "px-4"}`}>
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            {(!isCollapsed || isMobile) && (
              <div className="px-3 text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase">
                {section.title}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    title={isCollapsed && !isMobile ? item.label : undefined}
                    className={`
                      flex items-center transition-all duration-200 rounded-xl text-sm font-medium
                      ${isCollapsed && !isMobile ? "justify-center p-3" : "justify-between px-3.5 py-2.5"}
                      ${
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20 font-semibold shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={isActive ? "text-primary" : "text-muted-foreground"} />
                      {(!isCollapsed || isMobile) && <span>{item.label}</span>}
                    </div>
                    {isActive && (!isCollapsed || isMobile) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System Status Mini Widget */}
      {(!isCollapsed || isMobile) ? (
        <div className="mx-4 my-2 p-3.5 rounded-xl bg-gradient-to-br from-card/80 via-muted/20 to-background border border-border/50 shadow-inner flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-foreground">Push Evaluation Active</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cloudflare Workers Evaluator monitoring host deadlines every minute.
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground font-mono">
            <span className="flex items-center gap-1 text-emerald-500">
              <CheckCircle2 size={11} /> 100% Operational
            </span>
            <span>Neon DB</span>
          </div>
        </div>
      ) : (
        <div className="mx-2 my-2 p-2 rounded-xl bg-card border border-border/50 flex justify-center text-emerald-500" title="Push Evaluation Active • 100% Operational">
          <CheckCircle2 size={18} />
        </div>
      )}

      {/* Footer Settings & Profile Area */}
      <div className={`flex flex-col gap-1 border-t border-border/50 p-3 bg-muted/20 ${isCollapsed && !isMobile ? "items-center" : ""}`}>
        <Link
          href="/dashboard/profile"
          onClick={closeMenu}
          title={isCollapsed && !isMobile ? "Profile Settings" : undefined}
          className={`
            flex items-center gap-3 transition-all rounded-xl text-sm font-medium
            ${isCollapsed && !isMobile ? "justify-center p-3 w-full" : "px-3.5 py-2.5"}
            ${
              pathname.startsWith("/dashboard/profile")
                ? "bg-primary/10 text-primary border border-primary/20 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
            }
          `}
        >
          <User size={18} className={pathname.startsWith("/dashboard/profile") ? "text-primary" : "text-muted-foreground"} />
          {(!isCollapsed || isMobile) && <span>Profile Settings</span>}
        </Link>

        <Link
          href="/dashboard/settings"
          onClick={closeMenu}
          title={isCollapsed && !isMobile ? "Settings & Preferences" : undefined}
          className={`
            flex items-center gap-3 transition-all rounded-xl text-sm font-medium
            ${isCollapsed && !isMobile ? "justify-center p-3 w-full" : "px-3.5 py-2.5"}
            ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-primary/10 text-primary border border-primary/20 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
            }
          `}
        >
          <Settings size={18} className={pathname.startsWith("/dashboard/settings") ? "text-primary" : "text-muted-foreground"} />
          {(!isCollapsed || isMobile) && <span>Settings</span>}
        </Link>
      </div>
    </div>
  );
}

function GlobalProjectSwitcher() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = () => {
      fetch("/api/dashboard/projects", { cache: "no-store" }).then(res => res.json()).then(data => {
        if (data.success) {
          setProjects(data.data);
          if (data.data.length > 0) {
            const savedId = localStorage.getItem("ezmon_active_project");
            const isValid = data.data.some((p: any) => p.id === savedId);
            setSelectedProject(isValid && savedId ? savedId : data.data[0].id);
          }
        }
      });
    };

    loadProjects();

    const handleProjectChange = (e: any) => {
      if (e.detail?.id) setSelectedProject(e.detail.id);
    };
    
    window.addEventListener("ezmon_project_changed", handleProjectChange as EventListener);
    window.addEventListener("ezmon_projects_updated", loadProjects);
    
    return () => {
      window.removeEventListener("ezmon_project_changed", handleProjectChange as EventListener);
      window.removeEventListener("ezmon_projects_updated", loadProjects);
    };
  }, []);

  if (projects.length === 0) return <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[10px] bg-muted/30">NO PROJECT</Badge>;

  return (
    <select
      value={selectedProject ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        setSelectedProject(id);
        localStorage.setItem("ezmon_active_project", id);
        window.dispatchEvent(new CustomEvent("ezmon_project_changed", { detail: { id } }));
      }}
      className="bg-muted/50 border border-border/50 rounded-md py-1.5 px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[180px] truncate transition-colors hover:bg-muted cursor-pointer"
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

function TopAppBar({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.name) {
      setUserName(session.user.name);
    }
    const handleUserUpdate = (e: any) => {
      if (e.detail?.name) {
        setUserName(e.detail.name);
      }
    };
    window.addEventListener("ezmon_user_updated", handleUserUpdate as EventListener);
    return () => window.removeEventListener("ezmon_user_updated", handleUserUpdate as EventListener);
  }, [session?.user?.name]);

  const displayName = userName || session?.user?.name || "User";
  const avatarInitial = displayName?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U";

  return (
    <>
    <header className={`flex justify-between items-center px-4 md:px-8 h-16 fixed top-0 w-full z-30 bg-background/60 backdrop-blur-xl border-b border-border/50 transition-all duration-300 ${
      isCollapsed ? "md:w-[calc(100%-5rem)] md:left-20" : "md:w-[calc(100%-20rem)] md:left-80"
    }`}>
      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="shrink-0" />}>
              <Menu className="h-5 w-5 text-foreground" />
              <span className="sr-only">Toggle navigation menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-80 border-r-border/50 bg-background/95 backdrop-blur-xl">
              <SidebarNav isMobile={true} closeMenu={() => {}} />
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <Image src="/logo-nobg.svg" alt="EZMON Logo" width={24} height={24} className="object-contain" />
          <span className="text-xl font-display font-bold tracking-tighter text-foreground">EZMON</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0 text-muted-foreground"
          onClick={() => setMobileSearchOpen(true)}
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>


      <div className="flex items-center gap-4">
        <GlobalSearch className="hidden sm:block w-72" />
        <div className="flex items-center gap-3 md:border-l md:border-border/50 md:pl-4">
          <GlobalProjectSwitcher />
          <NotificationCenter />
          
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-9 w-9 rounded-full ml-1" />}>
              <Avatar className="h-9 w-9 border border-border/50">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {avatarInitial}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/dashboard/profile")} className="cursor-pointer">
                <User className="mr-2 h-4 w-4 text-primary" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Project Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>

    {/* Mobile Search Overlay */}
    {mobileSearchOpen && (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col p-4 md:hidden animate-in fade-in duration-150">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <GlobalSearch className="w-full" autoFocus />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setMobileSearchOpen(false)}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
        <p className="text-xs text-muted-foreground/50 text-center mt-4">
          Search agents, pages, and more...
        </p>
      </div>
    )}
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ezmon_sidebar_collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("ezmon_sidebar_collapsed", String(next));
      return next;
    });
  };

  return (
    <SessionProvider>
      <Toaster richColors position="bottom-right" />
      <div className="min-h-screen bg-background text-foreground font-sans flex w-full">
        <aside className={`fixed hidden md:flex h-full z-40 left-0 top-0 transition-all duration-300 ${
          isCollapsed ? "w-20" : "w-80"
        }`}>
          <SidebarNav isCollapsed={isCollapsed} toggleCollapse={toggleCollapse} />
        </aside>
        <div className={`flex flex-col flex-1 w-full transition-all duration-300 ${
          isCollapsed ? "md:pl-20" : "md:pl-80"
        }`}>
          <TopAppBar isCollapsed={isCollapsed} />
          <main className="pt-16 flex-1 relative z-0 w-full overflow-x-hidden">
            <div className="p-4 md:p-8 lg:p-10 w-full max-w-[1920px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
