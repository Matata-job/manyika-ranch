"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import {
  ChevronDown,
  Columns3,
  Download,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { ReturnSaleForm } from "@/components/sales/return-sale-form";
import {
  loadSalesColumnPrefs,
  SalesCustomizeColumnsPanel,
  type SalesColumnId,
} from "@/components/sales/sales-columns";
import {
  rangeForMonthPreset,
  type MonthPreset,
} from "@/lib/reports/date-range";
import type { TranslationKey } from "@/lib/i18n/translations";

interface SalesReport {
  summary: {
    count: number;
    returnedCount?: number;
    totalCount?: number;
    totalRevenue: number;
    totalWeight: number;
    totalRefunded?: number;
    avgPrice: number;
    avgPricePerKg: number | null;
  };
  byBreed: { name: string; count: number; revenue: number }[];
  byCamp: { name: string; count: number; revenue: number }[];
  bySex: { name: string; count: number; revenue: number }[];
  byBuyer: {
    name: string;
    count: number;
    revenue: number;
    buyerId?: string | null;
  }[];
  sales: {
    id: string;
    buyer: string;
    buyerId?: string | null;
    priceTzs: number;
    weightAtSale: number | null;
    saleDate: string;
    transport: string | null;
    notes: string | null;
    returnedAt?: string | null;
    returnedReason?: string | null;
    refundedTzs?: number | null;
    returnedToCamp?: { id: string; name: string } | null;
    animal: {
      id: string;
      eartag: string;
      breed: string;
      sex: string;
      camp: { id: string; name: string };
      owner: { id: string; name: string };
    };
  }[];
}

const PERIOD_PRESETS: MonthPreset[] = [
  "all_time",
  "this_month",
  "last_month",
  "last_3_months",
  "this_year",
  "last_year",
  "custom",
];

function periodLabel(
  preset: MonthPreset,
  t: (key: TranslationKey) => string
): string {
  switch (preset) {
    case "all_time":
      return t("allTime");
    case "this_month":
      return t("thisMonth");
    case "last_month":
      return t("lastMonth");
    case "last_3_months":
      return t("last3Months");
    case "this_year":
      return t("thisYear");
    case "last_year":
      return t("lastYear");
    case "custom":
      return t("customRange");
  }
}

