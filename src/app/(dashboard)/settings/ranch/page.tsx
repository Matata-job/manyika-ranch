"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AgeDisplayMode } from "@/lib/utils";
import { formatAge } from "@/lib/utils";

export default function RanchSettingsPage() {
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
      setMessage("Saved");
    } else {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || "Failed to save");
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold">Ranch Settings</h1>
        <p className="text-muted-foreground">Owner / Manager preferences for Manyika Ranch</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Age display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>How animal age is shown</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as AgeDisplayMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">
                  Auto — months if under 1 year, then years + months
                </SelectItem>
                <SelectItem value="YEARS_AND_MONTHS">
                  Always years + months (e.g. 2y 3mo)
                </SelectItem>
                <SelectItem value="MONTHS_ONLY">
                  Always months only (e.g. 27 mo)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <p className="font-medium">Preview</p>
            <p>6 months → {formatAge(6, mode)}</p>
            <p>15 months → {formatAge(15, mode)}</p>
            <p>36 months → {formatAge(36, mode)}</p>
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
