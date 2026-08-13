"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate, formatCurrency } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import {
  DEFAULT_EXPENSE_UNITS,
  SYSTEM_EXPENSE_CATEGORIES,
  defaultAllocGroup,
  expenseAllocLabelKey,
  expenseCategoryDisplayName,
  expenseCategoryLabelKey,
  expenseFundingLabelKey,
  type ExpenseAllocGroupCode,
  type ExpenseFundingSourceCode,
} from "@/lib/expense-categories";
import { ChoicePills } from "@/components/choice-pills";

interface ExpenseRow {
  id: string;
  category: string;
  categoryDetail?: string | null;
  amountTzs: number;
  quantity?: number | null;
  unit?: string | null;
  date: string;
  description: string | null;
  camp: { id: string; name: string } | null;
  fundingSource?: string;
  allocGroup?: string;
  recordedBy: { name: string };
}

const ADD_NEW = "__add_new__";

export default function ExpensesPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageFinance") : false;

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [camp, setCamp] = useState("all");
  const [category, setCategory] = useState("all");
  const [fundingFilter, setFundingFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category: "FEED",
    amountTzs: "",
    quantity: "",
    unit: "",
    date: "",
    description: "",
    campId: "",
    notes: "",
    fundingSource: "OPERATING" as ExpenseFundingSourceCode,
    allocGroup: "ALL_ACTIVE" as ExpenseAllocGroupCode,
  });
  const [saving, setSaving] = useState(false);

  const unitOptions: string[] = [];
  {
    const seen = new Set<string>();
    for (const u of [...DEFAULT_EXPENSE_UNITS, ...customUnits]) {
      const key = u.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unitOptions.push(u);
    }
  }

  async function load() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (camp !== "all") params.set("camp", camp);
    if (category !== "all") params.set("category", category);
    if (fundingFilter !== "all") params.set("funding", fundingFilter);
    const res = await fetch(`/api/finance/expenses?${params}`);
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses || []);
      setTotal(data.total || 0);
      if (Array.isArray(data.customExpenseCategories)) {
        setCustomCategories(data.customExpenseCategories);
      }
      if (Array.isArray(data.customExpenseUnits)) {
        setCustomUnits(data.customExpenseUnits);
      }
    }
  }

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : []));
    load();
  }, []);

  async function persistCustomCategory(name: string) {
    const next = [
      ...customCategories.filter(
        (c) => c.toLowerCase() !== name.toLowerCase()
      ),
      name,
    ];
    setCustomCategories(next);
    await fetch("/api/ranch/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customExpenseCategories: next }),
    });
  }

  async function persistCustomUnit(name: string) {
    const next = [
      ...customUnits.filter((u) => u.toLowerCase() !== name.toLowerCase()),
      name,
    ];
    setCustomUnits(next);
    await fetch("/api/ranch/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customExpenseUnits: next }),
    });
  }

  function onCategoryChange(value: string) {
    if (value === ADD_NEW) {
      const name = window.prompt(t("expenseAddCategoryPrompt"))?.trim();
      if (!name) return;
      void persistCustomCategory(name);
      setForm((prev) => ({
        ...prev,
        category: `custom:${name}`,
        allocGroup: defaultAllocGroup("OTHER", prev.fundingSource),
      }));
      return;
    }
    const systemOrCustom = value.startsWith("custom:") ? "OTHER" : value;
    setForm((prev) => ({
      ...prev,
      category: value,
      allocGroup: defaultAllocGroup(systemOrCustom, prev.fundingSource),
    }));
  }

  function onUnitChange(value: string) {
    if (value === ADD_NEW) {
      const name = window.prompt(t("expenseAddUnitPrompt"))?.trim();
      if (!name) return;
      void persistCustomUnit(name);
      setForm((prev) => ({ ...prev, unit: name }));
      return;
    }
    setForm((prev) => ({ ...prev, unit: value === "none" ? "" : value }));
  }

  async function createExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: form.category,
        amountTzs: form.amountTzs,
        quantity: form.quantity || null,
        unit: form.unit || null,
        date: form.date || undefined,
        description: form.description,
        campId: form.campId || null,
        notes: form.notes,
        fundingSource: form.fundingSource,
        allocGroup: form.allocGroup,
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
      category: "FEED",
      amountTzs: "",
      quantity: "",
      unit: "",
      date: "",
      description: "",
      campId: "",
      notes: "",
      fundingSource: "OPERATING",
      allocGroup: "ALL_ACTIVE",
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm(t("confirmDeleteExpense"))) return;
    const res = await fetch(`/api/finance/expenses/${id}`, { method: "DELETE" });
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
          <h1 className="text-3xl font-bold">{t("expenses")}</h1>
          <p className="text-muted-foreground">
            {t("totalLabel", { total: formatCurrency(total) })}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" /> {t("addExpense")}
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t("newExpense")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={createExpense}
              className="grid gap-4 sm:grid-cols-2 max-w-2xl"
            >
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <Select value={form.category} onValueChange={onCategoryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEM_EXPENSE_CATEGORIES.filter((c) => c !== "OTHER").map(
                      (c) => (
                        <SelectItem key={c} value={c}>
                          {t(expenseCategoryLabelKey(c))}
                        </SelectItem>
                      )
                    )}
                    {customCategories.map((c) => (
                      <SelectItem key={`custom:${c}`} value={`custom:${c}`}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value="OTHER">{t("other")}</SelectItem>
                    <SelectItem value={ADD_NEW}>
                      + {t("expenseAddCategory")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("amountTzs")}</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={form.amountTzs}
                  onChange={(e) =>
                    setForm({ ...form, amountTzs: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("expenseQuantity")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("expenseUnit")}</Label>
                <Select
                  value={form.unit || "none"}
                  onValueChange={onUnitChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("expenseUnitOptional")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("expenseUnitOptional")}</SelectItem>
                    {unitOptions.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                    <SelectItem value={ADD_NEW}>
                      + {t("expenseAddUnit")}
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                  onValueChange={(v) =>
                    setForm({ ...form, campId: v === "none" ? "" : v })
                  }
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
                <Label>{t("fundingSource")}</Label>
                <ChoicePills
                  value={form.fundingSource}
                  onChange={(v) => {
                    const funding = v as ExpenseFundingSourceCode;
                    const cat = form.category.startsWith("custom:")
                      ? "OTHER"
                      : form.category;
                    setForm({
                      ...form,
                      fundingSource: funding,
                      allocGroup: defaultAllocGroup(cat, funding),
                    });
                  }}
                  options={[
                    {
                      value: "OPERATING",
                      label: t("fundingOperating"),
                    },
                    { value: "PROJECT", label: t("fundingProject") },
                  ]}
                />
                <p className="text-xs text-muted-foreground">{t("fundingHelp")}</p>
              </div>
              {form.fundingSource === "OPERATING" && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t("allocGroup")}</Label>
                  <Select
                    value={form.allocGroup}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        allocGroup: v as ExpenseAllocGroupCode,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">{t("allocNone")}</SelectItem>
                      <SelectItem value="ALL_ACTIVE">
                        {t("allocAllActive")}
                      </SelectItem>
                      <SelectItem value="SELL_NEXT_CYCLE">
                        {t("allocSellNextCycle")}
                      </SelectItem>
                      <SelectItem value="KEEP_BREEDING">
                        {t("allocKeepBreeding")}
                      </SelectItem>
                      <SelectItem value="KULIMA">{t("allocKulima")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("allocHelp")}</p>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("description")}</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <Button type="submit" disabled={saving} className="sm:col-span-2">
                {saving ? t("saving") : t("saveExpense")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 mb-4">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
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
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t("category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                {SYSTEM_EXPENSE_CATEGORIES.filter((c) => c !== "OTHER").map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {t(expenseCategoryLabelKey(c))}
                    </SelectItem>
                  )
                )}
                {customCategories.map((c) => (
                  <SelectItem key={`custom:${c}`} value={`custom:${c}`}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value="OTHER">{t("other")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fundingFilter} onValueChange={setFundingFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("fundingSource")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                <SelectItem value="OPERATING">{t("fundingOperating")}</SelectItem>
                <SelectItem value="PROJECT">{t("fundingProject")}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={load}>{t("apply")}</Button>
          </div>

          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noExpensesInRange")}
            </p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("date")}</th>
                    <th className="p-3 text-left">{t("category")}</th>
                    <th className="p-3 text-left">{t("expenseQtyUnit")}</th>
                    <th className="p-3 text-left">{t("description")}</th>
                    <th className="p-3 text-left">{t("camp")}</th>
                    <th className="p-3 text-left">{t("fundingSource")}</th>
                    <th className="p-3 text-left">{t("allocGroup")}</th>
                    <th className="p-3 text-right">{t("amount")}</th>
                    {canManage && <th className="p-3" />}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="p-3">{formatDate(e.date)}</td>
                      <td className="p-3">
                        {expenseCategoryDisplayName(
                          e.category,
                          e.categoryDetail,
                          t
                        )}
                      </td>
                      <td className="p-3">
                        {e.quantity != null
                          ? `${e.quantity}${e.unit ? ` ${e.unit}` : ""}`
                          : e.unit || "—"}
                      </td>
                      <td className="p-3">{e.description || "—"}</td>
                      <td className="p-3">{e.camp?.name || "—"}</td>
                      <td className="p-3">
                        {t(
                          expenseFundingLabelKey(e.fundingSource || "OPERATING")
                        )}
                      </td>
                      <td className="p-3">
                        {t(expenseAllocLabelKey(e.allocGroup || "NONE"))}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(e.amountTzs)}
                      </td>
                      {canManage && (
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(e.id)}
                          >
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
