"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Download, Upload, Beef, HeartPulse, CircleDollarSign, Wallet, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { useT } from "@/components/providers/locale-provider";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import {
  rangeForMonthPreset,
  type MonthPreset,
} from "@/lib/reports/date-range";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
} from "@/components/list-pagination";
import {
  ProductionCostPanel,
  type ProductionCostRow,
  type ProductionCostSummary,
} from "@/components/finance/production-cost-panel";

type ReportTab = "herd" | "health" | "sales" | "finance" | "production";

interface CampOption {
  id: string;
  name: string;
}

interface HerdReport {
  summary: {
    total: number;
    byCamp: { name: string; count: number }[];
    bySex: { name: string; count: number }[];
    byBreed: { name: string; count: number }[];
    byAge: { name: string; count: number }[];
  };
  animals: {
    id: string;
    eartag: string;
    breed: string;
    sex: string;
    status: string;
    dob: string | null;
    ageMonths: number | null;
    acquisitionType: string | null;
    acquisitionDate: string | null;
    camp: { id: string; name: string; code?: string | null };
    owner: { id: string; name: string };
    sire: { eartag: string } | null;
    dam: { eartag: string } | null;
    notes: string | null;
  }[];
}

interface HealthReport {
  summary: {
    vaccinations: number;
    treatments: number;
    healthRecords: number;
    vaccinationsDue: number;
    treatmentsDue: number;
  };
  vaccinations: {
    id: string;
    vaccineName: string;
    date: string;
    nextDue: string | null;
    batchNo: string | null;
    animal: {
      id: string;
      eartag: string;
      breed: string;
      camp: { name: string };
    };
  }[];
  treatments: {
    id: string;
    type: string;
    product: string;
    date: string;
    nextDue: string | null;
    animal: {
      id: string;
      eartag: string;
      breed: string;
      camp: { name: string };
    };
  }[];
  healthRecords: {
    id: string;
    type: string;
    diagnosis: string | null;
    treatment: string | null;
    date: string;
    animal: {
      id: string;
      eartag: string;
      breed: string;
      camp: { name: string };
    };
  }[];
  vaccinationsDue: {
    id: string;
    vaccineName: string;
    nextDue: string;
    animal: { id: string; eartag: string; camp: { name: string } };
  }[];
}

interface SalesReport {
  summary: {
    count: number;
    totalRevenue: number;
    totalWeight: number;
    avgPrice: number;
    avgPricePerKg: number | null;
  };
  byCamp: { name: string; count: number; revenue: number }[];
  sales: {
    id: string;
    buyer: string;
    priceTzs: number;
    weightAtSale: number | null;
    saleDate: string;
    animal: {
      id: string;
      eartag: string;
      breed: string;
      sex: string;
      camp: { name: string };
      owner: { name: string };
    };
  }[];
}

interface FinanceReport {
  summary: {
    salesRevenue: number;
    otherIncome: number;
    totalIncome: number;
    totalExpenses: number;
    net: number;
    saleCount: number;
    expenseCount: number;
    otherIncomeCount: number;
  };
  expensesByCategory: { name: string; amount: number }[];
  incomeByCategory: { name: string; amount: number }[];
  monthly: {
    month: string;
    sales: number;
    otherIncome: number;
    expenses: number;
    net: number;
  }[];
  byCamp: {
    name: string;
    sales: number;
    otherIncome: number;
    expenses: number;
    net: number;
  }[];
}

function ageLabel(
  key: string,
  t: (k: "calves" | "weaners" | "adults" | "ageMature" | "unknown") => string
): string {
  switch (key) {
    case "calf":
      return t("calves");
    case "yearling":
      return t("weaners");
    case "adult":
      return t("adults");
    case "mature":
      return t("ageMature");
    default:
      return t("unknown");
  }
}

