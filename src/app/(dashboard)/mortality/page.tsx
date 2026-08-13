"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Download, Plus, Search, Settings2, SlidersHorizontal, X } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import {
  deathCauseKey,
  disposalMethodKey,
  SELECTABLE_DISPOSAL_METHODS,
  SYSTEM_DEATH_CAUSES,
} from "@/lib/death-causes";
import type { TranslationKey } from "@/lib/i18n/translations";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import {
  rangeForMonthPreset,
  type MonthPreset,
} from "@/lib/reports/date-range";
import { Label } from "@/components/ui/label";

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

interface MortalityReport {
  total: number;
  deaths: number;
  cullings: number;
  insuranceClaims: number;
  byCause: Record<string, number>;
  byCauseList?: { name: string; count: number }[];
  byCamp?: { name: string; count: number }[];
  byBreed?: { name: string; count: number }[];
  byDisposal?: { name: string; count: number }[];
  bySex?: { name: string; count: number }[];
  records: {
    id: string;
    date: string;
    cause: string;
    causeDetail: string | null;
    disposalMethod: string;
    disposalNotes: string | null;
    isCulling: boolean;
    insuranceClaim: boolean;
    claimAmountTzs: number | null;
    animal: {
      id: string;
      eartag: string;
      breed: string;
      sex: string;
      camp: { id?: string; name: string };
    };
    recordedBy: { name: string };
  }[];
}

function causeGroupLabel(
  key: string,
  t: (key: TranslationKey) => string
): string {
  if ((SYSTEM_DEATH_CAUSES as readonly string[]).includes(key)) {
    return t(deathCauseKey(key));
  }
  return key;
}

function disposalLabel(
  method: string,
  notes: string | null,
  t: (key: TranslationKey) => string
): string {
  if (method === "OTHER" && notes?.trim()) return notes.trim();
  if (method === "HOME_USE" || method === "CAMP_USE") {
    return t(disposalMethodKey("USED_FOR_FOOD"));
  }
  return t(disposalMethodKey(method));
}

function disposalGroupLabel(
  key: string,
  t: (key: TranslationKey) => string
): string {
  if (
    (SELECTABLE_DISPOSAL_METHODS as readonly string[]).includes(key) ||
    key === "HOME_USE" ||
    key === "CAMP_USE"
  ) {
    return t(disposalMethodKey(key === "HOME_USE" || key === "CAMP_USE" ? "USED_FOR_FOOD" : key));
  }
  return key;
}

