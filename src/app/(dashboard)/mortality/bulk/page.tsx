"use client";

import { useState } from "react";
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
import { useT } from "@/components/providers/locale-provider";
import { AnimalActivityPicker } from "@/components/animals/animal-activity-picker";
import type { PickerAnimal } from "@/components/animals/animal-activity-picker";
import { SelectedAnimalsList } from "@/components/animals/selected-animals-list";
import { DeathCausePicker } from "@/components/animals/death-cause-picker";
import { ChoicePills } from "@/components/choice-pills";
import { SuccessDialog } from "@/components/success-dialog";
import {
  deathCauseKey,
  DISPOSAL_METHODS,
  disposalMethodKey,
  parseDeathCauseFormValue,
} from "@/lib/death-causes";

type MortalityPreset = "general" | "family_slaughter";

export default function DeadAnimalRecordPage() {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [animalById, setAnimalById] = useState<Map<string, PickerAnimal>>(
    new Map()
  );
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState<MortalityPreset>("general");
  const [causeValue, setCauseValue] = useState("CULLING");
  const [form, setForm] = useState({
    date: "",
    causeDetail: "",
    disposalMethod: "BURIED",
    disposalNotes: "",
    location: "",
    notes: "",
    isCulling: true,
    insuranceClaim: false,
    claimAmountTzs: "",
    claimReference: "",
  });
  const [result, setResult] = useState<{
    recorded: number;
    skipped: number;
    isCulling: boolean;
  } | null>(null);

  function mergeAnimalsLoaded(animals: PickerAnimal[]) {
    setAnimalById((prev) => {
      const next = new Map(prev);
      animals.forEach((a) => next.set(a.id, a));
      return next;
    });
  }

  function applyPreset(next: MortalityPreset) {
    setPreset(next);
    if (next === "family_slaughter") {
      setCauseValue("CULLING");
      setForm((f) => ({
        ...f,
        disposalMethod: "HOME_USE",
        isCulling: true,
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      disposalMethod: f.disposalMethod === "HOME_USE" ? "BURIED" : f.disposalMethod,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      window.alert(t("selectAtLeastOneAnimal"));
      return;
    }
    const parsed = parseDeathCauseFormValue(causeValue);
    const causeLabel =
      parsed.cause === "OTHER" && parsed.causeDetail
        ? parsed.causeDetail
        : t(deathCauseKey(parsed.cause));
    if (
      !window.confirm(
        t("confirmBulkMortality", {
          n: selected.size,
          cause: causeLabel,
        })
      )
    ) {
      return;
    }

    setSaving(true);
    setResult(null);
    const res = await fetch("/api/mortality/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalIds: [...selected],
        date: form.date || undefined,
        cause: parsed.cause,
        causeDetail:
          parsed.causeDetail || form.causeDetail.trim() || null,
        disposalMethod: form.disposalMethod,
        disposalNotes: form.disposalNotes || null,
        location: form.location || null,
        notes: form.notes || null,
        isCulling:
          form.isCulling || parsed.isCulling || parsed.cause === "CULLING",
        insuranceClaim: form.insuranceClaim,
        claimAmountTzs: form.claimAmountTzs || null,
        claimReference: form.claimReference || null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("bulkMortalityFailed"));
      return;
    }

    const data = await res.json();
    setResult({
      recorded: data.recorded,
      skipped: data.skipped,
      isCulling: data.isCulling,
    });
    setSelected(new Set());
    setCauseValue("CULLING");
    setPreset("general");
    setForm({
      date: "",
      causeDetail: "",
      disposalMethod: "BURIED",
      disposalNotes: "",
      location: "",
      notes: "",
      isCulling: true,
      insuranceClaim: false,
      claimAmountTzs: "",
      claimReference: "",
    });
  }

  return (
    <div className="space-y-6 max-w-5xl pb-8">
      <div>
        <Link
          href="/activities"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToActivities")}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {t("deadAnimalRecordTitle")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("deadAnimalRecordSelectHelp")}
        </p>
      </div>

      {result && (
        <SuccessDialog
          open
          title={t("bulkMortalitySuccessTitle")}
          message={
            <>
              {result.isCulling
                ? t("bulkCullResult", { n: result.recorded })
                : t("bulkDeathResult", { n: result.recorded })}
              {result.skipped > 0 && (
                <> · {t("skippedInaccessible", { n: result.skipped })}</>
              )}
            </>
          }
          closeLabel={t("ok")}
          onClose={() => setResult(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("chooseAnimals")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AnimalActivityPicker
            selected={selected}
            onSelectedChange={(next) => {
              setSelected(next);
              setResult(null);
            }}
            onAnimalsLoaded={mergeAnimalsLoaded}
            storageKey="manyika.deadAnimal.columns"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("mortalityDetails")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("animalsSelectedCount", {
              selected: selected.size,
              total: selected.size,
            })}
          </p>
        </CardHeader>
        <CardContent>
          <SelectedAnimalsList selected={selected} animalById={animalById} />
          <form onSubmit={submit} className="space-y-4 max-w-2xl mt-4">
              <div className="space-y-2">
                <Label>{t("mortalityRecordType")}</Label>
                <ChoicePills<MortalityPreset>
                  value={preset}
                  onChange={applyPreset}
                  options={[
                    {
                      value: "general",
                      label: t("mortalityPresetGeneral"),
                    },
                    {
                      value: "family_slaughter",
                      label: t("mortalityPresetFamilySlaughter"),
                    },
                  ]}
                />
                {preset === "family_slaughter" && (
                  <p className="text-xs text-muted-foreground">
                    {t("mortalityPresetFamilySlaughterHelp")}
                  </p>
                )}
              </div>
              <DeathCausePicker
                value={causeValue}
                onChange={(v, meta) => {
                  setCauseValue(v);
                  setForm((f) => ({
                    ...f,
                    isCulling: meta.isCulling ? true : f.isCulling,
                    causeDetail:
                      meta.cause === "OTHER" && meta.causeDetail
                        ? meta.causeDetail
                        : f.causeDetail,
                  }));
                }}
              />

              {causeValue === "OTHER" && (
                <div className="space-y-2">
                  <Label>{t("causeDetail")}</Label>
                  <Input
                    value={form.causeDetail}
                    onChange={(e) =>
                      setForm({ ...form, causeDetail: e.target.value })
                    }
                  />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("disposal")} *</Label>
                  <Select
                    value={form.disposalMethod}
                    onValueChange={(v) =>
                      setForm({ ...form, disposalMethod: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISPOSAL_METHODS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {t(disposalMethodKey(d))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("date")}</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm({ ...form, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t("location")}</Label>
                  <Input
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={
                    form.isCulling ||
                    parseDeathCauseFormValue(causeValue).isCulling
                  }
                  onChange={(e) =>
                    setForm({ ...form, isCulling: e.target.checked })
                  }
                />
                {t("markAsCulling")}
              </label>

              <div className="space-y-2">
                <Label>{t("disposalNotes")}</Label>
                <Input
                  value={form.disposalNotes}
                  onChange={(e) =>
                    setForm({ ...form, disposalNotes: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("notes")}</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                  rows={2}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.insuranceClaim}
                  onChange={(e) =>
                    setForm({ ...form, insuranceClaim: e.target.checked })
                  }
                />
                {t("insuranceClaim")}
              </label>
              {form.insuranceClaim && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("claimAmount")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.claimAmountTzs}
                      onChange={(e) =>
                        setForm({ ...form, claimAmountTzs: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("claimReference")}</Label>
                    <Input
                      value={form.claimReference}
                      onChange={(e) =>
                        setForm({ ...form, claimReference: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {t("bulkMortalityPhotoNote")}
              </p>

              <Button type="submit" disabled={saving || selected.size === 0}>
                {saving ? t("saving") : t("recordBulkMortality")}
              </Button>
            </form>
        </CardContent>
      </Card>
    </div>
  );
}
