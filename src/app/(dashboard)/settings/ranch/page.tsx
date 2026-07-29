"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AgeDisplayMode } from "@/lib/utils";
import { formatAge } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/providers/language-switcher";
import { useT } from "@/components/providers/locale-provider";

export default function RanchSettingsPage() {
  const t = useT();
  const [mode, setMode] = useState<AgeDisplayMode>("AUTO");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/ranch/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ageDisplayMode) setMode(data.ageDisplayMode);
      });
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/ranch/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ageDisplayMode: mode }),
    });
    setSaving(false);
    if (res.ok) {
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
          <CardTitle>{t("ageDisplay")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("howAgeShown")}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as AgeDisplayMode)}>
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

          <Button onClick={save} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
