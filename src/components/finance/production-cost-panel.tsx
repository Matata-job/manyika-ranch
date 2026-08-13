"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/components/providers/locale-provider";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
} from "@/components/list-pagination";

export interface ProductionCostRow {
  animalId: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  herdPlan: string;
  campName: string;
  animalDays: number;
  purchasePriceTzs: number;
  purchaseInPeriodTzs: number;
  feedShareTzs: number;
  treatmentTzs: number;
  periodCostTzs: number;
  startWeightKg: number | null;
  endWeightKg: number | null;
  weightGainKg: number | null;
  costPerKgTzs: number | null;
  salePriceTzs: number | null;
  marginTzs: number | null;
}

export interface ProductionCostSummary {
  animalCount: number;
  allocatedFeedTzs: number;
  treatmentTzs: number;
  purchaseInPeriodTzs: number;
  periodCostTzs: number;
  projectSpendTzs: number;
  unallocatedOperatingTzs: number;
  avgPeriodCostTzs: number | null;
}

export function ProductionCostPanel({
  summary,
  rows,
  offset,
  onOffset,
}: {
  summary: ProductionCostSummary;
  rows: ProductionCostRow[];
  offset: number;
  onOffset: (next: number) => void;
}) {
  const t = useT();
  const page = rows.slice(offset, offset + DEFAULT_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("productionCostHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("periodCost")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.periodCostTzs)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("avgPeriodCost")}:{" "}
              {summary.avgPeriodCostTzs != null
                ? formatCurrency(summary.avgPeriodCostTzs)
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("allocatedFeed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.allocatedFeedTzs)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("treatments")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.treatmentTzs)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("projectExpenses")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.projectSpendTzs)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("projectSpendHint")}
            </p>
          </CardContent>
        </Card>
      </div>
      {summary.unallocatedOperatingTzs > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("unallocatedOperating")}:{" "}
          {formatCurrency(summary.unallocatedOperatingTzs)}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("productionCostTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("noProductionRows")}
            </p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">{t("eartag")}</th>
                    <th className="py-2 pr-3">{t("camp")}</th>
                    <th className="py-2 pr-3 text-right">{t("animalDays")}</th>
                    <th className="py-2 pr-3 text-right">{t("purchasePrice")}</th>
                    <th className="py-2 pr-3 text-right">{t("allocatedFeed")}</th>
                    <th className="py-2 pr-3 text-right">{t("treatments")}</th>
                    <th className="py-2 pr-3 text-right">{t("periodCost")}</th>
                    <th className="py-2 pr-3 text-right">{t("weightGain")}</th>
                    <th className="py-2 text-right">{t("costPerKg")}</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((r) => (
                    <tr key={r.animalId} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">
                        <Link
                          href={`/animals/${r.animalId}`}
                          className="text-primary hover:underline"
                        >
                          {r.eartag}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">{r.campName}</td>
                      <td className="py-2 pr-3 text-right">{r.animalDays}</td>
                      <td className="py-2 pr-3 text-right">
                        {r.purchasePriceTzs
                          ? formatCurrency(r.purchasePriceTzs)
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatCurrency(r.feedShareTzs)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatCurrency(r.treatmentTzs)}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium">
                        {formatCurrency(r.periodCostTzs)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {r.weightGainKg != null ? `${r.weightGainKg}` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {r.costPerKgTzs != null
                          ? formatCurrency(r.costPerKgTzs)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ListPagination
                total={rows.length}
                limit={DEFAULT_PAGE_SIZE}
                offset={offset}
                onPrev={() => onOffset(Math.max(0, offset - DEFAULT_PAGE_SIZE))}
                onNext={() => onOffset(offset + DEFAULT_PAGE_SIZE)}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
