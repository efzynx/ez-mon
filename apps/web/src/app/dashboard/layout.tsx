// Tujuan: Dashboard root layout — sidebar redesain (berdasarkan sidebar2.jpg), top app bar, global nav & profile setting
// Caller: Next.js App Router (wraps semua /dashboard/* pages)
// Dependensi: next-auth (session), /api/dashboard/projects, NotificationCenter, GlobalSearch
// Main Functions: SidebarNav, SidebarProjectSwitcher, TopAppBar, DashboardLayout
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
  Menu as MenuIcon,
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
  Sparkles,
  Zap,
  Bell,
  ChevronsUpDown,
  HelpCircle,
  Inbox,
} from "lucide-react";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
import { GlobalSearch } from "@/components/header/GlobalSearch";

import pkg from "../../../package.json";


const mainNavItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    badge: "OVERVIEW",
    description: "Real-time overview of system performance, incidents, and host metrics.",
  },
  {
    href: "/dashboard/agents",
    label: "Agents Fleet",
    icon: Server,
    badge: "HOSTS",
    description: "Manage host monitoring agents and Linux servers.",
  },
  {
    href: "/dashboard/monitors",
    label: "Cloud Monitors",
    icon: MonitorCheck,
    badge: "HTTP / API",
    description: "Monitor HTTP availability, SSL certificates, & APIs.",
  },
  {
    href: "/dashboard/incidents",
    label: "Incidents Log",
    icon: AlertTriangle,
    badge: "ALERTS",
    description: "Track active and historical host downtime incidents.",
  },
  {
    href: "/dashboard/status-page",
    label: "Public Status Page",
    icon: Globe,
    badge: "PUBLIC",
    description: "Public status page accessible to teams and customers.",
  },
  {
    href: "/dashboard/notifications",
    label: "Notification Channels",
    icon: Bell,
    badge: "CHANNELS",
    description: "Configure alert channels for Telegram, Discord, Webhooks, & Email.",
  },
];

