"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Download } from "lucide-react";

interface PnLData {
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

function labelCat(c: string) {
  return c.replace(/_/g, " ");
}

export default function PnLPage() {
  const [data, setData] = useState<PnLData | null>(null);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [camp, setCamp] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (camp !== "all") params.set("camp", camp);
    fetch(`/api/reports/pnl?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [from, to, camp]);

  useEffect(() => {
    const now = new Date();
    setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
    setTo(now.toISOString().slice(0, 10));
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => {
    if (from && to) load();
  }, [from, to, load]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["section", "name", "amount"],
      ["summary", "salesRevenue", String(data.summary.salesRevenue)],
      ["summary", "otherIncome", String(data.summary.otherIncome)],
      ["summary", "totalExpenses", String(data.summary.totalExpenses)],
      ["summary", "net", String(data.summary.net)],
      ...data.expensesByCategory.map((r) => ["expense", r.name, String(r.amount)]),
      ...data.incomeByCategory.map((r) => ["otherIncome", r.name, String(r.amount)]),
      ...data.monthly.map((m) => [
        "month",
        m.month,
        String(m.net),
      ]),
      ...data.byCamp.map((c) => ["camp", c.name, String(c.net)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pnl-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Link
            href="/finance"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Finance
          </Link>
          <h1 className="text-3xl font-bold">Profit &amp; loss</h1>
          <p className="text-muted-foreground">
            Animal sales + other income − expenses
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!data}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select value={camp} onValueChange={setCamp}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All camps</SelectItem>
                {camps.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sales revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data ? formatCurrency(data.summary.salesRevenue) : "—"}
            </p>
            {data && (
              <p className="text-xs text-muted-foreground">{data.summary.saleCount} sales</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Other income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data ? formatCurrency(data.summary.otherIncome) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data ? formatCurrency(data.summary.totalExpenses) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Net</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data ? formatCurrency(data.summary.net) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Expenses by category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.expensesByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses</p>
              ) : (
                data.expensesByCategory.map((r) => (
                  <div key={r.name} className="flex justify-between text-sm border-b pb-2">
                    <span>{labelCat(r.name)}</span>
                    <span className="font-medium">{formatCurrency(r.amount)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Other income by category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.incomeByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other income</p>
              ) : (
                data.incomeByCategory.map((r) => (
                  <div key={r.name} className="flex justify-between text-sm border-b pb-2">
                    <span>{labelCat(r.name)}</span>
                    <span className="font-medium">{formatCurrency(r.amount)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By month</CardTitle>
            </CardHeader>
            <CardContent>
              {data.monthly.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Month</th>
                        <th className="p-2 text-right">Sales</th>
                        <th className="p-2 text-right">Other</th>
                        <th className="p-2 text-right">Expenses</th>
                        <th className="p-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthly.map((m) => (
                        <tr key={m.month} className="border-b">
                          <td className="p-2">{m.month}</td>
                          <td className="p-2 text-right">{formatCurrency(m.sales)}</td>
                          <td className="p-2 text-right">{formatCurrency(m.otherIncome)}</td>
                          <td className="p-2 text-right">{formatCurrency(m.expenses)}</td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(m.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By camp</CardTitle>
            </CardHeader>
            <CardContent>
              {data.byCamp.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Camp</th>
                        <th className="p-2 text-right">Sales</th>
                        <th className="p-2 text-right">Other</th>
                        <th className="p-2 text-right">Expenses</th>
                        <th className="p-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byCamp.map((c) => (
                        <tr key={c.name} className="border-b">
                          <td className="p-2">{c.name}</td>
                          <td className="p-2 text-right">{formatCurrency(c.sales)}</td>
                          <td className="p-2 text-right">{formatCurrency(c.otherIncome)}</td>
                          <td className="p-2 text-right">{formatCurrency(c.expenses)}</td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(c.net)}
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
      )}
    </div>
  );
}
