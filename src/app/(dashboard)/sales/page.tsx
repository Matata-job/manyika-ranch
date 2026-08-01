"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Download } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";

interface SalesReport {
  summary: {
    count: number;
    totalRevenue: number;
    totalWeight: number;
    avgPrice: number;
    avgPricePerKg: number | null;
  };
  byBreed: { name: string; count: number; revenue: number }[];
  byCamp: { name: string; count: number; revenue: number }[];
  bySex: { name: string; count: number; revenue: number }[];
  byBuyer: { name: string; count: number; revenue: number; buyerId?: string | null }[];
  sales: {
    id: string;
    buyer: string;
    buyerId?: string | null;
    priceTzs: number;
    weightAtSale: number | null;
    saleDate: string;
    transport: string | null;
    notes: string | null;
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

export default function SalesPage() {
  const t = useT();
  const { data: session } = useSession();
  const canManageSales = session?.user?.role
    ? hasPermission(session.user.role as Role, "manageSales")
    : false;
  const [data, setData] = useState<SalesReport | null>(null);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [breedOptions, setBreedOptions] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [camp, setCamp] = useState("all");
  const [breed, setBreed] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (camp !== "all") params.set("camp", camp);
    if (breed !== "all") params.set("breed", breed);
    fetch(`/api/reports/sales?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [from, to, camp, breed]);

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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!data?.sales?.length) return;
    const headers = [
      "saleDate",
      "eartag",
      "breed",
      "sex",
      "camp",
      "buyer",
      "priceTzs",
      "weightKg",
      "pricePerKg",
      "transport",
      "notes",
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
        `"${s.buyer.replace(/"/g, '""')}"`,
        s.priceTzs,
        s.weightAtSale ?? "",
        ppk,
        s.transport ? `"${s.transport.replace(/"/g, '""')}"` : "",
        s.notes ? `"${s.notes.replace(/"/g, '""')}"` : "",
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("salesTitle")}</h1>
          <p className="text-muted-foreground">{t("salesSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageSales && (
            <Button asChild>
              <Link href="/sales/bulk">{t("bulkSale")}</Link>
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} disabled={!data?.sales?.length}>
            <Download className="h-4 w-4 mr-2" />
            {t("exportCsv")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            <Select value={camp} onValueChange={setCamp}>
              <SelectTrigger>
                <SelectValue placeholder="Camp" />
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
            <Select value={breed} onValueChange={setBreed}>
              <SelectTrigger>
                <SelectValue placeholder="Breed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All breeds</SelectItem>
                {breedOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={load} disabled={loading}>
              {loading ? t("loading") : t("apply")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Animals sold</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.summary.count ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data ? formatCurrency(data.summary.totalRevenue) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data ? formatCurrency(data.summary.avgPrice) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg TZS / kg</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data?.summary.avgPricePerKg != null
                ? formatCurrency(data.summary.avgPricePerKg)
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>By breed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.byBreed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales in range</p>
              ) : (
                data.byBreed.map((b) => (
                  <div key={b.name} className="flex justify-between text-sm border-b pb-2">
                    <span>
                      {b.name} <Badge variant="outline" className="ml-1">{b.count}</Badge>
                    </span>
                    <span className="font-medium">{formatCurrency(b.revenue)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By camp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.byCamp.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales in range</p>
              ) : (
                data.byCamp.map((c) => (
                  <div key={c.name} className="flex justify-between text-sm border-b pb-2">
                    <span>
                      {c.name} <Badge variant="outline" className="ml-1">{c.count}</Badge>
                    </span>
                    <span className="font-medium">{formatCurrency(c.revenue)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By sex</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {data.bySex.map((s) => (
                <Badge key={s.name} variant="secondary">
                  {s.name}: {s.count} · {formatCurrency(s.revenue)}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top buyers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.byBuyer.length === 0 ? (
                <p className="text-sm text-muted-foreground">No buyers yet</p>
              ) : (
                data.byBuyer.map((b) => (
                  <div key={`${b.buyerId || b.name}`} className="flex justify-between text-sm border-b pb-2">
                    <span>
                      {b.buyerId ? (
                        <Link href={`/buyers/${b.buyerId}`} className="text-primary hover:underline">
                          {b.name}
                        </Link>
                      ) : (
                        b.name
                      )}{" "}
                      <Badge variant="outline" className="ml-1">{b.count}</Badge>
                    </span>
                    <span className="font-medium">{formatCurrency(b.revenue)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sale records</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.sales?.length ? (
            <p className="text-sm text-muted-foreground">
              {t("noSales")}
            </p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("saleDate")}</th>
                    <th className="p-3 text-left">Animal</th>
                    <th className="p-3 text-left">{t("camp")}</th>
                    <th className="p-3 text-left">{t("buyer")}</th>
                    <th className="p-3 text-right">{t("price")}</th>
                    <th className="p-3 text-right">{t("weight")}</th>
                    <th className="p-3 text-right">TZS/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.map((s) => {
                    const ppk =
                      s.weightAtSale && s.weightAtSale > 0
                        ? Math.round(s.priceTzs / s.weightAtSale)
                        : null;
                    return (
                      <tr key={s.id} className="border-b">
                        <td className="p-3">{formatDate(s.saleDate)}</td>
                        <td className="p-3">
                          <Link
                            href={`/animals/${s.animal.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {s.animal.eartag}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {s.animal.breed} · {s.animal.sex}
                          </p>
                        </td>
                        <td className="p-3">{s.animal.camp.name}</td>
                        <td className="p-3">{s.buyer}</td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(s.priceTzs)}
                        </td>
                        <td className="p-3 text-right">
                          {s.weightAtSale != null ? `${s.weightAtSale} kg` : "—"}
                        </td>
                        <td className="p-3 text-right">
                          {ppk != null ? formatCurrency(ppk) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
