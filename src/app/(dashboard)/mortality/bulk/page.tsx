"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { parseAnimalsList } from "@/lib/animals-api";

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
}

const CAUSES = [
  "DISEASE",
  "INJURY",
  "PREDATION",
  "DROUGHT_STARVATION",
  "BIRTHING",
  "OLD_AGE",
  "CULLING",
  "UNKNOWN",
  "OTHER",
] as const;

const DISPOSALS = [
  "BURIED",
  "BURNED",
  "SOLD_CARCASS",
  "REMOVED",
  "OTHER",
] as const;

function causeKey(cause: string): TranslationKey {
  switch (cause) {
    case "DISEASE":
      return "illness";
    case "INJURY":
      return "injury";
    case "PREDATION":
      return "causePredation";
    case "DROUGHT_STARVATION":
      return "causeDroughtStarvation";
    case "BIRTHING":
      return "causeBirthing";
    case "OLD_AGE":
      return "causeOldAge";
    case "CULLING":
      return "causeCulling";
    case "UNKNOWN":
      return "causeUnknown";
    default:
      return "other";
  }
}

function disposalKey(method: string): TranslationKey {
  switch (method) {
    case "BURIED":
      return "disposalBuried";
    case "BURNED":
      return "disposalBurned";
    case "SOLD_CARCASS":
      return "disposalSoldCarcass";
    case "REMOVED":
      return "disposalRemoved";
    default:
      return "other";
  }
}

export default function BulkMortalityPage() {
  const t = useT();
  const [camps, setCamps] = useState<Camp[]>([]);
  const [campId, setCampId] = useState("");
  const [sex, setSex] = useState("all");
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: "",
    cause: "CULLING",
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

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : d.camps || []));
  }, []);

  async function loadAnimals(nextCampId: string, nextSex: string) {
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
      (a) => a.status !== "DECEASED" && a.status !== "SOLD"
    );
    setAnimals(list);
    setSelected(new Set());
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
      window.alert(t("selectAtLeastOneAnimal"));
      return;
    }
    if (
      !window.confirm(
        t("confirmBulkMortality", {
          n: selected.size,
          cause: t(causeKey(form.cause)),
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
        cause: form.cause,
        causeDetail: form.causeDetail || null,
        disposalMethod: form.disposalMethod,
        disposalNotes: form.disposalNotes || null,
        location: form.location || null,
        notes: form.notes || null,
        isCulling: form.isCulling || form.cause === "CULLING",
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
    if (campId) loadAnimals(campId, sex);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/mortality"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToMortality")}
        </Link>
        <h1 className="text-3xl font-bold">{t("bulkMortalityTitle")}</h1>
        <p className="text-muted-foreground">{t("bulkMortalitySubtitle")}</p>
      </div>

      {result && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">
              {result.isCulling
                ? t("bulkCullResult", { n: result.recorded })
                : t("bulkDeathResult", { n: result.recorded })}
              {result.skipped > 0 && (
                <> · {t("skippedInaccessible", { n: result.skipped })}</>
              )}
            </p>
          </CardContent>
        </Card>
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
          <CardTitle>{t("mortalityDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("cause")} *</Label>
                <Select
                  value={form.cause}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      cause: v,
                      isCulling: v === "CULLING" ? true : form.isCulling,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAUSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(causeKey(c))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    {DISPOSALS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {t(disposalKey(d))}
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
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
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
                checked={form.isCulling || form.cause === "CULLING"}
                onChange={(e) =>
                  setForm({ ...form, isCulling: e.target.checked })
                }
              />
              {t("markAsCulling")}
            </label>

            <div className="space-y-2">
              <Label>{t("causeDetail")}</Label>
              <Input
                value={form.causeDetail}
                onChange={(e) =>
                  setForm({ ...form, causeDetail: e.target.value })
                }
              />
            </div>
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
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
