"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Tent,
  Beef,
  HeartPulse,
  ArrowLeftRight,
  BarChart3,
  Users,
  Bell,
  Dna,
  LogOut,
  Menu,
  X,
  Activity,
  Skull,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: "all" },
  { href: "/camps", label: "Camps", icon: Tent, roles: "all" },
  { href: "/animals", label: "Animals", icon: Beef, roles: "all" },
  { href: "/health", label: "Health", icon: HeartPulse, roles: ["OWNER", "FARM_MANAGER", "CAMP_SUPERVISOR", "VETERINARIAN", "RECORDS_CLERK"] },
  { href: "/events", label: "Events", icon: Activity, roles: "all" },
  { href: "/mortality", label: "Mortality", icon: Skull, roles: ["OWNER", "FARM_MANAGER", "CAMP_SUPERVISOR", "VETERINARIAN", "RECORDS_CLERK", "VIEWER"] },
  { href: "/movements", label: "Movements", icon: ArrowLeftRight, roles: ["OWNER", "FARM_MANAGER", "CAMP_SUPERVISOR"] },
  { href: "/breeding", label: "Breeding", icon: Dna, roles: ["OWNER", "FARM_MANAGER", "CAMP_SUPERVISOR", "RECORDS_CLERK"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "FARM_MANAGER", "CAMP_SUPERVISOR", "VETERINARIAN", "RECORDS_CLERK", "VIEWER"] },
  { href: "/alerts", label: "Alerts", icon: Bell, roles: "all" },
  { href: "/settings/users", label: "Users", icon: Users, roles: ["OWNER"] },
];

interface SidebarProps {
  user: { name: string; role: Role };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNav = navItems.filter((item) => {
    if (item.roles === "all") return true;
    return item.roles.includes(user.role);
  });

  const navContent = (
    <>
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary">
          <Beef className="h-6 w-6" />
          <span>Ya Buu Ranch</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 space-y-3">
        <div className="px-3">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
        </div>
        <SyncStatusBadge />
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
