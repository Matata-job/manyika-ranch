"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatCurrency } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translations";

const INCOME_CATEGORIES = [
  "GRAZING_FEES",
  "MANURE",
  "SERVICES",
  "SUBSIDY",
  "OTHER",
] as const;

function incomeCategoryKey(c: string): TranslationKey {
  switch (c) {
    case "GRAZING_FEES":
      return "catGrazingFees";
    case "MANURE":
      return "catManure";
    case "SERVICES":
      return "catServices";
    case "SUBSIDY":
      return "catSubsidy";
    default:
      return "other";
  }
}

interface IncomeRow {
  id: string;
  category: string;
  amountTzs: number;
  date: string;
  description: string | null;
  camp: { id: string; name: string } | null;
  recordedBy: { name: string };
}

export default function OtherIncomePage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageFinance") : false;

  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [camp, setCamp] = useState("all");
  const [category, setCategory] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category: "GRAZING_FEES",
    amountTzs: "",
    date: "",
    description: "",
    campId: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (camp !== "all") params.set("camp", camp);
    if (category !== "all") params.set("category", category);
    const res = await fetch(`/api/finance/income?${params}`);
    if (res.ok) {
      const data = await res.json();
      setIncomes(data.incomes || []);
      setTotal(data.total || 0);
    }
  }

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : []));
    load();
  }, []);

  async function createIncome(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/finance/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        campId: form.campId || null,
        date: form.date || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      return;
    }
    setShowForm(false);
    setForm({
      category: "GRAZING_FEES",
      amountTzs: "",
      date: "",
      description: "",
      campId: "",
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm(t("confirmDeleteIncome"))) return;
    const res = await fetch(`/api/finance/income/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/finance"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> {t("financeTitle")}
          </Link>
          <h1 className="text-3xl font-bold">{t("otherIncomeTitle")}</h1>
          <p className="text-muted-foreground">
            {t("otherIncomeSubtitle", { total: formatCurrency(total) })}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" /> {t("addIncome")}
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t("newIncome")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createIncome} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(incomeCategoryKey(c))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("amountTzs")}</Label>
                <Input
                  type="number"
                  required
                  value={form.amountTzs}
                  onChange={(e) => setForm({ ...form, amountTzs: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("date")}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("campOptional")}</Label>
                <Select
                  value={form.campId || "none"}
                  onValueChange={(v) => setForm({ ...form, campId: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("ranchWide")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("ranchWide")}</SelectItem>
                    {camps.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("description")}</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={saving} className="sm:col-span-2">
                {saving ? t("saving") : t("saveIncome")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                {INCOME_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(incomeCategoryKey(c))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={load}>{t("apply")}</Button>
          </div>

          {incomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noIncomeInRange")}</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("date")}</th>
                    <th className="p-3 text-left">{t("category")}</th>
                    <th className="p-3 text-left">{t("description")}</th>
                    <th className="p-3 text-left">{t("camp")}</th>
                    <th className="p-3 text-right">{t("amount")}</th>
                    {canManage && <th className="p-3" />}
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="p-3">{formatDate(row.date)}</td>
                      <td className="p-3">{t(incomeCategoryKey(row.category))}</td>
                      <td className="p-3">{row.description || "—"}</td>
                      <td className="p-3">{row.camp?.name || "—"}</td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(row.amountTzs)}
                      </td>
                      {canManage && (
                        <td className="p-3">
                          <Button size="sm" variant="ghost" onClick={() => remove(row.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      )}
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
