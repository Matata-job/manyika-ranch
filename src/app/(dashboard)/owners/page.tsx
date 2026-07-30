"use client";

import { useCallback, useEffect, useState } from "react";
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
import { periodLabel } from "@/lib/services/billing-service";
import { hasPermission } from "@/lib/auth/rbac";
import { roleLabel, type TranslationKey } from "@/lib/i18n/translations";
import { useLocale, useT } from "@/components/providers/locale-provider";
import type { Role } from "@prisma/client";
import { Settings } from "lucide-react";

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

export default function OwnersBillingPage() {
  const t = useT();
  const { locale } = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageFinance") : false;

  const now = new Date();
  const [rateTzs, setRateTzs] = useState(0);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [totals, setTotals] = useState({
    owners: 0,
    animals: 0,
    monthlyEstimate: 0,
    outstandingTzs: 0,
  });
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [summaryRes, invRes] = await Promise.all([
      fetch("/api/owners/billing"),
      fetch("/api/owners/billing/invoices"),
    ]);
    if (summaryRes.ok) {
      const data = await summaryRes.json();
      setRateTzs(data.rateTzs || 0);
      setOwners(data.owners || []);
      setTotals(data.totals || totals);
    }
    if (invRes.ok) {
      setInvoices(await invRes.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    if (rateTzs <= 0) {
      setMessage(t("setFeeInSettings"));
      return;
    }
    if (
      !confirm(
        `${t("generateInvoices")} — ${periodLabel(year, month, locale)}?`
      )
    ) {
      return;
    }
    setGenerating(true);
    setMessage("");
    const res = await fetch("/api/owners/billing/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    setGenerating(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || t("failedToSave"));
      return;
    }
    const data = await res.json();
    setMessage(
      `${t("invoicesGenerated", { n: data.created.length })} · ${t("invoicesSkipped", { n: data.skipped.length })}`
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

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

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
          <CardContent>
            <p className="text-2xl font-bold">
              {rateTzs > 0 ? formatCurrency(rateTzs) : "—"}
            </p>
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
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-2">
                <Label>{t("period")}</Label>
                <div className="flex gap-2">
                  <Select
                    value={String(month)}
                    onValueChange={(v) => setMonth(parseInt(v, 10))}
                  >
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
                    onChange={(e) => setYear(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
              <Button onClick={generate} disabled={generating || rateTzs <= 0}>
                {generating ? t("generating") : t("generateInvoices")}
              </Button>
            </div>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("invoices")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoices.length === 0 ? (
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
