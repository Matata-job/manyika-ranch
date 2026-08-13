"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import {
  ArrowRight,
  Calculator,
  CircleDollarSign,
  Contact,
  HandCoins,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { rangeForMonthPreset } from "@/lib/reports/date-range";

interface PnLSummary {
  salesRevenue: number;
  otherIncome: number;
  totalExpenses: number;
  operatingExpenses?: number;
  projectExpenses?: number;
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
  const period = rangeForMonthPreset("this_month");

  useEffect(() => {
    const params = new URLSearchParams();
    if (period.from) params.set("from", period.from);
    if (period.to) params.set("to", period.to);
    fetch(`/api/reports/pnl?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSummary(d.summary));
  }, [period.from, period.to]);

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
    {
      href: "/finance/production-cost",
      title: t("productionCostTitle"),
      help: t("financeProductionHelp"),
      icon: Calculator,
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
        <p className="text-sm text-muted-foreground mt-1">
          {t("financePeriodThisMonth")}
          {period.from && period.to
            ? ` (${period.from} → ${period.to})`
            : ""}
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
          <p className="text-sm text-muted-foreground">{t("operatingExpenses")}</p>
          <p className="text-2xl font-bold mt-1">
            {summary
              ? formatCurrency(
                  summary.operatingExpenses ?? summary.totalExpenses
                )
              : "—"}
          </p>
          {summary && (summary.projectExpenses ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("projectExpenses")}: {formatCurrency(summary.projectExpenses || 0)}
            </p>
          )}
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