export default function SalesPage() {
  const t = useT();
  const { data: session } = useSession();
  const canManageSales = session?.user?.role
    ? hasPermission(session.user.role as Role, "manageSales")
    : false;

  const initialRange = rangeForMonthPreset("all_time");
  const [monthPreset, setMonthPreset] = useState<MonthPreset>("all_time");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [camp, setCamp] = useState("all");
  const [breed, setBreed] = useState("all");
  const [sex, setSex] = useState("all");
  const [buyerId, setBuyerId] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "returned">("all");
  const [q, setQ] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<SalesColumnId[]>(
    DEFAULT_VISIBLE_SAFE
  );

  const [data, setData] = useState<SalesReport | null>(null);
  const [prioritySale, setPrioritySale] = useState<
    {
      id: string;
      eartag: string;
      breed: string;
      sex: string;
      herdPlanNote: string | null;
      camp: { id: string; name: string };
    }[]
  >([]);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [breedOptions, setBreedOptions] = useState<string[]>([]);
  const [buyers, setBuyers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [returningSaleId, setReturningSaleId] = useState<string | null>(null);

  useEffect(() => {
    setVisibleCols(loadSalesColumnPrefs());
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [filtersOpen]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (camp !== "all") params.set("camp", camp);
    if (breed !== "all") params.set("breed", breed);
    if (sex !== "all") params.set("sex", sex);
    if (buyerId !== "all") params.set("buyerId", buyerId);
    if (status !== "all") params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/reports/sales?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to, camp, breed, sex, buyerId, status, q]);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : d.camps || []))
      .catch(() => {});
    fetch("/api/breeds")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setBreedOptions(
          list
            .map((b: { name?: string } | string) =>
              typeof b === "string" ? b : b.name || ""
            )
            .filter(Boolean)
            .sort()
        );
      })
      .catch(() => {});
    fetch("/api/buyers")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.buyers || [];
        setBuyers(
          list
            .map((b: { id: string; name: string }) => ({
              id: b.id,
              name: b.name,
            }))
            .sort((a: { name: string }, b: { name: string }) =>
              a.name.localeCompare(b.name)
            )
        );
      })
      .catch(() => {});
    fetch(
      "/api/animals?status=ACTIVE&herdPlan=SELL_NEXT_CYCLE&limit=500&sort=eartag_asc"
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.animals || [];
        setPrioritySale(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function applyMonthPreset(preset: MonthPreset) {
    setMonthPreset(preset);
    if (preset === "custom") {
      if (!from && !to) {
        const seed = rangeForMonthPreset("this_year");
        setFrom(seed.from);
        setTo(seed.to);
      }
      return;
    }
    const range = rangeForMonthPreset(preset);
    setFrom(range.from);
    setTo(range.to);
  }

  function clearFilters() {
    applyMonthPreset("all_time");
    setCamp("all");
    setBreed("all");
    setSex("all");
    setBuyerId("all");
    setStatus("all");
    setQ("");
  }

  const advancedCount = [
    monthPreset !== "all_time",
    camp !== "all",
    breed !== "all",
    sex !== "all",
    buyerId !== "all",
    status !== "all",
  ].filter(Boolean).length;

  const hasActiveFilters = advancedCount > 0 || Boolean(q.trim());

  const colSet = useMemo(() => new Set(visibleCols), [visibleCols]);
  function showCol(id: SalesColumnId) {
    return colSet.has(id);
  }

  function exportCsv() {
    if (!data?.sales?.length) return;
    const headers = [
      "saleDate",
      "eartag",
      "breed",
      "sex",
      "camp",
      "owner",
      "buyer",
      "priceTzs",
      "weightKg",
      "pricePerKg",
      "transport",
      "notes",
      "status",
      "returnedAt",
      "returnedReason",
      "refundedTzs",
      "returnedToCamp",
    ];
    const rows = data.sales.map((s) => {
      const ppk =
        s.weightAtSale && s.weightAtSale > 0
          ? Math.round(s.priceTzs / s.weightAtSale)
          : "";
      return [
        s.saleDate.slice(0, 10),
        s.animal.eartag,
        s.animal.breed,
        s.animal.sex,
        s.animal.camp.name,
        `"${(s.animal.owner?.name || "").replace(/"/g, '""')}"`,
        `"${s.buyer.replace(/"/g, '""')}"`,
        s.priceTzs,
        s.weightAtSale ?? "",
        ppk,
        s.transport ? `"${s.transport.replace(/"/g, '""')}"` : "",
        s.notes ? `"${s.notes.replace(/"/g, '""')}"` : "",
        s.returnedAt ? "returned" : "active",
        s.returnedAt ? s.returnedAt.slice(0, 10) : "",
        s.returnedReason
          ? `"${s.returnedReason.replace(/"/g, '""')}"`
          : "",
        s.refundedTzs ?? "",
        s.returnedToCamp?.name
          ? `"${s.returnedToCamp.name.replace(/"/g, '""')}"`
          : "",
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const gridTemplate = useMemo(() => {
    const parts: string[] = [];
    if (showCol("saleDate")) parts.push("7rem");
    if (showCol("animal")) parts.push("minmax(0,1.2fr)");
    if (showCol("camp")) parts.push("minmax(0,0.9fr)");
    if (showCol("breed")) parts.push("minmax(0,0.8fr)");
    if (showCol("sex")) parts.push("5rem");
    if (showCol("buyer")) parts.push("minmax(0,1fr)");
    if (showCol("price")) parts.push("7rem");
    if (showCol("weight")) parts.push("5rem");
    if (showCol("pricePerKg")) parts.push("6.5rem");
    if (showCol("transport")) parts.push("minmax(0,0.8fr)");
    if (showCol("notes")) parts.push("minmax(0,1fr)");
    if (showCol("owner")) parts.push("minmax(0,0.8fr)");
    if (showCol("status")) parts.push("6.5rem");
    if (showCol("returnedAt")) parts.push("7rem");
    if (showCol("refund")) parts.push("7rem");
    if (showCol("actions") && canManageSales) parts.push("7.5rem");
    return parts.join(" ");
  }, [visibleCols, canManageSales]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("salesTitle")}</h1>
          <p className="text-muted-foreground">{t("salesSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageSales && (
            <>
              <Button asChild>
                <Link href="/sales/bulk">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("bulkSale")}
                </Link>
              </Button>
              {prioritySale.length > 0 && (
                <Button asChild variant="outline">
                  <Link href="/sales/bulk?herdPlan=SELL_NEXT_CYCLE">
                    {t("bulkSellMarked", { n: prioritySale.length })}
                  </Link>
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!data?.sales?.length}
          >
            <Download className="h-4 w-4 mr-2" />
            {t("exportCsv")}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <button
          type="button"
          onClick={() => setPriorityOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          aria-expanded={priorityOpen}
        >
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{t("saleCyclePriority")}</span>
            <Badge variant="secondary">{prioritySale.length}</Badge>
            {!priorityOpen && prioritySale.length > 0 && (
              <span className="text-xs text-muted-foreground truncate">
                {t("saleCyclePriorityCollapsedHelp")}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              priorityOpen && "rotate-180"
            )}
          />
        </button>
        {priorityOpen && (
          <div className="border-t border-border/60 px-4 py-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("saleCyclePriorityHelp")}
            </p>
            {prioritySale.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noMarkedForSale")}
              </p>
            ) : (
              <ul className="divide-y divide-border/50 rounded-xl border border-border/60 overflow-hidden">
                {prioritySale.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/animals/${a.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {a.eartag}
                      </Link>
                      <p className="text-sm text-muted-foreground truncate">
                        {a.breed} ·{" "}
                        {a.sex === "FEMALE" ? t("female") : t("male")} ·{" "}
                        {a.camp?.name}
                        {a.herdPlanNote ? ` · ${a.herdPlanNote}` : ""}
                      </p>
                    </div>
                    <Badge variant="warning">{t("herdPlanSellNextCycle")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Filter drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition-opacity duration-200",
          filtersOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
        aria-hidden={!filtersOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
          aria-label={t("cancel")}
          onClick={() => setFiltersOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="sales-filter-title"
          className={cn(
            "absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-2xl border-l transition-transform duration-300 ease-out",
            filtersOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2
                id="sales-filter-title"
                className="text-lg font-semibold tracking-tight"
              >
                {t("advancedFilters")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("salesFilterDrawerHelp")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("cancel")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("monthPreset")}
              </Label>
              <div className="flex flex-wrap gap-2">
                {PERIOD_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyMonthPreset(preset)}
                    className={cn(
                      "category-pill",
                      monthPreset === preset
                        ? "category-pill-active"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {periodLabel(preset, t)}
                  </button>
                ))}
              </div>
              {monthPreset === "custom" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {t("dateFrom")}
                    </Label>
                    <Input
                      type="date"
                      className="h-11 rounded-xl"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {t("dateTo")}
                    </Label>
                    <Input
                      type="date"
                      className="h-11 rounded-xl"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("saleStatusFilter")}
              </Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setStatus(v as "all" | "active" | "returned")
                }
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allSalesStatus")}</SelectItem>
                  <SelectItem value="active">{t("activeSalesOnly")}</SelectItem>
                  <SelectItem value="returned">
                    {t("returnedSalesOnly")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("camp")}
              </Label>
              <Select value={camp} onValueChange={setCamp}>
                <SelectTrigger className="h-11 rounded-xl">
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
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("breed")}
              </Label>
              <Select value={breed} onValueChange={setBreed}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allBreeds")}</SelectItem>
                  {breedOptions.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sex")}
              </Label>
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allSexes")}</SelectItem>
                  <SelectItem value="FEMALE">{t("female")}</SelectItem>
                  <SelectItem value="MALE">{t("male")}</SelectItem>
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("buyer")}
              </Label>
              <Select value={buyerId} onValueChange={setBuyerId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allBuyers")}</SelectItem>
                  {buyers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          </div>

          <div className="border-t px-5 py-4 flex gap-2 justify-end bg-background">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                clearFilters();
                setFiltersOpen(true);
              }}
            >
              {t("clearFilters")}
            </Button>
            <Button
              type="button"
              className="min-w-[7rem]"
              onClick={() => {
                load();
                setFiltersOpen(false);
              }}
              disabled={loading}
            >
              {loading ? t("loading") : t("apply")}
            </Button>
          </div>
        </aside>
      </div>

      <SalesCustomizeColumnsPanel
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        value={visibleCols}
        onChange={setVisibleCols}
      />

      <p className="text-xs text-muted-foreground -mt-2">
        {t("clickSummaryToFilter")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          className="text-left"
          onClick={() => setStatus(status === "active" ? "all" : "active")}
        >
          <Card
            className={cn(
              "transition-colors",
              status === "active" && "ring-2 ring-primary/40"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("animalsSoldActive")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.summary.count ?? "—"}</p>
            </CardContent>
          </Card>
        </button>
        <button
          type="button"
          className="text-left"
          onClick={() =>
            setStatus(status === "returned" ? "all" : "returned")
          }
        >
          <Card
            className={cn(
              "transition-colors",
              status === "returned" && "ring-2 ring-primary/40"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("saleReturned")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {data?.summary.returnedCount ?? "—"}
              </p>
              {data?.summary.totalRefunded != null &&
                data.summary.returnedCount != null &&
                data.summary.returnedCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("saleRefunded", {
                      amount: formatCurrency(data.summary.totalRefunded),
                    })}
                  </p>
                )}
            </CardContent>
          </Card>
        </button>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("totalRevenue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data ? formatCurrency(data.summary.totalRevenue) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("avgPrice")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data ? formatCurrency(data.summary.avgPrice) : "—"}
            </p>
            {data?.summary.avgPricePerKg != null && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("pricePerKg")}: {formatCurrency(data.summary.avgPricePerKg)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("byBreed")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.byBreed.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSales")}</p>
              ) : (
                data.byBreed.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    className="flex w-full justify-between text-sm border-b pb-2 text-left hover:text-primary"
                    onClick={() =>
                      setBreed(breed === b.name ? "all" : b.name)
                    }
                  >
                    <span>
                      {b.name}{" "}
                      <Badge variant="outline" className="ml-1">
                        {b.count}
                      </Badge>
                    </span>
                    <span className="font-medium">
                      {formatCurrency(b.revenue)}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("byCamp")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.byCamp.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSales")}</p>
              ) : (
                data.byCamp.map((c) => {
                  const campMatch = camps.find((x) => x.name === c.name)?.id;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      className="flex w-full justify-between text-sm border-b pb-2 text-left hover:text-primary"
                      onClick={() => {
                        if (!campMatch) return;
                        setCamp(camp === campMatch ? "all" : campMatch);
                      }}
                    >
                      <span>
                        {c.name}{" "}
                        <Badge variant="outline" className="ml-1">
                          {c.count}
                        </Badge>
                      </span>
                      <span className="font-medium">
                        {formatCurrency(c.revenue)}
                      </span>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("bySex")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data.bySex.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSales")}</p>
              ) : (
                data.bySex.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() =>
                      setSex(sex === s.name ? "all" : s.name)
                    }
                  >
                    <Badge
                      variant={sex === s.name ? "default" : "secondary"}
                      className="cursor-pointer"
                    >
                      {s.name === "FEMALE"
                        ? t("female")
                        : s.name === "MALE"
                          ? t("male")
                          : s.name}
                      : {s.count} · {formatCurrency(s.revenue)}
                    </Badge>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("topBuyers")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.byBuyer.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noBuyersYet")}</p>
              ) : (
                data.byBuyer.map((b) => (
                  <button
                    key={`${b.buyerId || b.name}`}
                    type="button"
                    className="flex w-full justify-between text-sm border-b pb-2 text-left hover:text-primary"
                    onClick={() => {
                      if (!b.buyerId) return;
                      setBuyerId(buyerId === b.buyerId ? "all" : b.buyerId);
                    }}
                  >
                    <span>
                      {b.buyerId ? (
                        <Link
                          href={`/buyers/${b.buyerId}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {b.name}
                        </Link>
                      ) : (
                        b.name
                      )}{" "}
                      <Badge variant="outline" className="ml-1">
                        {b.count}
                      </Badge>
                    </span>
                    <span className="font-medium">
                      {formatCurrency(b.revenue)}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              className="h-11 rounded-xl border-border/80 bg-card pl-9 shadow-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchEartag")}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-11 px-4 rounded-xl border-border/80 bg-card shadow-sm relative",
                advancedCount > 0 && "border-primary/40 text-foreground"
              )}
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1.5" />
              {t("advancedFilters")}
              {advancedCount > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                  {advancedCount}
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4 rounded-xl border-border/80 bg-card shadow-sm"
              onClick={() => setColumnsOpen(true)}
            >
              <Columns3 className="h-4 w-4 mr-1.5" />
              {t("customizeColumns")}
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-xl"
                onClick={clearFilters}
              >
                <X className="h-4 w-4 mr-1" />
                {t("clearFilters")}
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2 className="font-semibold">{t("saleRecords")}</h2>
            {data ? (
              <Badge variant="secondary">
                {data.summary.totalCount ?? data.sales.length}
              </Badge>
            ) : null}
            {data?.summary.returnedCount ? (
              <Badge variant="outline">
                {t("returnedSalesCount", { n: data.summary.returnedCount })}
              </Badge>
            ) : null}
          </div>
        </div>

        {returningSaleId &&
          data?.sales &&
          (() => {
            const s = data.sales.find((row) => row.id === returningSaleId);
            if (!s) return null;
            return (
              <div className="border-b border-border/60 p-4 bg-muted/10">
                <ReturnSaleForm
                  saleId={s.id}
                  eartag={s.animal.eartag}
                  buyer={s.buyer}
                  priceTzs={s.priceTzs}
                  defaultCampId={s.animal.camp.id}
                  camps={camps}
                  onCancel={() => setReturningSaleId(null)}
                  onDone={() => {
                    setReturningSaleId(null);
                    load();
                  }}
                />
              </div>
            );
          })()}

        {!data?.sales?.length ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {t("noSales")}
          </p>
        ) : (
          <>
            <div
              className="hidden xl:grid gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/60 bg-muted/30"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {showCol("saleDate") && <span>{t("saleDate")}</span>}
              {showCol("animal") && <span>{t("animal")}</span>}
              {showCol("camp") && <span>{t("camp")}</span>}
              {showCol("breed") && <span>{t("breed")}</span>}
              {showCol("sex") && <span>{t("sex")}</span>}
              {showCol("buyer") && <span>{t("buyer")}</span>}
              {showCol("price") && (
                <span className="text-right">{t("price")}</span>
              )}
              {showCol("weight") && (
                <span className="text-right">{t("weight")}</span>
              )}
              {showCol("pricePerKg") && (
                <span className="text-right">{t("pricePerKg")}</span>
              )}
              {showCol("transport") && <span>{t("transport")}</span>}
              {showCol("notes") && <span>{t("notes")}</span>}
              {showCol("owner") && <span>{t("owner")}</span>}
              {showCol("status") && <span>{t("status")}</span>}
              {showCol("returnedAt") && <span>{t("returnDate")}</span>}
              {showCol("refund") && (
                <span className="text-right">{t("refundAmount")}</span>
              )}
              {showCol("actions") && canManageSales && <span />}
            </div>
            <ul className="divide-y divide-border/50">
              {data.sales.map((s) => {
                const ppk =
                  s.weightAtSale && s.weightAtSale > 0
                    ? Math.round(s.priceTzs / s.weightAtSale)
                    : null;
                const isReturned = Boolean(s.returnedAt);
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "transition-colors hover:bg-muted/35",
                      isReturned && "bg-muted/20"
                    )}
                  >
                    {/* Mobile / tablet card */}
                    <div className="xl:hidden px-4 py-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/animals/${s.animal.id}`}
                              className="font-semibold text-primary hover:underline"
                            >
                              {s.animal.eartag}
                            </Link>
                            {isReturned ? (
                              <Badge variant="outline">{t("saleReturned")}</Badge>
                            ) : (
                              <Badge variant="secondary">{t("saleActive")}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(s.saleDate)} · {s.animal.breed} ·{" "}
                            {s.animal.sex === "FEMALE"
                              ? t("female")
                              : t("male")}{" "}
                            · {s.animal.camp.name}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">
                            {formatCurrency(s.priceTzs)}
                          </p>
                          {s.weightAtSale != null && (
                            <p className="text-xs text-muted-foreground">
                              {s.weightAtSale} kg
                              {ppk != null
                                ? ` · ${formatCurrency(ppk)}/kg`
                                : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm">
                        {s.buyerId ? (
                          <Link
                            href={`/buyers/${s.buyerId}`}
                            className="text-primary hover:underline"
                          >
                            {s.buyer}
                          </Link>
                        ) : (
                          s.buyer
                        )}
                      </p>
                      {isReturned && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {s.returnedAt && (
                            <p>
                              {t("saleReturnedOn", {
                                date: formatDate(s.returnedAt),
                              })}
                            </p>
                          )}
                          {s.refundedTzs != null && (
                            <p>
                              {t("saleRefunded", {
                                amount: formatCurrency(s.refundedTzs),
                              })}
                            </p>
                          )}
                          {s.returnedReason && <p>{s.returnedReason}</p>}
                          {s.returnedToCamp?.name && (
                            <p>
                              {t("camp")}: {s.returnedToCamp.name}
                            </p>
                          )}
                        </div>
                      )}
                      {canManageSales && !isReturned && showCol("actions") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => setReturningSaleId(s.id)}
                        >
                          {t("returnSale")}
                        </Button>
                      )}
                    </div>

                    {/* Desktop grid */}
                    <div
                      className="hidden xl:grid gap-3 px-4 py-3.5 items-center"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      {showCol("saleDate") && (
                        <p className="text-sm font-medium tabular-nums">
                          {formatDate(s.saleDate)}
                        </p>
                      )}
                      {showCol("animal") && (
                        <div className="min-w-0">
                          <Link
                            href={`/animals/${s.animal.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {s.animal.eartag}
                          </Link>
                        </div>
                      )}
                      {showCol("camp") && (
                        <p className="text-sm truncate">{s.animal.camp.name}</p>
                      )}
                      {showCol("breed") && (
                        <p className="text-sm truncate">{s.animal.breed}</p>
                      )}
                      {showCol("sex") && (
                        <p className="text-sm">
                          {s.animal.sex === "FEMALE"
                            ? t("female")
                            : t("male")}
                        </p>
                      )}
                      {showCol("buyer") && (
                        <div className="min-w-0">
                          {s.buyerId ? (
                            <Link
                              href={`/buyers/${s.buyerId}`}
                              className="text-sm text-primary hover:underline truncate block"
                            >
                              {s.buyer}
                            </Link>
                          ) : (
                            <p className="text-sm truncate">{s.buyer}</p>
                          )}
                          {isReturned && s.returnedReason && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {s.returnedReason}
                            </p>
                          )}
                        </div>
                      )}
                      {showCol("price") && (
                        <p className="text-sm font-medium text-right">
                          {formatCurrency(s.priceTzs)}
                        </p>
                      )}
                      {showCol("weight") && (
                        <p className="text-sm text-right tabular-nums">
                          {s.weightAtSale != null
                            ? `${s.weightAtSale} kg`
                            : "—"}
                        </p>
                      )}
                      {showCol("pricePerKg") && (
                        <p className="text-sm text-right tabular-nums">
                          {ppk != null ? formatCurrency(ppk) : "—"}
                        </p>
                      )}
                      {showCol("transport") && (
                        <p className="text-sm truncate">{s.transport || "—"}</p>
                      )}
                      {showCol("notes") && (
                        <p className="text-sm truncate text-muted-foreground">
                          {s.notes || "—"}
                        </p>
                      )}
                      {showCol("owner") && (
                        <p className="text-sm truncate">
                          {s.animal.owner?.name || "—"}
                        </p>
                      )}
                      {showCol("status") && (
                        <div>
                          {isReturned ? (
                            <Badge variant="outline">{t("saleReturned")}</Badge>
                          ) : (
                            <Badge variant="secondary">{t("saleActive")}</Badge>
                          )}
                        </div>
                      )}
                      {showCol("returnedAt") && (
                        <p className="text-sm tabular-nums">
                          {s.returnedAt ? formatDate(s.returnedAt) : "—"}
                        </p>
                      )}
                      {showCol("refund") && (
                        <p className="text-sm text-right tabular-nums">
                          {isReturned && s.refundedTzs != null
                            ? formatCurrency(s.refundedTzs)
                            : "—"}
                        </p>
                      )}
                      {showCol("actions") && canManageSales && (
                        <div className="text-right">
                          {!isReturned && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              onClick={() => setReturningSaleId(s.id)}
                            >
                              {t("returnSale")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

const DEFAULT_VISIBLE_SAFE: SalesColumnId[] = [
  "saleDate",
  "animal",
  "camp",
  "buyer",
  "price",
  "weight",
  "pricePerKg",
  "status",
  "actions",
];
