"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Download } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { rangeForMonthPreset } from "@/lib/reports/date-range";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import {
  ProductionCostPanel,
  type ProductionCostRow,
  type ProductionCostSummary,
} from "@/components/finance/production-cost-panel";

export default function ProductionCostPage() {
  const t = useT();
  const initialRange = rangeForMonthPreset("this_month");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [camp, setCamp] = useState("all");
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState<ProductionCostSummary | null>(null);
  const [rows, setRows] = useState<ProductionCostRow[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setOffset(0);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (camp !== "all") params.set("camp", camp);
    fetch(`/api/reports/production-cost?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSummary(d.summary);
          setRows(Array.isArray(d.rows) ? d.rows : []);
        } else {
          setSummary(null);
          setRows([]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [from, to, camp]);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : d.camps || []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    if (!rows.length) return;
    downloadCsv(
      `production-cost-${new Date().toISOString().slice(0, 10)}.csv`,
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
          "salePriceTzs",
          "marginTzs",
        ],
        rows.map((r) => [
          r.eartag,
          r.campName,
          r.animalDays,
          r.purchasePriceTzs,
          r.feedShareTzs,
          r.treatmentTzs,
          r.periodCostTzs,
          r.weightGainKg,
          r.costPerKgTzs,
          r.salePriceTzs,
          r.marginTzs,
        ])
      )
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Link
            href="/finance"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> {t("financeTitle")}
          </Link>
          <h1 className="text-3xl font-bold">{t("productionCostTitle")}</h1>
          <p className="text-muted-foreground">{t("productionCostSubtitle")}</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-2" /> {t("exportCsv")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <Button onClick={load} disabled={loading}>
              {loading ? t("loading") : t("apply")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {t("productionDateHint")}
          </p>
        </CardContent>
      </Card>

      {summary && (
        <ProductionCostPanel
          summary={summary}
          rows={rows}
          offset={offset}
          onOffset={setOffset}
        />
      )}
    </div>
  );
}
