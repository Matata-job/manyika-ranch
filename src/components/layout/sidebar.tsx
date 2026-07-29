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
  Settings,
  CircleDollarSign,
  Contact,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { LanguageSwitcher } from "@/components/providers/language-switcher";
import { useT, useLocale } from "@/components/providers/locale-provider";
import { roleLabel, type TranslationKey } from "@/lib/i18n/translations";
import type { Role } from "@prisma/client";
import { useState } from "react";

const navItems: {
  href: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
  roles: "all" | string[];
}[] = [
  { href: "/", labelKey: "navDashboard", icon: LayoutDashboard, roles: "all" },
  { href: "/camps", labelKey: "navCamps", icon: Tent, roles: "all" },
  { href: "/animals", labelKey: "navAnimals", icon: Beef, roles: "all" },
  {
    href: "/health",
    labelKey: "navHealth",
    icon: HeartPulse,
    roles: ["OWNER", "FARM_MANAGER", "CAMP_SUPERVISOR", "VETERINARIAN", "RECORDS_CLERK"],
  },
  { href: "/events", labelKey: "navEvents", icon: Activity, roles: "all" },
  {
    href: "/mortality",
    labelKey: "navMortality",
    icon: Skull,
    roles: ["OWNER", "FARM_MANAGER", "CAMP_SUPERVISOR", "VETERINARIAN", "RECORDS_CLERK", "VIEWER"],
  },
  {
    href: "/sales",
    labelKey: "navSales",
    icon: CircleDollarSign,
    roles: ["OWNER", "FARM_MANAGER", "RECORDS_CLERK", "VIEWER"],
  },
  {
    href: "/buyers",
    labelKey: "navBuyers",
    icon: Contact,
    roles: ["OWNER", "FARM_MANAGER", "RECORDS_CLERK"],
  },
  {
    href: "/finance",
    labelKey: "navFinance",
    icon: Wallet,
    roles: ["OWNER", "FARM_MANAGER", "RECORDS_CLERK", "VIEWER"],
  },
  {
    href: "/movements",
    labelKey: "navMovements",
    icon: ArrowLeftRight,
    roles: ["OWNER", "FARM_MANAGER"],
  },
  {
    href: "/breeding",
    labelKey: "navBreeding",
    icon: Dna,
    roles: ["OWNER", "FARM_MANAGER", "CAMP_SUPERVISOR", "RECORDS_CLERK"],
  },
  {
    href: "/reports",
    labelKey: "navReports",
    icon: BarChart3,
    roles: ["OWNER", "FARM_MANAGER", "CAMP_SUPERVISOR", "VETERINARIAN", "RECORDS_CLERK", "VIEWER"],
  },
  { href: "/alerts", labelKey: "navAlerts", icon: Bell, roles: "all" },
  {
    href: "/settings/users",
    labelKey: "navUsers",
    icon: Users,
    roles: ["OWNER", "FARM_MANAGER"],
  },
  {
    href: "/settings/audit",
    labelKey: "navActivityLog",
    icon: Activity,
    roles: ["OWNER", "FARM_MANAGER"],
  },
  {
    href: "/settings/breeds",
    labelKey: "navBreeds",
    icon: Dna,
    roles: ["OWNER", "FARM_MANAGER"],
  },
  {
    href: "/settings/ranch",
    labelKey: "navSettings",
    icon: Settings,
    roles: ["OWNER", "FARM_MANAGER"],
  },
];

interface SidebarProps {
  user: { id?: string; name: string; role: Role };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useT();
  const { locale } = useLocale();

  const filteredNav = navItems.filter((item) => {
    if (item.roles === "all") return true;
    return item.roles.includes(user.role);
  });

  const navContent = (
    <>
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary">
          <Beef className="h-6 w-6" />
          <span>Manyika Ranch</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 space-y-3">
        <LanguageSwitcher />
        <Link
          href={user.id ? `/settings/users/${user.id}` : "#"}
          onClick={() => setMobileOpen(false)}
          className="block px-3 rounded-lg hover:bg-muted transition-colors py-1"
        >
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">
            {roleLabel(locale, user.role)}
          </p>
        </Link>
        <SyncStatusBadge />
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          {t("signOut")}
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
