"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  expandPeriodRange,
  periodLabel,
  periodRangeLabel,
  resolvePresetRange,
  type BillingPeriodPreset,
} from "@/lib/services/billing-service";
import { hasPermission } from "@/lib/auth/rbac";
import { roleLabel, type TranslationKey } from "@/lib/i18n/translations";
import { useLocale, useT } from "@/components/providers/locale-provider";
import type { Role } from "@prisma/client";
import { Download, Printer, Settings } from "lucide-react";

interface OwnerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  grazingFeeExempt: boolean;
  animalCount: number;
  monthlyEstimate: number;
  outstandingTzs: number;
}

interface InvoiceRow {
  id: string;
  periodYear: number;
  periodMonth: number;
  animalCount: number;
  rateTzs: number;
  amountTzs: number;
  amountPaidTzs: number;
  status: string;
  notes: string | null;
  owner: { id: string; name: string; phone: string | null; role: Role };
}

function statusKey(status: string): TranslationKey {
  switch (status) {
    case "PARTIAL":
      return "statusPartial";
    case "PAID":
      return "statusPaid";
    case "VOID":
      return "statusVoid";
    default:
      return "statusIssued";
  }
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const PRESETS: BillingPeriodPreset[] = [
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "last_3_months",
  "last_6_months",
  "last_12_months",
  "custom",
];

function presetLabelKey(preset: BillingPeriodPreset): TranslationKey {
  switch (preset) {
    case "this_month":
      return "periodThisMonth";
    case "last_month":
      return "periodLastMonth";
    case "this_year":
      return "periodThisYear";
    case "last_year":
      return "periodLastYear";
    case "last_3_months":
      return "periodLast3Months";
    case "last_6_months":
      return "periodLast6Months";
    case "last_12_months":
      return "periodLast12Months";
    default:
      return "periodCustom";
  }
}

function MonthYearPickers({
  month,
  year,
  onMonth,
  onYear,
  label,
  locale,
}: {
  month: number;
  year: number;
  onMonth: (m: number) => void;
  onYear: (y: number) => void;
  label: string;
  locale: string;
}) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select value={String(month)} onValueChange={(v) => onMonth(parseInt(v, 10))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {periodLabel(year, m, locale).split(" ")[0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          className="w-24"
          value={year}
          onChange={(e) => onYear(parseInt(e.target.value, 10) || year)}
        />
      </div>
    </div>
  );
}

export default function OwnersBillingPage() {
  const t = useT();
  const { locale } = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageFinance") : false;

  const now = new Date();
  const [ranchName, setRanchName] = useState("Ranch");
  const [rateTzs, setRateTzs] = useState(0);
  const [rateDraft, setRateDraft] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [totals, setTotals] = useState({
    owners: 0,
    animals: 0,
    monthlyEstimate: 0,
    outstandingTzs: 0,
  });
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [preset, setPreset] = useState<BillingPeriodPreset>("this_month");
  const [fromMonth, setFromMonth] = useState(now.getMonth() + 1);
  const [fromYear, setFromYear] = useState(now.getFullYear());
  const [toMonth, setToMonth] = useState(now.getMonth() + 1);
  const [toYear, setToYear] = useState(now.getFullYear());
  const [filterOwnerId, setFilterOwnerId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [paying, setPaying] = useState(false);

  const activeRange = useMemo(() => {
    return resolvePresetRange(preset, new Date(), {
      from: { year: fromYear, month: fromMonth },
      to: { year: toYear, month: toMonth },
    });
  }, [preset, fromYear, fromMonth, toYear, toMonth]);

  const monthCount = activeRange
    ? expandPeriodRange(activeRange.from, activeRange.to).length
    : 0;

  const load = useCallback(async () => {
    setLoading(true);
    const range = resolvePresetRange(preset, new Date(), {
      from: { year: fromYear, month: fromMonth },
      to: { year: toYear, month: toMonth },
    });

    const invParams = new URLSearchParams();
    if (range) {
      invParams.set("fromYear", String(range.from.year));
      invParams.set("fromMonth", String(range.from.month));
      invParams.set("toYear", String(range.to.year));
      invParams.set("toMonth", String(range.to.month));
    }
    if (filterOwnerId !== "all") invParams.set("owner", filterOwnerId);

    const [summaryRes, invRes] = await Promise.all([
      fetch("/api/owners/billing"),
      fetch(`/api/owners/billing/invoices?${invParams}`),
    ]);
    if (summaryRes.ok) {
      const data = await summaryRes.json();
      const rate = data.rateTzs || 0;
      setRanchName(data.ranchName || "Ranch");
      setRateTzs(rate);
      setRateDraft(rate > 0 ? String(rate) : "");
      setOwners(data.owners || []);
      setTotals(data.totals || totals);
    }
    if (invRes.ok) {
      setInvoices(await invRes.json());
    }
    setLoading(false);
  }, [preset, fromYear, fromMonth, toYear, toMonth, filterOwnerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveRate() {
    if (!canManage) return;
    setSavingRate(true);
    setMessage("");
    const res = await fetch("/api/ranch/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grazingFeePerAnimalTzs: rateDraft === "" ? 0 : rateDraft,
      }),
    });
    setSavingRate(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || t("failedToSave"));
      return;
    }
    const data = await res.json();
    const rate = data.grazingFeePerAnimalTzs ?? 0;
    setRateTzs(rate);
    setRateDraft(rate > 0 ? String(rate) : "");
    setMessage(t("saved"));
    load();
  }

  async function generate() {
    if (rateTzs <= 0) {
      setMessage(t("setFeeInSettings"));
      return;
    }
    if (!activeRange || monthCount === 0) {
      setMessage(t("failedToSave"));
      return;
    }
    const label = periodRangeLabel(activeRange.from, activeRange.to, locale);
    if (
      !confirm(
        `${t("generateInvoices")} — ${label} (${t("invoicesMonths", { n: monthCount })})?`
      )
    ) {
      return;
    }
    setGenerating(true);
    setMessage("");
    const res = await fetch("/api/owners/billing/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset,
        fromYear: activeRange.from.year,
        fromMonth: activeRange.from.month,
        toYear: activeRange.to.year,
        toMonth: activeRange.to.month,
      }),
    });
    setGenerating(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || t("failedToSave"));
      return;
    }
    const data = await res.json();
    setMessage(
      `${t("invoicesGenerated", { n: data.created.length })} · ${t("invoicesSkipped", { n: data.skipped.length })} · ${t("invoicesMonths", { n: data.months })}`
    );
    load();
  }

  async function toggleExempt(owner: OwnerRow) {
    if (!canManage) return;
    const res = await fetch(`/api/owners/${owner.id}/billing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grazingFeeExempt: !owner.grazingFeeExempt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    load();
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payInvoiceId) return;
    setPaying(true);
    const res = await fetch(
      `/api/owners/billing/invoices/${payInvoiceId}/payments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountTzs: payAmount,
          method: payMethod,
        }),
      }
    );
    setPaying(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    setPayInvoiceId(null);
    setPayAmount("");
    load();
  }

  async function voidInvoice(id: string) {
    if (!confirm(t("voidInvoice") + "?")) return;
    const res = await fetch(`/api/owners/billing/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VOID" }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    load();
  }

  function exportInvoicesCsv() {
    if (!invoices.length) return;
    const headers = [
      "owner",
      "phone",
      "period",
      "year",
      "month",
      "animals",
      "rateTzs",
      "billedTzs",
      "paidTzs",
      "balanceTzs",
      "status",
    ];
    const rows = invoices.map((inv) => {
      const balance = Math.max(0, inv.amountTzs - inv.amountPaidTzs);
      return [
        csvEscape(inv.owner.name),
        csvEscape(inv.owner.phone || ""),
        csvEscape(periodLabel(inv.periodYear, inv.periodMonth, locale)),
        inv.periodYear,
        inv.periodMonth,
        inv.animalCount,
        inv.rateTzs,
        inv.amountTzs,
        inv.amountPaidTzs,
        balance,
        inv.status,
      ].join(",");
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(
      `grazing-invoices-${stamp}.csv`,
      [headers.join(","), ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  function exportSummaryCsv() {
    if (!invoices.length) return;
    const byOwner = new Map<
      string,
      {
        name: string;
        phone: string;
        billed: number;
        paid: number;
        balance: number;
        count: number;
      }
    >();
    for (const inv of invoices) {
      if (inv.status === "VOID") continue;
      const bal = Math.max(0, inv.amountTzs - inv.amountPaidTzs);
      const cur = byOwner.get(inv.owner.id) || {
        name: inv.owner.name,
        phone: inv.owner.phone || "",
        billed: 0,
        paid: 0,
        balance: 0,
        count: 0,
      };
      cur.billed += inv.amountTzs;
      cur.paid += inv.amountPaidTzs;
      cur.balance += bal;
      cur.count += 1;
      byOwner.set(inv.owner.id, cur);
    }
    const headers = [
      "owner",
      "phone",
      "invoices",
      "billedTzs",
      "paidTzs",
      "balanceTzs",
    ];
    const rows = [...byOwner.values()].map((o) =>
      [
        csvEscape(o.name),
        csvEscape(o.phone),
        o.count,
        Math.round(o.billed),
        Math.round(o.paid),
        Math.round(o.balance),
      ].join(",")
    );
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(
      `grazing-summary-${stamp}.csv`,
      [headers.join(","), ...rows].join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  function openPrintWindow(list: InvoiceRow[]) {
    if (!list.length) return;

    const rangeText = activeRange
      ? periodRangeLabel(activeRange.from, activeRange.to, locale)
      : "";

    const byOwner = new Map<string, InvoiceRow[]>();
    for (const inv of list) {
      const arr = byOwner.get(inv.owner.id) || [];
      arr.push(inv);
      byOwner.set(inv.owner.id, arr);
    }

    const sections = [...byOwner.entries()]
      .map(([, invs]) => {
        const owner = invs[0].owner;
        const billed = invs
          .filter((i) => i.status !== "VOID")
          .reduce((s, i) => s + i.amountTzs, 0);
        const paid = invs
          .filter((i) => i.status !== "VOID")
          .reduce((s, i) => s + i.amountPaidTzs, 0);
        const balance = Math.max(0, billed - paid);
        const rows = invs
          .map((inv) => {
            const bal = Math.max(0, inv.amountTzs - inv.amountPaidTzs);
            return `<tr>
              <td>${periodLabel(inv.periodYear, inv.periodMonth, locale)}</td>
              <td style="text-align:right">${inv.animalCount}</td>
              <td style="text-align:right">${formatCurrency(inv.rateTzs)}</td>
              <td style="text-align:right">${formatCurrency(inv.amountTzs)}</td>
              <td style="text-align:right">${formatCurrency(inv.amountPaidTzs)}</td>
              <td style="text-align:right">${formatCurrency(bal)}</td>
              <td>${t(statusKey(inv.status))}</td>
            </tr>`;
          })
          .join("");
        return `
          <section class="owner">
            <h2>${owner.name}</h2>
            <p class="meta">${owner.phone || ""}${owner.phone ? " · " : ""}${roleLabel(locale, owner.role)}</p>
            <table>
              <thead>
                <tr>
                  <th>${t("period")}</th>
                  <th>${t("headcount")}</th>
                  <th>${t("rate")}</th>
                  <th>${t("billed")}</th>
                  <th>${t("paid")}</th>
                  <th>${t("balanceDue")}</th>
                  <th>${t("invoiceStatus")}</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p class="totals">
              <strong>${t("billed")}:</strong> ${formatCurrency(billed)} ·
              <strong>${t("paid")}:</strong> ${formatCurrency(paid)} ·
              <strong>${t("balanceDue")}:</strong> ${formatCurrency(balance)}
            </p>
          </section>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${t("invoiceStatement")}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 4px; page-break-after: avoid; }
  .sub { color: #555; margin: 0 0 24px; font-size: 13px; }
  .meta { color: #555; margin: 0 0 12px; font-size: 12px; }
  .owner { margin-bottom: 32px; page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; }
  th { font-weight: 600; border-bottom: 2px solid #333; }
  .totals { margin-top: 10px; font-size: 13px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <h1>${ranchName}</h1>
  <p class="sub">${t("invoiceStatement")}${rangeText ? ` · ${rangeText}` : ""} · ${formatDate(new Date())}</p>
  ${sections}
  <script>window.onload = () => { window.print(); };</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Allow pop-ups to print invoices");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  function printInvoices(ownerId?: string) {
    const list = ownerId
      ? invoices.filter((i) => i.owner.id === ownerId)
      : invoices;
    openPrintWindow(list);
  }

  async function printOwnerFromList(ownerId: string) {
    setFilterOwnerId(ownerId);
    if (!activeRange) return;
    const params = new URLSearchParams({
      fromYear: String(activeRange.from.year),
      fromMonth: String(activeRange.from.month),
      toYear: String(activeRange.to.year),
      toMonth: String(activeRange.to.month),
      owner: ownerId,
    });
    const res = await fetch(`/api/owners/billing/invoices?${params}`);
    if (!res.ok) return;
    const list: InvoiceRow[] = await res.json();
    if (!list.length) {
      alert(t("noInvoices"));
      return;
    }
    openPrintWindow(list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("ownersBillingTitle")}</h1>
          <p className="text-muted-foreground">{t("ownersBillingSubtitle")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings/ranch">
            <Settings className="h-4 w-4 mr-2" />
            {t("openRanchSettings")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("grazingFeeRate")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {canManage ? (
              <>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={rateDraft}
                  onChange={(e) => {
                    setRateDraft(e.target.value);
                    setMessage("");
                  }}
                  placeholder="e.g. 5000"
                />
                <Button size="sm" onClick={saveRate} disabled={savingRate}>
                  {savingRate ? t("saving") : t("save")}
                </Button>
              </>
            ) : (
              <p className="text-2xl font-bold">
                {rateTzs > 0 ? formatCurrency(rateTzs) : "—"}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("headcount")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.animals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("monthlyEstimate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totals.monthlyEstimate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("outstanding")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totals.outstandingTzs)}
            </p>
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>{t("generateInvoices")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rateTzs <= 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {t("setFeeInSettings")}{" "}
                <Link
                  href="/settings/ranch"
                  className="underline text-primary"
                >
                  {t("openRanchSettings")}
                </Link>
              </p>
            )}
            <div className="space-y-2 max-w-sm">
              <Label>{t("periodPreset")}</Label>
              <Select
                value={preset}
                onValueChange={(v) => setPreset(v as BillingPeriodPreset)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(presetLabelKey(p))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeRange && (
                <p className="text-sm text-muted-foreground">
                  {periodRangeLabel(activeRange.from, activeRange.to, locale)}{" "}
                  · {t("invoicesMonths", { n: monthCount })}
                </p>
              )}
            </div>
            {preset === "custom" && (
              <div className="flex flex-wrap gap-4">
                <MonthYearPickers
                  label={t("periodFrom")}
                  month={fromMonth}
                  year={fromYear}
                  onMonth={setFromMonth}
                  onYear={setFromYear}
                  locale={locale}
                />
                <MonthYearPickers
                  label={t("periodTo")}
                  month={toMonth}
                  year={toYear}
                  onMonth={setToMonth}
                  onYear={setToYear}
                  locale={locale}
                />
              </div>
            )}
            <Button
              onClick={generate}
              disabled={generating || rateTzs <= 0 || monthCount === 0}
            >
              {generating ? t("generating") : t("generateInvoices")}
            </Button>
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("billableOwners")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noOwnersBilling")}
            </p>
          ) : (
            <div className="space-y-3">
              {owners.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3"
                >
                  <div>
                    <p className="font-medium">
                      {o.name}{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        · {roleLabel(locale, o.role)}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {o.animalCount} {t("headcount").toLowerCase()}
                      {o.phone ? ` · ${o.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {o.grazingFeeExempt ? (
                      <Badge variant="secondary">{t("exempt")}</Badge>
                    ) : (
                      <span className="text-sm font-medium">
                        {formatCurrency(o.monthlyEstimate)}
                      </span>
                    )}
                    {o.outstandingTzs > 0 && (
                      <Badge variant="warning">
                        {t("outstanding")}: {formatCurrency(o.outstandingTzs)}
                      </Badge>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleExempt(o)}
                      >
                        {o.grazingFeeExempt
                          ? t("markBillable")
                          : t("markExempt")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => printOwnerFromList(o.id)}
                    >
                      <Printer className="h-4 w-4 mr-1" />
                      {t("printOwnerStatement")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle>{t("invoices")}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!invoices.length}
                onClick={exportInvoicesCsv}
              >
                <Download className="h-4 w-4 mr-1" />
                {t("downloadCsv")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!invoices.length}
                onClick={exportSummaryCsv}
              >
                <Download className="h-4 w-4 mr-1" />
                {t("downloadSummaryCsv")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!invoices.length}
                onClick={() => printInvoices()}
              >
                <Printer className="h-4 w-4 mr-1" />
                {t("printAllInvoices")}
              </Button>
              {filterOwnerId !== "all" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!invoices.length}
                  onClick={() => printInvoices(filterOwnerId)}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  {t("printOwnerStatement")}
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            {!canManage && (
              <div className="space-y-2 max-w-xs">
                <Label>{t("periodPreset")}</Label>
                <Select
                  value={preset}
                  onValueChange={(v) => setPreset(v as BillingPeriodPreset)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(presetLabelKey(p))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {preset === "custom" && !canManage && (
              <>
                <MonthYearPickers
                  label={t("periodFrom")}
                  month={fromMonth}
                  year={fromYear}
                  onMonth={setFromMonth}
                  onYear={setFromYear}
                  locale={locale}
                />
                <MonthYearPickers
                  label={t("periodTo")}
                  month={toMonth}
                  year={toYear}
                  onMonth={setToMonth}
                  onYear={setToYear}
                  locale={locale}
                />
              </>
            )}
            <div className="space-y-2 min-w-[12rem]">
              <Label>{t("filterOwner")}</Label>
              <Select value={filterOwnerId} onValueChange={setFilterOwnerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterAllOwners")}</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noInvoices")}</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => {
                const balance = Math.max(
                  0,
                  inv.amountTzs - inv.amountPaidTzs
                );
                return (
                  <div
                    key={inv.id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{inv.owner.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {periodLabel(
                            inv.periodYear,
                            inv.periodMonth,
                            locale
                          )}{" "}
                          · {inv.animalCount} × {formatCurrency(inv.rateTzs)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            inv.status === "PAID"
                              ? "success"
                              : inv.status === "VOID"
                                ? "secondary"
                                : "warning"
                          }
                        >
                          {t(statusKey(inv.status))}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => printInvoices(inv.owner.id)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">{t("billed")}</p>
                        <p className="font-medium">
                          {formatCurrency(inv.amountTzs)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("paid")}</p>
                        <p className="font-medium">
                          {formatCurrency(inv.amountPaidTzs)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {t("balanceDue")}
                        </p>
                        <p className="font-medium">
                          {formatCurrency(balance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("date")}</p>
                        <p className="font-medium">
                          {formatDate(
                            new Date(inv.periodYear, inv.periodMonth - 1, 1)
                          )}
                        </p>
                      </div>
                    </div>
                    {canManage &&
                      balance > 0 &&
                      inv.status !== "VOID" &&
                      (payInvoiceId === inv.id ? (
                        <form
                          onSubmit={submitPayment}
                          className="grid gap-3 sm:grid-cols-3 border-t pt-3"
                        >
                          <div className="space-y-1">
                            <Label>{t("paymentAmount")}</Label>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>{t("paymentMethod")}</Label>
                            <Select
                              value={payMethod}
                              onValueChange={setPayMethod}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CASH">{t("cash")}</SelectItem>
                                <SelectItem value="MOBILE_MONEY">
                                  {t("mobileMoney")}
                                </SelectItem>
                                <SelectItem value="BANK">{t("bank")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end gap-2">
                            <Button type="submit" disabled={paying}>
                              {paying ? t("saving") : t("recordPayment")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setPayInvoiceId(null);
                                setPayAmount("");
                              }}
                            >
                              {t("cancel")}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap gap-2 border-t pt-3">
                          <Button
                            size="sm"
                            onClick={() => {
                              setPayInvoiceId(inv.id);
                              setPayAmount(String(Math.round(balance)));
                            }}
                          >
                            {t("recordPayment")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPayInvoiceId(inv.id);
                              setPayAmount(String(Math.round(balance)));
                            }}
                          >
                            {t("payFullBalance")}
                          </Button>
                          {inv.amountPaidTzs === 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => voidInvoice(inv.id)}
                            >
                              {t("voidInvoice")}
                            </Button>
                          )}
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
