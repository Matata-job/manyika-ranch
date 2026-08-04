"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { parseAnimalsList } from "@/lib/animals-api";
import { SuccessDialog } from "@/components/success-dialog";

function treatmentTypeKey(type: string): TranslationKey {
  switch (type) {
    case "DEWORMING":
      return "deworming";
    case "DIPPING":
      return "dipping";
    case "ANTIBIOTIC":
      return "antibiotic";
    default:
      return "other";
  }
}

interface Camp {
  id: string;
  name: string;
}

interface AnimalRow {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  camp: { id: string; name: string };
}

const TREATMENT_TYPE_VALUES = [
  "DEWORMING",
  "DIPPING",
  "ANTIBIOTIC",
  "OTHER",
] as const;

export default function BulkTreatmentPage() {
  const t = useT();
  const TREATMENT_TYPES = TREATMENT_TYPE_VALUES.map((value) => ({
    value,
    label: t(treatmentTypeKey(value)),
  }));
  const [camps, setCamps] = useState<Camp[]>([]);
  const [campId, setCampId] = useState("");
  const [sex, setSex] = useState("all");
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    treatmentCatalogId: "",
    type: "DIPPING",
    product: "",
    dose: "",
    withdrawalPeriod: "",
    date: "",
    notes: "",
  });
  const [schedules, setSchedules] = useState<
    {
      id: string;
      name: string;
      type: string;
      intervalDays: number | null;
      withdrawalPeriod: number | null;
    }[]
  >([]);
  const [result, setResult] = useState<{
    applied: number;
    skipped: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : []));
    fetch("/api/health/treatment-schedules")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSchedules(Array.isArray(d) ? d : []));
  }, []);

  async function loadAnimals(
    nextCampId: string,
    nextSex: string,
    autoSelectAll = true
  ) {
    if (!nextCampId) {
      setAnimals([]);
      setSelected(new Set());
      return;
    }
    setLoadingAnimals(true);
    const params = new URLSearchParams({
      camp: nextCampId,
      limit: "5000",
    });
    if (nextSex !== "all") params.set("sex", nextSex);
    const res = await fetch(`/api/animals?${params}`);
    const data = res.ok ? await res.json() : null;
    const list: AnimalRow[] = parseAnimalsList<AnimalRow>(data).filter(
      (a) => a.status === "ACTIVE" || a.status === "QUARANTINE"
    );
    setAnimals(list);
    setSelected(autoSelectAll ? new Set(list.map((a) => a.id)) : new Set());
    setLoadingAnimals(false);
  }

  useEffect(() => {
    if (campId) loadAnimals(campId, sex);
  }, [campId, sex]);

  const allSelected = animals.length > 0 && selected.size === animals.length;
  const someSelected = selected.size > 0 && selected.size < animals.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(animals.map((a) => a.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedLabel = useMemo(
    () => t("selectedOf", { selected: selected.size, total: animals.length }),
    [selected.size, animals.length, t]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      alert(t("selectAtLeastOneAnimal"));
      return;
    }
    if (!form.product.trim()) {
      alert(t("productRequired"));
      return;
    }
    if (
      !confirm(
        t("confirmApplyTreatment", {
          type: t(treatmentTypeKey(form.type)),
          n: selected.size,
        })
      )
    ) {
      return;
    }

    setSaving(true);
    setResult(null);
    const res = await fetch("/api/health/bulk-treatment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalIds: [...selected],
        treatmentCatalogId: form.treatmentCatalogId || null,
        type: form.type,
        product: form.product,
        dose: form.dose || null,
        withdrawalPeriod: form.withdrawalPeriod || null,
        date: form.date || undefined,
        notes: form.notes || null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("bulkTreatmentFailed"));
      return;
    }

    const data = await res.json();
    setResult({ applied: data.applied, skipped: data.skipped });
    setForm({
      treatmentCatalogId: "",
      type: "DIPPING",
      product: "",
      dose: "",
      withdrawalPeriod: "",
      date: "",
      notes: "",
    });
    setSelected(new Set());
    if (campId) loadAnimals(campId, sex, false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/health"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToHealth")}
        </Link>
        <h1 className="text-3xl font-bold">{t("bulkTreatmentTitle")}</h1>
        <p className="text-muted-foreground">
          {t("bulkTreatmentSubtitle")} {t("useScheduleFrom")}{" "}
          <Link href="/health/schedules" className="text-primary hover:underline">
            {t("healthSchedules")}
          </Link>{" "}
          {t("toSetNextDueAuto")}
        </p>
      </div>

      {result && (
        <SuccessDialog
          open
          title={t("bulkTreatmentSuccessTitle")}
          message={
            <>
              {t("appliedToN", { n: result.applied })}
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
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("camp")} *</Label>
              <Select
                value={campId || undefined}
                onValueChange={(v) => {
                  setCampId(v);
                  setResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCamp")} />
                </SelectTrigger>
                <SelectContent>
                  {camps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("sexFilter")}</Label>
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  <SelectItem value="MALE">{t("male")}</SelectItem>
                  <SelectItem value="FEMALE">{t("female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!campId ? (
            <p className="text-sm text-muted-foreground">{t("selectCampLoad")}</p>
          ) : loadingAnimals ? (
            <p className="text-sm text-muted-foreground">{t("loadingAnimals")}</p>
          ) : animals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noActiveAnimalsCamp")}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                  />
                  {t("selectAll")}
                </label>
                <Badge variant="secondary">{selectedLabel}</Badge>
              </div>
              <div className="rounded-lg border max-h-72 overflow-y-auto divide-y">
                {animals.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                    />
                    <span className="font-medium">{a.eartag}</span>
                    <span className="text-muted-foreground">
                      {a.breed} · {a.sex}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("treatmentDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            {schedules.length > 0 && (
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("fromSchedule")}</Label>
                <Select
                  value={form.treatmentCatalogId || "__custom__"}
                  onValueChange={(v) => {
                    if (v === "__custom__") {
                      setForm({ ...form, treatmentCatalogId: "" });
                      return;
                    }
                    const s = schedules.find((x) => x.id === v);
                    setForm({
                      ...form,
                      treatmentCatalogId: v,
                      type: s?.type || form.type,
                      product: s?.name || form.product,
                      withdrawalPeriod:
                        s?.withdrawalPeriod != null
                          ? String(s.withdrawalPeriod)
                          : form.withdrawalPeriod,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("optionalSchedule")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__custom__">
                      {t("customOneOff")}
                    </SelectItem>
                    {schedules.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.intervalDays
                          ? ` (${t("everyNDays", { n: s.intervalDays })})`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("scheduleAutoDue")}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("type")} *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v })}
                disabled={!!form.treatmentCatalogId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TREATMENT_TYPES.map((tt) => (
                    <SelectItem key={tt.value} value={tt.value}>
                      {tt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("product")} *</Label>
              <Input
                value={form.product}
                onChange={(e) =>
                  setForm({
                    ...form,
                    product: e.target.value,
                    treatmentCatalogId: "",
                  })
                }
                placeholder="e.g. Amitraz, Albendazole"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("dose")}</Label>
              <Input
                value={form.dose}
                onChange={(e) => setForm({ ...form, dose: e.target.value })}
                placeholder="e.g. 10 ml / 100 kg"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("withdrawalDays")}</Label>
              <Input
                type="number"
                min={0}
                value={form.withdrawalPeriod}
                onChange={(e) =>
                  setForm({ ...form, withdrawalPeriod: e.target.value })
                }
                placeholder="Meat/milk safe after N days"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Batch, weather, crush notes…"
              />
            </div>
            <Button
              type="submit"
              disabled={saving || selected.size === 0 || !campId}
              className="sm:col-span-2"
            >
              {saving
                ? t("applying")
                : t("applyToN", { n: selected.size })}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