function CollapsedMenuItemHover({
  href,
  label,
  badge,
  description,
  icon: Icon,
  isActive,
  closeMenu,
  badgeCount,
}: {
  href: string;
  label: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  isActive: boolean;
  closeMenu: () => void;
  badgeCount?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  return (
    <>
      <Link
        href={href}
        onClick={() => {
          setHovered(false);
          closeMenu();
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          w-full p-3 rounded-xl transition-all duration-200 flex items-center justify-center relative focus:outline-none focus:ring-0
          ${isActive
            ? "bg-background dark:bg-muted/50 text-foreground font-semibold shadow-xs border border-border/60"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
          }
        `}
      >
        <Icon size={18} className={isActive ? "text-primary" : "text-muted-foreground"} />
        {typeof badgeCount === "number" && badgeCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
        )}
      </Link>

      {/* Render Custom Hover Card via React Portal directly into document.body */}
      {hovered && mounted && coords && createPortal(
        <div
          style={{
            position: "fixed",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: "translateY(-50%)",
          }}
          className="w-64 p-3 bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl z-50 animate-in fade-in slide-in-from-left-2 duration-150 pointer-events-none"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
                <Icon size={14} />
              </div>
              <span className="text-xs font-bold text-foreground truncate">{label}</span>
            </div>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono bg-primary/5 text-primary border-primary/20 shrink-0">
              {badge}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>,
        document.body
      )}
    </>
  );
}


function SidebarProjectSwitcher({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
      <div
        className="mx-2 my-2 flex justify-center"
        onMouseEnter={() => setDropdownOpen(true)}
        onMouseLeave={() => setDropdownOpen(false)}
      >
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="w-10 h-10 rounded-xl bg-muted/40 hover:bg-primary/20 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary transition-all cursor-pointer group focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                title="Switch Workspace"
              />
            }
          >
            <Layers size={18} className="text-primary group-hover:scale-110 transition-transform" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={10}
            className="w-56 p-1.5 bg-card/95 backdrop-blur-xl border-border/80 shadow-2xl rounded-xl z-50 animate-in fade-in slide-in-from-left-2 duration-150"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase px-2 py-1 flex items-center gap-1.5">
                <Layers size={12} className="text-primary" />
                Switch Workspace
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-1" />

            {projects.length === 0 ? (
              <div className="px-2.5 py-2 text-xs text-muted-foreground italic">No projects found</div>
            ) : (
              projects.map((p) => {
                const isSelected = p.id === selectedProject;
                return (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => {
                      setSelectedProject(p.id);
                      localStorage.setItem("ezmon_active_project", p.id);
                      window.dispatchEvent(new CustomEvent("ezmon_project_changed", { detail: { id: p.id } }));
                      setDropdownOpen(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {isSelected && <CheckCircle2 size={14} className="text-primary shrink-0 ml-2" />}
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }


  return (
    <div className="mx-3 my-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 backdrop-blur-sm flex flex-col gap-1.5 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase flex items-center gap-1.5">
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
          className="w-full bg-background border border-border/80 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 truncate transition-all cursor-pointer"
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
  closeMenu = () => { },
  isCollapsed = false,
  toggleCollapse = () => { },
}: {
  isMobile?: boolean;
  closeMenu?: () => void;
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [userName, setUserName] = useState<string | null>(null);
  const [openIncidentsCount, setOpenIncidentsCount] = useState<number>(0);

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

  useEffect(() => {
    const fetchOpenIncidents = () => {
      const pid = localStorage.getItem("ezmon_active_project");
      if (!pid) return;
      fetch(`/api/dashboard/incidents?projectId=${pid}&status=open&limit=50`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setOpenIncidentsCount(data.data.length);
          }
        })
        .catch(() => { });
    };

    fetchOpenIncidents();
    const handleProjectChange = () => fetchOpenIncidents();
    window.addEventListener("ezmon_project_changed", handleProjectChange);
    return () => window.removeEventListener("ezmon_project_changed", handleProjectChange);
  }, []);

  const displayName = userName || session?.user?.name || "User";
  const avatarInitial = displayName?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="flex flex-col h-full bg-card/90 dark:bg-card/40 backdrop-blur-2xl border-r border-border/50 select-none transition-all duration-300">
      {/* Header (Brand & Collapse toggle) */}
      <div className={`py-4 flex items-center ${isCollapsed && !isMobile ? "px-3 justify-center flex-col gap-3" : "px-4 justify-between"}`}>
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={closeMenu}>
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-all shrink-0">
            <Image src="/logo-nobg.svg" alt="EZMON Logo" width={24} height={24} className="object-contain" />
          </div>
          {(!isCollapsed || isMobile) && (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-foreground font-display font-black tracking-tight text-lg leading-tight">EZMON</span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  LIVE
                </Badge>
              </div>
              <span className="text-muted-foreground text-[10px] font-mono leading-none mt-0.5">v{pkg.version}</span>
            </div>
          )}
        </Link>

        {(!isCollapsed || isMobile) && !isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:flex rounded-lg"
            title="Collapse Sidebar"
          >
            <PanelLeftClose size={18} />
          </Button>
        )}

        {isCollapsed && !isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:flex rounded-lg"
            title="Expand Sidebar"
          >
            <PanelLeftOpen size={18} />
          </Button>
        )}
      </div>

      {/* Quick Search Button (Triggers CTRL+K Command Palette) */}
      <div className={`py-2 ${isCollapsed && !isMobile ? "px-2" : "px-3"}`}>
        <GlobalSearch className="w-full" collapsed={isCollapsed && !isMobile} />
      </div>


      {/* Quick Access Badges (Incidents Log Counter) */}
      <div className={`py-2 border-b border-border/40 ${isCollapsed && !isMobile ? "px-2" : "px-3"}`}>
        {(!isCollapsed || isMobile) ? (
          <Link
            href="/dashboard/incidents"
            onClick={closeMenu}
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <Inbox size={16} className="text-muted-foreground" />
              <span>Incidents Log</span>
            </div>
            {openIncidentsCount > 0 ? (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 rounded-full font-mono">
                {openIncidentsCount} OPEN
              </Badge>
            ) : (
              <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                0 Incidents
              </span>
            )}
          </Link>
        ) : (
          <CollapsedMenuItemHover
            href="/dashboard/incidents"
            label="Incidents Log"
            badge={openIncidentsCount > 0 ? `${openIncidentsCount} OPEN` : "ALERTS"}
            description="Track and respond to active host downtime incidents in real-time."
            icon={Inbox}
            isActive={pathname.startsWith("/dashboard/incidents")}
            closeMenu={closeMenu}
            badgeCount={openIncidentsCount}
          />
        )}
      </div>

      {/* Workspace Switcher */}
      <SidebarProjectSwitcher isCollapsed={isCollapsed && !isMobile} />

      {/* Main Navigation ("Menu") */}
      <div className={`flex-1 overflow-y-auto py-3 space-y-4 ${isCollapsed && !isMobile ? "px-2" : "px-3"}`}>
        <div className="space-y-1">
          {(!isCollapsed || isMobile) && (
            <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              Menu
            </div>
          )}

          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;

              if (isCollapsed && !isMobile) {
                return (
                  <CollapsedMenuItemHover
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    badge={item.badge}
                    description={item.description}
                    icon={Icon}
                    isActive={isActive}
                    closeMenu={closeMenu}
                  />
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={`
                    flex items-center justify-between px-3 py-2.5 transition-all duration-200 rounded-xl text-sm font-medium
                    ${isActive
                      ? "bg-background dark:bg-muted/50 text-foreground font-semibold shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? "text-primary" : "text-muted-foreground"} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Preferences / Secondary Nav */}
        <div className="space-y-1 pt-2 border-t border-border/40">
          {(!isCollapsed || isMobile) && (
            <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              Preferences
            </div>
          )}

          {isCollapsed && !isMobile ? (
            <>
              <CollapsedMenuItemHover
                href="/dashboard/settings"
                label="Project Settings"
                badge="SETTINGS"
                description="Manage API keys, webhooks, and project configurations."
                icon={Settings}
                isActive={pathname.startsWith("/dashboard/settings")}
                closeMenu={closeMenu}
              />
              <CollapsedMenuItemHover
                href="/dashboard/profile"
                label="Profile Settings"
                badge="ACCOUNT"
                description="Manage profile details, email address, and password security."
                icon={User}
                isActive={pathname.startsWith("/dashboard/profile")}
                closeMenu={closeMenu}
              />
            </>

          ) : (
            <>
              <Link
                href="/dashboard/settings"
                onClick={closeMenu}
                className={`
                  flex items-center transition-all duration-200 rounded-xl text-sm font-medium px-3 py-2.5 gap-3
                  ${pathname.startsWith("/dashboard/settings")
                    ? "bg-background dark:bg-muted/50 text-foreground font-semibold shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                  }
                `}
              >
                <Settings size={18} className={pathname.startsWith("/dashboard/settings") ? "text-primary" : "text-muted-foreground"} />
                <span>Settings</span>
              </Link>

              <Link
                href="/dashboard/profile"
                onClick={closeMenu}
                className={`
                  flex items-center transition-all duration-200 rounded-xl text-sm font-medium px-3 py-2.5 gap-3
                  ${pathname.startsWith("/dashboard/profile")
                    ? "bg-background dark:bg-muted/50 text-foreground font-semibold shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                  }
                `}
              >
                <User size={18} className={pathname.startsWith("/dashboard/profile") ? "text-primary" : "text-muted-foreground"} />
                <span>Profile Settings</span>
              </Link>
            </>
          )}
        </div>
      </div>


      {/* Footer User Profile Bar (as in sidebar2.jpg) */}
      <div className={`border-t border-border/50 p-2.5 bg-muted/20 mt-auto ${isCollapsed && !isMobile ? "flex justify-center" : ""}`}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className={`
                  w-full flex items-center gap-3 p-2 rounded-xl transition-all hover:bg-muted/50 focus:outline-none text-left cursor-pointer
                  ${isCollapsed && !isMobile ? "justify-center" : "justify-between"}
                `}
              />
            }
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 border border-border/60 shadow-xs shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {avatarInitial}
                </AvatarFallback>
              </Avatar>
              {(!isCollapsed || isMobile) && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                    {session?.user?.email ?? "Serverless Admin"}
                  </span>
                </div>
              )}
            </div>
            {(!isCollapsed || isMobile) && (
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground/70 shrink-0 ml-1" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align={isCollapsed && !isMobile ? "start" : "end"} side="top" sideOffset={8}>
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
            <DropdownMenuItem onClick={() => { closeMenu(); router.push("/dashboard/profile"); }} className="cursor-pointer">
              <User className="mr-2 h-4 w-4 text-primary" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { closeMenu(); router.push("/dashboard/settings"); }} className="cursor-pointer">
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
        {/* Desktop Sidebar */}
        <aside
          className={`fixed hidden md:flex h-full z-40 left-0 top-0 transition-all duration-300 ${
            isCollapsed ? "w-20" : "w-80"
          }`}
        >
          <SidebarNav isCollapsed={isCollapsed} toggleCollapse={toggleCollapse} />
        </aside>

        {/* Main Content Area */}
        <div
          className={`flex flex-col flex-1 w-full transition-all duration-300 ${
            isCollapsed ? "md:pl-20" : "md:pl-80"
          }`}
        >
          {/* Mobile Only Header Bar for Drawer Menu */}
          <div className="md:hidden flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground" />}>
                  <MenuIcon className="h-5 w-5" />
                  <span className="sr-only">Open Menu</span>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-80 border-r-border/50 bg-background/95 backdrop-blur-xl">
                  <SidebarNav isMobile={true} closeMenu={() => {}} />
                </SheetContent>
              </Sheet>
              <div className="flex items-center gap-2">
                <Image src="/logo-nobg.svg" alt="EZMON Logo" width={22} height={22} className="object-contain" />
                <span className="text-base font-display font-bold text-foreground">EZMON</span>
              </div>
            </div>
          </div>


          <main className="flex-1 relative z-0 w-full overflow-x-hidden">
            <div className="p-4 md:p-8 lg:p-10 w-full max-w-[1920px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}


