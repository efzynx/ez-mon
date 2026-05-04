"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  Bell,
  Globe,
  Settings,
  LogOut,
  Menu,
  Search,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import pkg from "../../../../../../package.json";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "Agents", icon: Server },
  { href: "/dashboard/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function SidebarNav({ isMobile = false, closeMenu = () => {} }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-card/40 backdrop-blur-3xl border-r border-border/50">
      <div className="px-6 mb-8 flex flex-col gap-1 hidden md:flex h-16 justify-center border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-foreground font-display font-black tracking-widest text-lg">EZMON</span>
        </Link>
        <span className="text-muted-foreground text-[10px] font-mono">v{pkg.version}</span>
      </div>

      {isMobile && (
        <div className="px-6 my-6 flex flex-col gap-1 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={closeMenu}>
            <span className="text-foreground font-display font-black tracking-widest text-xl">EZMON</span>
          </Link>
          <span className="text-muted-foreground text-xs font-mono">v{pkg.version}</span>
        </div>
      )}

      <nav className="flex-1 flex flex-col gap-1 mt-2 px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className={`
                flex items-center gap-3 px-3 py-2.5 transition-all duration-300 rounded-lg text-sm font-medium
                ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                }
              `}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 mt-auto border-t border-border/50 p-3 bg-muted/20">
        <Link
          href="/dashboard/notifications"
          onClick={closeMenu}
          className="flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded-lg text-sm font-medium"
        >
          <Bell size={18} />
          Alert Channels
        </Link>
        <Link
          href="/dashboard/status-page"
          onClick={closeMenu}
          className="flex items-center gap-3 px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded-lg text-sm font-medium"
        >
          <Globe size={18} />
          Status Page
        </Link>
      </div>
    </div>
  );
}

function TopAppBar() {
  const { data: session } = useSession();

  return (
    <header className="flex justify-between items-center px-4 md:px-6 h-16 fixed top-0 w-full md:w-[calc(100%-16rem)] md:left-64 border-b border-border/50 z-30 bg-background/60 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="shrink-0" />}>
              <Menu className="h-5 w-5 text-foreground" />
              <span className="sr-only">Toggle navigation menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-border/50 bg-background/95 backdrop-blur-xl">
              <SidebarNav isMobile={true} closeMenu={() => {}} />
            </SheetContent>
          </Sheet>
        </div>
        <span className="text-xl font-display font-bold tracking-tighter text-foreground md:hidden">EZMON</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 rounded-full bg-muted/40 border-border/50 focus-visible:ring-1 focus-visible:border-primary transition-all shadow-none"
            placeholder="Search..."
            type="search"
          />
        </div>
        <div className="flex items-center gap-2 md:border-l md:border-border/50 md:pl-4">
          <Badge variant="outline" className="hidden sm:inline-flex font-mono text-[10px] bg-muted/30">PROD</Badge>
          <Button variant="ghost" size="icon" className="relative rounded-full text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.8)]"></span>
            <span className="sr-only">Notifications</span>
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-8 w-8 rounded-full ml-2" />}>
              <Avatar className="h-8 w-8 border border-border/50">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                  {session?.user?.name?.[0]?.toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session?.user?.name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
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
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-background text-foreground font-sans flex w-full">
        <aside className="fixed hidden md:flex h-full w-64 z-40 left-0 top-0">
          <SidebarNav />
        </aside>
        <div className="flex flex-col flex-1 w-full md:pl-64">
          <TopAppBar />
          <main className="pt-16 flex-1 relative z-0 w-full overflow-x-hidden">
            <div className="p-4 md:p-8 w-full max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
