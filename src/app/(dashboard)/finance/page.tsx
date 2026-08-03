"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import {
  ArrowRight,
  CircleDollarSign,
  Contact,
  HandCoins,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useT } from "@/components/providers/locale-provider";

interface PnLSummary {
  salesRevenue: number;
  otherIncome: number;
  totalExpenses: number;
  net: number;
}

export default function FinanceHubPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageFinance") : false;
  const canViewBuyers = role ? hasPermission(role, "viewBuyers") : false;
  const canViewSales = role ? hasPermission(role, "viewSales") : false;
  const [summary, setSummary] = useState<PnLSummary | null>(null);

  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    fetch(`/api/reports/pnl?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSummary(d.summary));
  }, []);

  const links = [
    {
      href: "/owners",
      title: t("navOwnersBilling"),
      help: t("ownersBillingSubtitle"),
      icon: HandCoins,
      show: true,
    },
    {
      href: "/buyers",
      title: t("navBuyers"),
      help: t("financeBuyersHelp"),
      icon: Contact,
      show: canViewBuyers,
    },
    {
      href: "/sales",
      title: t("navSales"),
      help: t("financeSalesHelp"),
      icon: CircleDollarSign,
      show: canViewSales,
    },
    {
      href: "/finance/expenses",
      title: t("expenses"),
      help: t("financeExpensesHelp"),
      icon: Receipt,
      show: true,
    },
    {
      href: "/finance/income",
      title: t("otherIncome"),
      help: t("financeIncomeHelp"),
      icon: Wallet,
      show: true,
    },
    {
      href: "/finance/pnl",
      title: t("pnl"),
      help: t("financePnlHelp"),
      icon: TrendingUp,
      show: true,
    },
  ].filter((l) => l.show);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {t("financeTitle")}
        </h1>
        <p className="text-muted-foreground">
          {t("financeSubtitle")}
          {!canManage && ` · ${t("viewOnly")}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="activity-card">
          <p className="text-sm text-muted-foreground">{t("salesRevenue")}</p>
          <p className="text-2xl font-bold mt-1">
            {summary ? formatCurrency(summary.salesRevenue) : "—"}
          </p>
        </div>
        <div className="activity-card">
          <p className="text-sm text-muted-foreground">{t("otherIncome")}</p>
          <p className="text-2xl font-bold mt-1">
            {summary ? formatCurrency(summary.otherIncome) : "—"}
          </p>
        </div>
        <div className="activity-card">
          <p className="text-sm text-muted-foreground">{t("expenses")}</p>
          <p className="text-2xl font-bold mt-1">
            {summary ? formatCurrency(summary.totalExpenses) : "—"}
          </p>
        </div>
        <div className="activity-card">
          <p className="text-sm text-muted-foreground">{t("net")}</p>
          <p className="text-2xl font-bold mt-1">
            {summary ? formatCurrency(summary.net) : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="activity-card group block">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {item.help}
                  </p>
                  <span className="inline-flex items-center text-xs font-medium text-primary mt-2">
                    {t("open")} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
