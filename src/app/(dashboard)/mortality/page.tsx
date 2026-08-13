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
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, Plus, Settings2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

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

  const initialRange = rangeForMonthPreset("this_month");
  const [monthPreset, setMonthPreset] = useState<MonthPreset>("this_month");
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

  function applyMonthPreset(preset: MonthPreset) {
    setMonthPreset(preset);
    const range = rangeForMonthPreset(preset);
    setFrom(range.from);
    setTo(range.to);
  }

  function clearFilters() {
    applyMonthPreset("this_month");
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("filters")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("mortalityFiltersHelp")}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t("monthPreset")}
              </label>
              <Select
                value={monthPreset}
                onValueChange={(v) => applyMonthPreset(v as MonthPreset)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">{t("thisMonth")}</SelectItem>
                  <SelectItem value="last_month">{t("lastMonth")}</SelectItem>
                  <SelectItem value="last_3_months">{t("last3Months")}</SelectItem>
                  <SelectItem value="this_year">{t("thisYear")}</SelectItem>
                  <SelectItem value="all_time">{t("allTime")}</SelectItem>
                  <SelectItem value="custom">{t("customRange")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t("dateFrom")}
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setMonthPreset("custom");
                  setFrom(e.target.value);
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t("dateTo")}
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setMonthPreset("custom");
                  setTo(e.target.value);
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {t("searchEartag")}
              </label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchEartag")}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={camp} onValueChange={setCamp}>
              <SelectTrigger>
                <SelectValue placeholder={t("camp")} />
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
            <Select value={breed} onValueChange={setBreed}>
              <SelectTrigger>
                <SelectValue placeholder={t("breed")} />
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
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger>
                <SelectValue placeholder={t("sex")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allSexes")}</SelectItem>
                <SelectItem value="FEMALE">{t("female")}</SelectItem>
                <SelectItem value="MALE">{t("male")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue placeholder={t("mortalityKind")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allKinds")}</SelectItem>
                <SelectItem value="death">{t("recordKindDeath")}</SelectItem>
                <SelectItem value="slaughter">
                  {t("recordKindSlaughter")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={cause} onValueChange={setCause}>
              <SelectTrigger>
                <SelectValue placeholder={t("cause")} />
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
            <Select value={disposal} onValueChange={setDisposal}>
              <SelectTrigger>
                <SelectValue placeholder={t("disposal")} />
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
            <Select value={insurance} onValueChange={setInsurance}>
              <SelectTrigger>
                <SelectValue placeholder={t("insuranceFilter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("insuranceAll")}</SelectItem>
                <SelectItem value="yes">{t("insuranceYes")}</SelectItem>
                <SelectItem value="no">{t("insuranceNo")}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 items-end">
              <Button onClick={load} disabled={loading}>
                {loading ? t("loading") : t("applyFilters")}
              </Button>
              <Button type="button" variant="ghost" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground -mt-2">
        {t("clickSummaryToFilter")}
      </p>
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

      <Card>
        <CardHeader>
          <CardTitle>
            {t("mortalityRecords")}
            {data ? (
              <Badge variant="secondary" className="ml-2">
                {data.total}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.records?.length ? (
            <p className="text-sm text-muted-foreground">{t("noMortality")}</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("date")}</th>
                    <th className="p-3 text-left">{t("animal")}</th>
                    <th className="p-3 text-left">{t("camp")}</th>
                    <th className="p-3 text-left">{t("mortalityKind")}</th>
                    <th className="p-3 text-left">{t("cause")}</th>
                    <th className="p-3 text-left">{t("disposal")}</th>
                    <th className="p-3 text-left">{t("insuranceClaim")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-3">{formatDate(r.date)}</td>
                      <td className="p-3">
                        <Link
                          href={`/animals/${r.animal.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {r.animal.eartag}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.animal.breed} · {r.animal.sex}
                        </p>
                      </td>
                      <td className="p-3">{r.animal.camp.name}</td>
                      <td className="p-3">
                        <Badge variant={r.isCulling ? "warning" : "secondary"}>
                          {r.isCulling
                            ? t("recordKindSlaughter")
                            : t("recordKindDeath")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {causeGroupLabel(
                          r.cause === "OTHER" && r.causeDetail
                            ? r.causeDetail
                            : r.cause,
                          t
                        )}
                      </td>
                      <td className="p-3">
                        {disposalLabel(r.disposalMethod, r.disposalNotes, t)}
                      </td>
                      <td className="p-3 space-x-1">
                        {r.insuranceClaim && (
                          <>
                            <Badge variant="outline">{t("insuranceClaim")}</Badge>
                            {r.claimAmountTzs != null && (
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(r.claimAmountTzs)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
