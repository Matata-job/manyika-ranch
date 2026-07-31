"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useLocale, useT } from "@/components/providers/locale-provider";
import { OptionalSection } from "@/components/optional-section";
import { TAG_COLORS, tagColorLabel } from "@/lib/tag-color";
import { TagColorSwatch } from "@/components/eartag-badge";

const CampLocationPicker = dynamic(
  () =>
    import("@/components/camp-location-picker").then((m) => m.CampLocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 rounded-lg border bg-muted animate-pulse" />
    ),
  }
);

export default function NewCampPage() {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sizeAcres: "",
    latitude: "",
    longitude: "",
    waterSources: "",
    notes: "",
    tagColor: "",
  });

  useEffect(() => {
    fetch("/api/ranch/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.defaultTagColor) {
          setForm((prev) =>
            prev.tagColor ? prev : { ...prev, tagColor: data.defaultTagColor }
          );
        }
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/camps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        sizeAcres: form.sizeAcres || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        waterSources: form.waterSources || null,
        notes: form.notes || null,
        tagColor: form.tagColor || null,
      }),
    });

    if (res.ok) {
      const camp = await res.json();
      router.push(`/camps/${camp.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("failedToSave"));
      setLoading(false);
    }
  }

  const locationSummary =
    form.latitude && form.longitude
      ? `${form.latitude}, ${form.longitude}`
      : t("optionalTapToAdd");

  return (
    <div className="space-y-4 max-w-xl">
      <Link
        href="/camps"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> {t("navCamps")}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t("addCamp")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("campName")} *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>{t("tagColorCamp")}</Label>
              <Select
                value={form.tagColor || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, tagColor: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("tagColorUseDefault")}</SelectItem>
                  {TAG_COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {tagColorLabel(c, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{t("tagColorHelp")}</p>
              {form.tagColor && (
                <TagColorSwatch color={form.tagColor} locale={locale} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizeAcres">{t("sizeAcres")}</Label>
              <Input
                id="sizeAcres"
                type="number"
                min={0}
                step={0.1}
                value={form.sizeAcres}
                onChange={(e) => setForm({ ...form, sizeAcres: e.target.value })}
                placeholder="e.g. 120"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waterSources">{t("waterSources")}</Label>
              <Input
                id="waterSources"
                value={form.waterSources}
                onChange={(e) =>
                  setForm({ ...form, waterSources: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>

            <OptionalSection
              open={showLocation}
              onToggle={() => setShowLocation((v) => !v)}
              title={t("campLocation")}
              summary={locationSummary}
            >
              <CampLocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={({ latitude, longitude }) =>
                  setForm({ ...form, latitude, longitude })
                }
              />
            </OptionalSection>

            <p className="text-xs text-muted-foreground">{t("campPhotosAfterSave")}</p>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || !form.name.trim()}>
                {loading ? t("saving") : t("save")}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