export default function ReportsPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canViewSales = role ? hasPermission(role, "viewSales") : false;
  const canViewFinance = role ? hasPermission(role, "viewFinance") : false;
  const canViewBuyers = role ? hasPermission(role, "viewBuyers") : false;
  const canImport = role ? hasPermission(role, "importData") : false;

  const [tab, setTab] = useState<ReportTab>("herd");
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [camp, setCamp] = useState("all");
  const [ageGroup, setAgeGroup] = useState("all");
  const [status, setStatus] = useState("ACTIVE");
  const initialRange = rangeForMonthPreset("this_month");
  const [monthPreset, setMonthPreset] = useState<MonthPreset>("this_month");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [loading, setLoading] = useState(false);

  const [herd, setHerd] = useState<HerdReport | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [finance, setFinance] = useState<FinanceReport | null>(null);
  const [production, setProduction] = useState<{
    summary: ProductionCostSummary;
    rows: ProductionCostRow[];
  } | null>(null);
  const [tableOffset, setTableOffset] = useState(0);

  const [importResults, setImportResults] = useState<
    { eartag: string; success: boolean; error?: string }[] | null
  >(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : d.camps || []))
      .catch(() => {});
  }, []);

  function applyMonthPreset(preset: MonthPreset) {
    setMonthPreset(preset);
    if (preset === "custom") return;
    const range = rangeForMonthPreset(preset);
    setFrom(range.from);
    setTo(range.to);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setTableOffset(0);
    const params = new URLSearchParams();
    if (camp !== "all") params.set("camp", camp);
    if (ageGroup !== "all") params.set("ageGroup", ageGroup);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      if (tab === "herd") {
        const p = new URLSearchParams(params);
        if (status !== "ALL") p.set("status", status);
        const res = await fetch(`/api/reports/herd?${p}`);
        if (res.ok) setHerd(await res.json());
        else setHerd(null);
      } else if (tab === "health") {
        const res = await fetch(`/api/reports/health?${params}`);
        if (res.ok) setHealth(await res.json());
        else setHealth(null);
      } else if (tab === "sales" && canViewSales) {
        const res = await fetch(`/api/reports/sales?${params}`);
        if (res.ok) setSales(await res.json());
        else setSales(null);
      } else if (tab === "finance" && canViewFinance) {
        // Finance: camp + date; age not applied to expenses
        const p = new URLSearchParams();
        if (camp !== "all") p.set("camp", camp);
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        const res = await fetch(`/api/reports/pnl?${p}`);
        if (res.ok) setFinance(await res.json());
        else setFinance(null);
      } else if (tab === "production" && canViewFinance) {
        const p = new URLSearchParams();
        if (camp !== "all") p.set("camp", camp);
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        const res = await fetch(`/api/reports/production-cost?${p}`);
        if (res.ok) setProduction(await res.json());
        else setProduction(null);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, camp, ageGroup, status, from, to, canViewSales, canViewFinance]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCurrent() {
    const stamp = new Date().toISOString().slice(0, 10);
    if (tab === "herd" && herd?.animals.length) {
      const csv = rowsToCsv(
        [
          "eartag",
          "camp",
          "breed",
          "sex",
          "status",
          "ageMonths",
          "dob",
          "owner",
          "sire",
          "dam",
          "acquisitionType",
          "acquisitionDate",
          "notes",
        ],
        herd.animals.map((a) => [
          a.eartag,
          a.camp.name,
          a.breed,
          a.sex,
          a.status,
          a.ageMonths,
          a.dob ? a.dob.slice(0, 10) : "",
          a.owner.name,
          a.sire?.eartag || "",
          a.dam?.eartag || "",
          a.acquisitionType,
          a.acquisitionDate ? a.acquisitionDate.slice(0, 10) : "",
          a.notes,
        ])
      );
      downloadCsv(`herd-report-${stamp}.csv`, csv);
      return;
    }
    if (tab === "health" && health) {
      const rows: (string | number | null | undefined)[][] = [];
      for (const v of health.vaccinations) {
        rows.push([
          "vaccination",
          v.date.slice(0, 10),
          v.animal.camp.name,
          v.animal.eartag,
          v.animal.breed,
          v.vaccineName,
          v.batchNo,
          v.nextDue ? v.nextDue.slice(0, 10) : "",
          "",
        ]);
      }
      for (const tr of health.treatments) {
        rows.push([
          "treatment",
          tr.date.slice(0, 10),
          tr.animal.camp.name,
          tr.animal.eartag,
          tr.animal.breed,
          tr.type,
          tr.product,
          tr.nextDue ? tr.nextDue.slice(0, 10) : "",
          "",
        ]);
      }
      for (const h of health.healthRecords) {
        rows.push([
          "health",
          h.date.slice(0, 10),
          h.animal.camp.name,
          h.animal.eartag,
          h.animal.breed,
          h.type,
          h.diagnosis,
          h.treatment,
          "",
        ]);
      }
      if (!rows.length) return;
      downloadCsv(
        `health-report-${stamp}.csv`,
        rowsToCsv(
          [
            "kind",
            "date",
            "camp",
            "eartag",
            "breed",
            "name_or_type",
            "detail",
            "nextDue_or_treatment",
            "notes",
          ],
          rows
        )
      );
      return;
    }
    if (tab === "sales" && sales?.sales.length) {
      downloadCsv(
        `sales-report-${stamp}.csv`,
        rowsToCsv(
          [
            "saleDate",
            "eartag",
            "camp",
            "breed",
            "sex",
            "owner",
            "buyer",
            "priceTzs",
            "weightKg",
          ],
          sales.sales.map((s) => [
            s.saleDate.slice(0, 10),
            s.animal.eartag,
            s.animal.camp.name,
            s.animal.breed,
            s.animal.sex,
            s.animal.owner.name,
            s.buyer,
            s.priceTzs,
            s.weightAtSale,
          ])
        )
      );
      return;
    }
    if (tab === "finance" && finance) {
      const rows: (string | number)[][] = [
        ["summary", "salesRevenue", finance.summary.salesRevenue],
        ["summary", "otherIncome", finance.summary.otherIncome],
        ["summary", "totalExpenses", finance.summary.totalExpenses],
        ["summary", "net", finance.summary.net],
        ...finance.expensesByCategory.map(
          (r) => ["expense", r.name, r.amount] as (string | number)[]
        ),
        ...finance.incomeByCategory.map(
          (r) => ["otherIncome", r.name, r.amount] as (string | number)[]
        ),
        ...finance.monthly.map(
          (m) => ["month", m.month, m.net] as (string | number)[]
        ),
        ...finance.byCamp.map(
          (c) => ["camp", c.name, c.net] as (string | number)[]
        ),
      ];
      downloadCsv(
        `finance-report-${stamp}.csv`,
        rowsToCsv(["section", "name", "amount"], rows)
      );
      return;
    }
    if (tab === "production" && production?.rows.length) {
      downloadCsv(
        `production-cost-${stamp}.csv`,
        rowsToCsv(
          [
            "eartag",
            "camp",
            "animalDays",
            "purchasePriceTzs",
            "feedShareTzs",
            "treatmentTzs",
            "periodCostTzs",
            "weightGainKg",
            "costPerKgTzs",
          ],
          production.rows.map((r) => [
            r.eartag,
            r.campName,
            r.animalDays,
            r.purchasePriceTzs,
            r.feedShareTzs,
            r.treatmentTzs,
            r.periodCostTzs,
            r.weightGainKg,
            r.costPerKgTzs,
          ])
        )
      );
    }
  }

  function downloadTemplate() {
    const csv =
      "eartag,breed,sex,campName,dob,ownerEmail,sireEartag,damEartag,colorMarkings,notes\nNEW-001,Boran,FEMALE,Camp Alpha,2024-01-15,,,,\n";
    downloadCsv("animal-import-template.csv", csv);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      return row;
    });

    const res = await fetch("/api/reports/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });

    if (res.ok) {
      const data = await res.json();
      setImportResults(data.results);
      if (tab === "herd") load();
    }
  }

  const canExport =
    (tab === "herd" && !!herd?.animals.length) ||
    (tab === "health" &&
      !!health &&
      (health.vaccinations.length > 0 ||
        health.treatments.length > 0 ||
        health.healthRecords.length > 0)) ||
    (tab === "sales" && !!sales?.sales.length) ||
    (tab === "finance" && !!finance) ||
    (tab === "production" && !!production?.rows.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            {t("reportsTitle")}
          </h1>
          <p className="text-muted-foreground">{t("reportsSubtitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("reportsSelectHelp")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportCurrent}
          disabled={!canExport}
          className="shrink-0"
        >
          <Download className="h-4 w-4 mr-2" /> {t("exportCsv")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {(
          [
            {
              id: "herd" as const,
              titleKey: "reportHerd" as const,
              helpKey: "reportHerdHelp" as const,
              icon: Beef,
              show: true,
            },
            {
              id: "health" as const,
              titleKey: "reportHealth" as const,
              helpKey: "reportHealthHelp" as const,
              icon: HeartPulse,
              show: true,
            },
            {
              id: "sales" as const,
              titleKey: "reportSales" as const,
              helpKey: "reportSalesHelp" as const,
              icon: CircleDollarSign,
              show: canViewSales,
            },
            {
              id: "finance" as const,
              titleKey: "reportFinance" as const,
              helpKey: "reportFinanceHelp" as const,
              icon: Wallet,
              show: canViewFinance,
            },
            {
              id: "production" as const,
              titleKey: "reportProduction" as const,
              helpKey: "reportProductionHelp" as const,
              icon: Calculator,
              show: canViewFinance,
            },
          ] as const
        )
          .filter((c) => c.show)
          .map((c) => {
            const Icon = c.icon;
            const selected = tab === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setTab(c.id);
                  setTableOffset(0);
                }}
                className={cn(
                  "activity-card text-left",
                  selected && "ring-2 ring-foreground border-foreground"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-muted/40">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold">{t(c.titleKey)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {t(c.helpKey)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      <p className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
        {canViewBuyers && (
          <Link href="/buyers" className="text-primary hover:underline">
            {t("buyersTitle")}
          </Link>
        )}
        <Link href="/mortality" className="text-primary hover:underline">
          {t("mortalityReport")}
        </Link>
        <Link href="/events" className="text-primary hover:underline">
          {t("navEvents")}
        </Link>
        {canViewSales && (
          <Link href="/sales" className="text-primary hover:underline">
            {t("salesReport")}
          </Link>
        )}
        {canViewFinance && (
          <>
            <Link href="/finance/pnl" className="text-primary hover:underline">
              {t("pnl")}
            </Link>
            <Link href="/finance/production-cost" className="text-primary hover:underline">
              {t("productionCostTitle")}
            </Link>
          </>
        )}
      </p>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1.5">
              <Label>{t("camp")}</Label>
              <Select value={camp} onValueChange={setCamp}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCamps")}</SelectItem>
                  {camps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tab !== "finance" && tab !== "production" && (
              <div className="space-y-1.5">
                <Label>{t("ageGroup")}</Label>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allAges")}</SelectItem>
                    <SelectItem value="calf">{t("calves")}</SelectItem>
                    <SelectItem value="yearling">{t("weaners")}</SelectItem>
                    <SelectItem value="adult">{t("adults")}</SelectItem>
                    <SelectItem value="mature">{t("ageMature")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {tab === "herd" && (
              <div className="space-y-1.5">
                <Label>{t("status")}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{t("active")}</SelectItem>
                    <SelectItem value="ALL">{t("allStatuses")}</SelectItem>
                    <SelectItem value="DECEASED">{t("deceased")}</SelectItem>
                    <SelectItem value="SOLD">{t("sold")}</SelectItem>
                    <SelectItem value="MISSING">{t("statusMissing")}</SelectItem>
                    <SelectItem value="QUARANTINE">{t("quarantine")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("monthPreset")}</Label>
              <Select
                value={monthPreset}
                onValueChange={(v) => applyMonthPreset(v as MonthPreset)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_time">{t("allTime")}</SelectItem>
                  <SelectItem value="this_month">{t("thisMonth")}</SelectItem>
                  <SelectItem value="last_month">{t("lastMonth")}</SelectItem>
                  <SelectItem value="last_3_months">{t("last3Months")}</SelectItem>
                  <SelectItem value="this_year">{t("thisYear")}</SelectItem>
                  <SelectItem value="custom">{t("customRange")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("dateFrom")}</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setMonthPreset("custom");
                  setFrom(e.target.value);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("dateTo")}</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setMonthPreset("custom");
                  setTo(e.target.value);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {tab === "herd"
              ? t("herdDateHint")
              : tab === "finance"
                ? t("financeDateHint")
                : tab === "production"
                  ? t("productionDateHint")
                  : t("activityDateHint")}
          </p>
          <Button onClick={load} disabled={loading} size="sm">
            {loading ? t("loading") : t("applyFilters")}
          </Button>
        </CardContent>
      </Card>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as ReportTab);
          setTableOffset(0);
        }}
        className="space-y-4"
      >
        <TabsList className="sr-only">
          <TabsTrigger value="herd">{t("reportHerd")}</TabsTrigger>
          <TabsTrigger value="health">{t("reportHealth")}</TabsTrigger>
          {canViewSales && (
            <TabsTrigger value="sales">{t("reportSales")}</TabsTrigger>
          )}
          {canViewFinance && (
            <>
              <TabsTrigger value="finance">{t("reportFinance")}</TabsTrigger>
              <TabsTrigger value="production">{t("reportProduction")}</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="herd" className="space-y-4">
          {herd && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("totalAnimals")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{herd.summary.total}</p>
                  </CardContent>
                </Card>
                {herd.summary.byAge.map((a) => (
                  <Card key={a.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {ageLabel(a.name, t)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{a.count}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {herd.summary.byCamp.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("byCamp")}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {herd.summary.byCamp.map((c) => (
                      <Badge key={c.name} variant="secondary">
                        {c.name}: {c.count}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>{t("herdRecords")}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {herd.animals.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("noReportRows")}</p>
                  ) : (
                    <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3">{t("eartag")}</th>
                          <th className="py-2 pr-3">{t("camp")}</th>
                          <th className="py-2 pr-3">{t("breed")}</th>
                          <th className="py-2 pr-3">{t("sex")}</th>
                          <th className="py-2 pr-3">{t("age")}</th>
                          <th className="py-2">{t("owner")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {herd.animals
                          .slice(tableOffset, tableOffset + DEFAULT_PAGE_SIZE)
                          .map((a) => (
                          <tr key={a.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">
                              <Link
                                href={`/animals/${a.id}`}
                                className="text-primary hover:underline font-medium"
                              >
                                {a.eartag}
                              </Link>
                            </td>
                            <td className="py-2 pr-3">{a.camp.name}</td>
                            <td className="py-2 pr-3">{a.breed}</td>
                            <td className="py-2 pr-3">{a.sex}</td>
                            <td className="py-2 pr-3">
                              {a.ageMonths != null ? `${a.ageMonths} mo` : "—"}
                            </td>
                            <td className="py-2">{a.owner.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <ListPagination
                      total={herd.animals.length}
                      limit={DEFAULT_PAGE_SIZE}
                      offset={tableOffset}
                      onPrev={() =>
                        setTableOffset(Math.max(0, tableOffset - DEFAULT_PAGE_SIZE))
                      }
                      onNext={() =>
                        setTableOffset(tableOffset + DEFAULT_PAGE_SIZE)
                      }
                    />
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          {health && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {(
                  [
                    ["vaccinations", health.summary.vaccinations],
                    ["treatments", health.summary.treatments],
                    ["healthChecks", health.summary.healthRecords],
                    ["vaccinationsDue", health.summary.vaccinationsDue],
                    ["treatmentsDue", health.summary.treatmentsDue],
                  ] as const
                ).map(([key, n]) => (
                  <Card key={key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{t(key)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{n}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {health.vaccinationsDue.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("vaccinationDueReport")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {health.vaccinationsDue.map((v) => (
                      <div
                        key={v.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm border-b pb-2 last:border-0"
                      >
                        <Link
                          href={`/animals/${v.animal.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {v.animal.eartag}
                        </Link>
                        <span>{v.vaccineName}</span>
                        <span className="text-muted-foreground">
                          {v.animal.camp.name}
                        </span>
                        <Badge variant="warning">{formatDate(v.nextDue)}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>{t("recentHealthActivity")}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {health.vaccinations.length +
                    health.treatments.length +
                    health.healthRecords.length ===
                  0 ? (
                    <p className="text-muted-foreground text-sm">{t("noReportRows")}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3">{t("date")}</th>
                          <th className="py-2 pr-3">{t("kind")}</th>
                          <th className="py-2 pr-3">{t("eartag")}</th>
                          <th className="py-2 pr-3">{t("camp")}</th>
                          <th className="py-2">{t("detail")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...health.vaccinations.map((v) => ({
                            id: v.id,
                            date: v.date,
                            kind: t("vaccinations"),
                            animal: v.animal,
                            detail: v.vaccineName,
                          })),
                          ...health.treatments.map((tr) => ({
                            id: tr.id,
                            date: tr.date,
                            kind: t("treatments"),
                            animal: tr.animal,
                            detail: `${tr.type}: ${tr.product}`,
                          })),
                          ...health.healthRecords.map((h) => ({
                            id: h.id,
                            date: h.date,
                            kind: t("healthChecks"),
                            animal: h.animal,
                            detail: h.diagnosis || h.type,
                          })),
                        ]
                          .sort(
                            (a, b) =>
                              new Date(b.date).getTime() -
                              new Date(a.date).getTime()
                          )
                          .slice(0, 80)
                          .map((row) => (
                            <tr key={row.id} className="border-b last:border-0">
                              <td className="py-2 pr-3">{formatDate(row.date)}</td>
                              <td className="py-2 pr-3">{row.kind}</td>
                              <td className="py-2 pr-3">
                                <Link
                                  href={`/animals/${row.animal.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {row.animal.eartag}
                                </Link>
                              </td>
                              <td className="py-2 pr-3">{row.animal.camp.name}</td>
                              <td className="py-2">{row.detail}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          {sales && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("salesCount")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{sales.summary.count}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("salesRevenue")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {formatCurrency(sales.summary.totalRevenue)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("avgPrice")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {formatCurrency(sales.summary.avgPrice)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("totalWeight")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {sales.summary.totalWeight
                        ? `${Math.round(sales.summary.totalWeight)} kg`
                        : "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>{t("saleRecords")}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {sales.sales.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("noReportRows")}</p>
                  ) : (
                    <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3">{t("date")}</th>
                          <th className="py-2 pr-3">{t("eartag")}</th>
                          <th className="py-2 pr-3">{t("camp")}</th>
                          <th className="py-2 pr-3">{t("buyer")}</th>
                          <th className="py-2">{t("price")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.sales
                          .slice(tableOffset, tableOffset + DEFAULT_PAGE_SIZE)
                          .map((s) => (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">{formatDate(s.saleDate)}</td>
                            <td className="py-2 pr-3">
                              <Link
                                href={`/animals/${s.animal.id}`}
                                className="text-primary hover:underline"
                              >
                                {s.animal.eartag}
                              </Link>
                            </td>
                            <td className="py-2 pr-3">{s.animal.camp.name}</td>
                            <td className="py-2 pr-3">{s.buyer}</td>
                            <td className="py-2">{formatCurrency(s.priceTzs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <ListPagination
                      total={sales.sales.length}
                      limit={DEFAULT_PAGE_SIZE}
                      offset={tableOffset}
                      onPrev={() =>
                        setTableOffset(Math.max(0, tableOffset - DEFAULT_PAGE_SIZE))
                      }
                      onNext={() =>
                        setTableOffset(tableOffset + DEFAULT_PAGE_SIZE)
                      }
                    />
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          {finance && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("salesRevenue")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {formatCurrency(finance.summary.salesRevenue)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("otherIncome")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {formatCurrency(finance.summary.otherIncome)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("totalExpenses")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {formatCurrency(finance.summary.totalExpenses)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("net")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {formatCurrency(finance.summary.net)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>{t("byCamp")}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {finance.byCamp.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("noReportRows")}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3">{t("camp")}</th>
                          <th className="py-2 pr-3">{t("salesRevenue")}</th>
                          <th className="py-2 pr-3">{t("otherIncome")}</th>
                          <th className="py-2 pr-3">{t("totalExpenses")}</th>
                          <th className="py-2">{t("net")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finance.byCamp.map((c) => (
                          <tr key={c.name} className="border-b last:border-0">
                            <td className="py-2 pr-3 font-medium">{c.name}</td>
                            <td className="py-2 pr-3">{formatCurrency(c.sales)}</td>
                            <td className="py-2 pr-3">
                              {formatCurrency(c.otherIncome)}
                            </td>
                            <td className="py-2 pr-3">
                              {formatCurrency(c.expenses)}
                            </td>
                            <td className="py-2">{formatCurrency(c.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          {production && (
            <ProductionCostPanel
              summary={production.summary}
              rows={production.rows}
              offset={tableOffset}
              onOffset={setTableOffset}
            />
          )}
        </TabsContent>
      </Tabs>

      {canImport && (
        <Card>
          <CardHeader>
            <CardTitle>{t("bulkImport")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" /> {t("downloadTemplate")}
              </Button>
              <Button
                size="sm"
                onClick={() => fileRef.current?.click()}
                variant="secondary"
              >
                <Upload className="h-4 w-4 mr-1" /> {t("importCsv")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />
            </div>
            {importResults && (
              <div className="text-sm space-y-1 max-h-40 overflow-y-auto">
                {importResults.map((r, i) => (
                  <p
                    key={i}
                    className={r.success ? "text-green-700" : "text-destructive"}
                  >
                    {r.eartag}: {r.success ? t("ok") : r.error}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
