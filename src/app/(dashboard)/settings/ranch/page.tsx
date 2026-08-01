"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AgeDisplayMode } from "@/lib/utils";
import { formatAge } from "@/lib/utils";
import { TAG_COLORS, tagColorLabel } from "@/lib/tag-color";
import { TagColorSwatch } from "@/components/eartag-badge";
import { LanguageSwitcher } from "@/components/providers/language-switcher";
import { useLocale, useT } from "@/components/providers/locale-provider";

type YearRow = { year: string; color: string };

export default function RanchSettingsPage() {
  const t = useT();
  const { locale } = useLocale();
  const [mode, setMode] = useState<AgeDisplayMode>("AUTO");
  const [grazingFee, setGrazingFee] = useState("");
  const [healthNotifyDays, setHealthNotifyDays] = useState("14");
  const [weightDropPercent, setWeightDropPercent] = useState("15");
  const [weightMinKg, setWeightMinKg] = useState("");
  const [yearRows, setYearRows] = useState<YearRow[]>([]);
  const [defaultTagColor, setDefaultTagColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/ranch/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ageDisplayMode) setMode(data.ageDisplayMode);
        if (data?.grazingFeePerAnimalTzs != null) {
          setGrazingFee(String(data.grazingFeePerAnimalTzs));
        }
        if (data?.healthNotifyDaysEarly != null) {
          setHealthNotifyDays(String(data.healthNotifyDaysEarly));
        }
        if (data?.weightAlertDropPercent != null) {
          setWeightDropPercent(String(data.weightAlertDropPercent));
        }
        if (data?.weightAlertMinKg != null) {
          setWeightMinKg(String(data.weightAlertMinKg));
        } else {
          setWeightMinKg("");
        }
        if (data?.defaultTagColor) setDefaultTagColor(data.defaultTagColor);
        if (data?.eartagYearColors) {
          setYearRows(
            Object.entries(data.eartagYearColors as Record<string, string>)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([year, color]) => ({ year, color }))
          );
        }
      });
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    const eartagYearColors: Record<string, string> = {};
    for (const row of yearRows) {
      if (/^\d{4}$/.test(row.year) && row.color) {
        eartagYearColors[row.year] = row.color;
      }
    }
    const res = await fetch("/api/ranch/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ageDisplayMode: mode,
        grazingFeePerAnimalTzs: grazingFee === "" ? 0 : grazingFee,
        healthNotifyDaysEarly: healthNotifyDays === "" ? 14 : healthNotifyDays,
        weightAlertDropPercent: weightDropPercent === "" ? 15 : weightDropPercent,
        weightAlertMinKg: weightMinKg === "" ? null : weightMinKg,
        defaultTagColor: defaultTagColor || null,
        eartagYearColors,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      if (data.grazingFeePerAnimalTzs != null) {
        setGrazingFee(String(data.grazingFeePerAnimalTzs));
      }
      if (data.healthNotifyDaysEarly != null) {
        setHealthNotifyDays(String(data.healthNotifyDaysEarly));
      }
      if (data.weightAlertDropPercent != null) {
        setWeightDropPercent(String(data.weightAlertDropPercent));
      }
      setWeightMinKg(
        data.weightAlertMinKg != null ? String(data.weightAlertMinKg) : ""
      );
      if (data.ageDisplayMode) setMode(data.ageDisplayMode);
      setDefaultTagColor(data.defaultTagColor || "");
      if (data.eartagYearColors) {
        setYearRows(
          Object.entries(data.eartagYearColors as Record<string, string>)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([year, color]) => ({ year, color }))
        );
      }
      setMessage(t("saved"));
    } else {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || t("failedToSave"));
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold">{t("ranchSettingsTitle")}</h1>
        <p className="text-muted-foreground">{t("ranchSettingsSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("languagePreference")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("languagePreferenceHelp")}
          </p>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("ownersBillingTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="grazing-fee">{t("grazingFeeRate")}</Label>
            <Input
              id="grazing-fee"
              type="number"
              min={0}
              step={1000}
              value={grazingFee}
              onChange={(e) => {
                setGrazingFee(e.target.value);
                setMessage("");
              }}
              placeholder="e.g. 5000"
            />
            <p className="text-sm text-muted-foreground">
              {t("grazingFeeRateHelp")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
            <Button asChild variant="outline" size="default">
              <Link href="/owners">{t("navOwnersBilling")}</Link>
            </Button>
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("tagColorYearRules")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("tagColorDefault")}</Label>
            <Select
              value={defaultTagColor || "none"}
              onValueChange={(v) => {
                setDefaultTagColor(v === "none" ? "" : v);
                setMessage("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("tagColorNone")}</SelectItem>
                {TAG_COLORS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {tagColorLabel(c, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {t("tagColorDefaultHelp")}
            </p>
            {defaultTagColor && (
              <TagColorSwatch color={defaultTagColor} locale={locale} />
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
          <p className="text-sm text-muted-foreground">{t("tagColorYearHelp")}</p>
          <div className="space-y-3">
            {yearRows.map((row, i) => (
              <div key={i} className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1">
                  <Label>{t("tagColorYear")}</Label>
                  <Input
                    className="w-24"
                    type="number"
                    min={1990}
                    max={2100}
                    value={row.year}
                    onChange={(e) => {
                      const next = [...yearRows];
                      next[i] = { ...next[i], year: e.target.value };
                      setYearRows(next);
                      setMessage("");
                    }}
                  />
                </div>
                <div className="space-y-1 min-w-[10rem]">
                  <Label>{t("tagColor")}</Label>
                  <Select
                    value={row.color}
                    onValueChange={(v) => {
                      const next = [...yearRows];
                      next[i] = { ...next[i], color: v };
                      setYearRows(next);
                      setMessage("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAG_COLORS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {tagColorLabel(c, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TagColorSwatch color={row.color} locale={locale} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setYearRows(yearRows.filter((_, j) => j !== i));
                    setMessage("");
                  }}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setYearRows([
                ...yearRows,
                { year: String(new Date().getFullYear()), color: "NJANO" },
              ]);
              setMessage("");
            }}
          >
            {t("addYearColor")}
          </Button>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("ageDisplay")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("howAgeShown")}</Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v as AgeDisplayMode);
                setMessage("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">{t("ageAuto")}</SelectItem>
                <SelectItem value="YEARS_AND_MONTHS">{t("ageYearsMonths")}</SelectItem>
                <SelectItem value="MONTHS_ONLY">{t("ageMonthsOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-medium">{t("preview")}</p>
            <p>6 mo → {formatAge(6, mode)}</p>
            <p>15 mo → {formatAge(15, mode)}</p>
            <p>36 mo → {formatAge(36, mode)}</p>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="health-notify">{t("healthNotifyDaysEarly")}</Label>
            <Input
              id="health-notify"
              type="number"
              min={0}
              max={90}
              value={healthNotifyDays}
              onChange={(e) => {
                setHealthNotifyDays(e.target.value);
                setMessage("");
              }}
            />
            <p className="text-sm text-muted-foreground">
              {t("healthNotifyDaysEarlyHelp")}
            </p>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="weight-drop">{t("weightAlertDropPercent")}</Label>
            <Input
              id="weight-drop"
              type="number"
              min={1}
              max={80}
              value={weightDropPercent}
              onChange={(e) => {
                setWeightDropPercent(e.target.value);
                setMessage("");
              }}
            />
            <p className="text-sm text-muted-foreground">
              {t("weightAlertDropPercentHelp")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight-min">{t("weightAlertMinKg")}</Label>
            <Input
              id="weight-min"
              type="number"
              min={0}
              step="any"
              value={weightMinKg}
              onChange={(e) => {
                setWeightMinKg(e.target.value);
                setMessage("");
              }}
              placeholder="e.g. 250"
            />
            <p className="text-sm text-muted-foreground">
              {t("weightAlertMinKgHelp")}
            </p>
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