export default function MortalityPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManageMortality = role
    ? hasPermission(role, "manageMortality")
    : false;

  const initialRange = rangeForMonthPreset("all_time");
  const [monthPreset, setMonthPreset] = useState<MonthPreset>("all_time");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [camp, setCamp] = useState("all");
  const [breed, setBreed] = useState("all");
  const [sex, setSex] = useState("all");
  const [kind, setKind] = useState("all");
  const [cause, setCause] = useState("all");
  const [disposal, setDisposal] = useState("all");
  const [insurance, setInsurance] = useState("all");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [breedOptions, setBreedOptions] = useState<string[]>([]);
  const [customCauses, setCustomCauses] = useState<string[]>([]);
  const [customDisposals, setCustomDisposals] = useState<string[]>([]);

  const [data, setData] = useState<MortalityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list = Array.isArray(d) ? d : d.camps || [];
        setCamps(list);
      })
      .catch(() => {});
    fetch("/api/breeds")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list = Array.isArray(d) ? d : d.breeds || [];
        setBreedOptions(
          list
            .map((b: { name?: string } | string) =>
              typeof b === "string" ? b : b.name || ""
            )
            .filter(Boolean)
        );
      })
      .catch(() => {});
    fetch("/api/mortality/causes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.custom && Array.isArray(d.custom)) setCustomCauses(d.custom);
      })
      .catch(() => {});
    fetch("/api/mortality/disposals")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.custom && Array.isArray(d.custom)) setCustomDisposals(d.custom);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (camp !== "all") params.set("camp", camp);
    if (breed !== "all") params.set("breed", breed);
    if (sex !== "all") params.set("sex", sex);
    if (kind !== "all") params.set("kind", kind);
    if (cause !== "all") params.set("cause", cause);
    if (disposal !== "all") params.set("disposal", disposal);
    if (insurance !== "all") params.set("insurance", insurance);
    if (q.trim()) params.set("q", q.trim());

    fetch(`/api/reports/mortality?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to, camp, breed, sex, kind, cause, disposal, insurance, q]);

  useEffect(() => {
    load();
  }, [load]);

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
    setKind("all");
    setCause("all");
    setDisposal("all");
    setInsurance("all");
    setQ("");
  }

  function exportCsv() {
    if (!data?.records?.length) return;
    const headers = [
      "date",
      "eartag",
      "breed",
      "sex",
      "camp",
      "kind",
      "cause",
      "disposal",
      "insuranceClaim",
      "claimAmountTzs",
      "recordedBy",
    ];
    const rows = data.records.map((r) => {
      const causeName =
        r.cause === "OTHER" && r.causeDetail ? r.causeDetail : r.cause;
      const disposalName =
        r.disposalMethod === "OTHER" && r.disposalNotes
          ? r.disposalNotes
          : r.disposalMethod;
      return [
        r.date.slice(0, 10),
        r.animal.eartag,
        r.animal.breed,
        r.animal.sex,
        `"${r.animal.camp.name.replace(/"/g, '""')}"`,
        r.isCulling ? "slaughter" : "death",
        `"${String(causeName).replace(/"/g, '""')}"`,
        `"${String(disposalName).replace(/"/g, '""')}"`,
        r.insuranceClaim ? "yes" : "no",
        r.claimAmountTzs ?? "",
        `"${(r.recordedBy?.name || "").replace(/"/g, '""')}"`,
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `death-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const causeList =
    data?.byCauseList ||
    Object.entries(data?.byCause || {}).map(([name, count]) => ({
      name,
      count,
    }));

  const advancedCount = [
    monthPreset !== "all_time",
    kind !== "all",
    cause !== "all",
    disposal !== "all",
    insurance !== "all",
    camp !== "all",
    breed !== "all",
    sex !== "all",
  ].filter(Boolean).length;

  const hasActiveFilters = advancedCount > 0 || Boolean(q.trim());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("mortalityTitle")}</h1>
          <p className="text-muted-foreground">{t("mortalitySubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageMortality && (
            <>
              <Button asChild variant="outline">
                <Link href="/mortality/setup">
                  <Settings2 className="h-4 w-4 mr-2" />
                  {t("manageMortalitySetup")}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/mortality/bulk">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("newDeath")}
                </Link>
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!data?.records?.length}
          >
            <Download className="h-4 w-4 mr-2" />
            {t("exportCsv")}
          </Button>
        </div>
      </div>

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
        <p className="text-xs text-muted-foreground">
          {t("clickSummaryToFilter")}
        </p>
      </div>

      {/* Right filter drawer */}
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
          aria-labelledby="mortality-filter-title"
          className={cn(
            "absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-2xl border-l transition-transform duration-300 ease-out",
            filtersOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2
                id="mortality-filter-title"
                className="text-lg font-semibold tracking-tight"
              >
                {t("advancedFilters")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("mortalityFilterDrawerHelp")}
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
                {t("mortalityKind")}
              </Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allKinds")}</SelectItem>
                  <SelectItem value="death">{t("recordKindDeath")}</SelectItem>
                  <SelectItem value="slaughter">
                    {t("recordKindSlaughter")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("cause")}
              </Label>
              <Select value={cause} onValueChange={setCause}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCauses")}</SelectItem>
                  {SYSTEM_DEATH_CAUSES.filter((c) => c !== "OTHER").map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(deathCauseKey(c))}
                    </SelectItem>
                  ))}
                  {customCauses.map((c) => (
                    <SelectItem key={`custom:${c}`} value={`custom:${c}`}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("disposal")}
              </Label>
              <Select value={disposal} onValueChange={setDisposal}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allDisposals")}</SelectItem>
                  {SELECTABLE_DISPOSAL_METHODS.filter((d) => d !== "OTHER").map(
                    (d) => (
                      <SelectItem key={d} value={d}>
                        {t(disposalMethodKey(d))}
                      </SelectItem>
                    )
                  )}
                  {customDisposals.map((d) => (
                    <SelectItem key={`custom:${d}`} value={`custom:${d}`}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-2.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("insuranceFilter")}
              </Label>
              <Select value={insurance} onValueChange={setInsurance}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("insuranceAll")}</SelectItem>
                  <SelectItem value="yes">{t("insuranceYes")}</SelectItem>
                  <SelectItem value="no">{t("insuranceNo")}</SelectItem>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setKind("all")}
          className="text-left"
        >
          <Card
            className={cn(
              "transition-colors",
              kind === "all" && "ring-2 ring-primary/40"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("mortalityTotal")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.total ?? "—"}</p>
            </CardContent>
          </Card>
        </button>
        <button
          type="button"
          onClick={() => setKind(kind === "death" ? "all" : "death")}
          className="text-left"
        >
          <Card
            className={cn(
              "transition-colors",
              kind === "death" && "ring-2 ring-primary/40"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("mortalityDeaths")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.deaths ?? "—"}</p>
            </CardContent>
          </Card>
        </button>
        <button
          type="button"
          onClick={() =>
            setKind(kind === "slaughter" ? "all" : "slaughter")
          }
          className="text-left"
        >
          <Card
            className={cn(
              "transition-colors",
              kind === "slaughter" && "ring-2 ring-primary/40"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {t("mortalitySlaughters")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data?.cullings ?? "—"}</p>
            </CardContent>
          </Card>
        </button>
        <button
          type="button"
          onClick={() =>
            setInsurance(insurance === "yes" ? "all" : "yes")
          }
          className="text-left"
        >
          <Card
            className={cn(
              "transition-colors",
              insurance === "yes" && "ring-2 ring-primary/40"
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("insuranceClaim")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {data?.insuranceClaims ?? "—"}
              </p>
            </CardContent>
          </Card>
        </button>
      </div>

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("byCause")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {causeList.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noMortality")}</p>
              ) : (
                causeList.map((row) => (
                  <button
                    key={row.name}
                    type="button"
                    className="flex w-full justify-between text-sm border-b pb-2 text-left hover:text-primary"
                    onClick={() => {
                      const next = (SYSTEM_DEATH_CAUSES as readonly string[]).includes(
                        row.name
                      )
                        ? row.name
                        : `custom:${row.name}`;
                      setCause(cause === next ? "all" : next);
                    }}
                  >
                    <span>{causeGroupLabel(row.name, t)}</span>
                    <Badge variant="outline">{row.count}</Badge>
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
              {(data.byCamp || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noMortality")}</p>
              ) : (
                (data.byCamp || []).map((row) => {
                  const campId =
                    camps.find((c) => c.name === row.name)?.id || null;
                  return (
                    <button
                      key={row.name}
                      type="button"
                      className="flex w-full justify-between text-sm border-b pb-2 text-left hover:text-primary"
                      onClick={() => {
                        if (!campId) return;
                        setCamp(camp === campId ? "all" : campId);
                      }}
                    >
                      <span>{row.name}</span>
                      <Badge variant="outline">{row.count}</Badge>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("byBreed")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data.byBreed || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noMortality")}</p>
              ) : (
                (data.byBreed || []).map((row) => (
                  <button
                    key={row.name}
                    type="button"
                    className="flex w-full justify-between text-sm border-b pb-2 text-left hover:text-primary"
                    onClick={() =>
                      setBreed(breed === row.name ? "all" : row.name)
                    }
                  >
                    <span>{row.name}</span>
                    <Badge variant="outline">{row.count}</Badge>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("byDisposal")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data.byDisposal || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noMortality")}</p>
              ) : (
                (data.byDisposal || []).map((row) => {
                  const next = (
                    SELECTABLE_DISPOSAL_METHODS as readonly string[]
                  ).includes(row.name)
                    ? row.name
                    : `custom:${row.name}`;
                  return (
                    <button
                      key={row.name}
                      type="button"
                      className="flex w-full justify-between text-sm border-b pb-2 text-left hover:text-primary"
                      onClick={() =>
                        setDisposal(disposal === next ? "all" : next)
                      }
                    >
                      <span>{disposalGroupLabel(row.name, t)}</span>
                      <Badge variant="outline">{row.count}</Badge>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold truncate">{t("mortalityRecords")}</h2>
            {data ? (
              <Badge variant="secondary" className="shrink-0">
                {data.total}
              </Badge>
            ) : null}
          </div>
        </div>

        {!data?.records?.length ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {t("noMortality")}
          </p>
        ) : (
          <>
            <div className="hidden lg:grid grid-cols-[7rem_minmax(0,1.2fr)_minmax(0,1fr)_6.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/60 bg-muted/30">
              <span>{t("date")}</span>
              <span>{t("animal")}</span>
              <span>{t("camp")}</span>
              <span>{t("mortalityKind")}</span>
              <span>{t("cause")}</span>
              <span>{t("disposal")}</span>
              <span>{t("insuranceClaim")}</span>
            </div>
            <ul className="divide-y divide-border/50">
              {data.records.map((r) => {
                const causeName = causeGroupLabel(
                  r.cause === "OTHER" && r.causeDetail
                    ? r.causeDetail
                    : r.cause,
                  t
                );
                const disposalName = disposalLabel(
                  r.disposalMethod,
                  r.disposalNotes,
                  t
                );
                return (
                  <li key={r.id}>
                    <div className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-muted/35 lg:grid-cols-[7rem_minmax(0,1.2fr)_minmax(0,1fr)_6.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums">
                          {formatDate(r.date)}
                        </p>
                        {r.recordedBy?.name ? (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {r.recordedBy.name}
                          </p>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <Link
                          href={`/animals/${r.animal.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {r.animal.eartag}
                        </Link>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.animal.breed} ·{" "}
                          {r.animal.sex === "FEMALE"
                            ? t("female")
                            : t("male")}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm truncate">{r.animal.camp.name}</p>
                      </div>

                      <div>
                        <Badge
                          variant={r.isCulling ? "warning" : "secondary"}
                          className="font-medium"
                        >
                          {r.isCulling
                            ? t("recordKindSlaughter")
                            : t("recordKindDeath")}
                        </Badge>
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm truncate">{causeName}</p>
                        <p className="lg:hidden text-xs text-muted-foreground mt-1 truncate">
                          {disposalName}
                          {r.insuranceClaim
                            ? ` · ${t("insuranceClaim")}`
                            : ""}
                        </p>
                      </div>

                      <div className="hidden lg:block min-w-0">
                        <p className="text-sm truncate">{disposalName}</p>
                      </div>

                      <div className="hidden lg:block min-w-0">
                        {r.insuranceClaim ? (
                          <div className="space-y-0.5">
                            <Badge variant="outline">
                              {t("insuranceClaim")}
                            </Badge>
                            {r.claimAmountTzs != null && (
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(r.claimAmountTzs)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
