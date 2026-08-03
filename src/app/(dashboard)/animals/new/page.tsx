"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
import { enqueueSync } from "@/lib/sync/offline-db";
import { ChoicePills } from "@/components/choice-pills";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, X } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { parseAnimalsList } from "@/lib/animals-api";
import { PhotoSourcePicker } from "@/components/photo-source-picker";
import { cn } from "@/lib/utils";
import { useObjectUrls } from "@/hooks/use-object-urls";
import { rememberCampEartag, suggestNextEartag } from "@/lib/eartag";
import { uploadPhotoFile } from "@/lib/client/upload-photo";

const LOOKUPS_CACHE_KEY = "register-lookups-v1";
const DEFAULTS_CACHE_KEY = "register-animal-defaults-v1";

type RememberedDefaults = {
  breed: string;
  sex: string;
  isCastrated: boolean;
  isPregnant: boolean;
  campId: string;
  ownerId: string;
  sireId: string;
  damId: string;
  colorMarkings: string;
  acquisitionType: string;
  acquisitionDate: string;
};

function loadRememberedDefaults(): Partial<RememberedDefaults> | null {
  try {
    const raw = localStorage.getItem(DEFAULTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedDefaults>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveRememberedDefaults(form: RememberedDefaults) {
  try {
    localStorage.setItem(DEFAULTS_CACHE_KEY, JSON.stringify(form));
  } catch {
    /* quota / private mode */
  }
}

function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

type CampOption = { id: string; name: string; code?: string | null };

export default function NewAnimalPage() {
  const t = useT();
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">{t("loading")}</p>}
    >
      <NewAnimalPageContent />
    </Suspense>
  );
}

function NewAnimalPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campFromQuery = searchParams.get("camp");
  const campPrefillDone = useRef(false);
  const defaultsApplied = useRef(false);
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string; role?: string }[]>([]);
  const [breeds, setBreeds] = useState<{ id: string; name: string }[]>([]);
  const [animals, setAnimals] = useState<
    { id: string; eartag: string; sex: string; campId: string; campName: string }[]
  >([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const photoPreviewUrls = useObjectUrls(photoFiles);
  const [eartagManual, setEartagManual] = useState(false);
  const [lastEartag, setLastEartag] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    eartag: string;
    animalId: string | null;
    offline: boolean;
  } | null>(null);
  const [form, setForm] = useState({
    eartag: "",
    breed: "",
    sex: "FEMALE",
    isCastrated: false,
    isPregnant: false,
    dob: "",
    ageYears: "",
    ageMonthsPart: "",
    campId: "",
    ownerId: "",
    sireId: "",
    damId: "",
    colorMarkings: "",
    notes: "",
    acquisitionType: "BORN_ON_FARM",
    acquisitionDate: "",
  });

  const isBornOnFarm = form.acquisitionType === "BORN_ON_FARM";
  const isExternal =
    form.acquisitionType === "PURCHASED" || form.acquisitionType === "GIFT";

  async function applyCampEartagSuggestion(
    campId: string,
    opts?: { forceEartag?: boolean; extraEartags?: string[] }
  ) {
    const camp = camps.find((c) => c.id === campId);
    let suggested: string | null = null;
    let last: string | null = null;
    const extra = opts?.extraEartags ?? [];

    try {
      const res = await fetch(`/api/camps/${campId}/next-eartag`);
      if (res.ok) {
        const data = await res.json();
        suggested = data.suggested || null;
        last = data.lastEartag || null;
        if (
          suggested &&
          extra.some(
            (e) => e.trim().toUpperCase() === suggested!.trim().toUpperCase()
          )
        ) {
          suggested = null;
        }
      }
    } catch {
      /* offline */
    }

    if (!suggested) {
      const { recallCampEartag } = await import("@/lib/eartag");
      const remembered = recallCampEartag(campId);
      const allTags = [...animals.map((a) => a.eartag), ...extra];
      const campTags = [
        ...animals.filter((a) => a.campId === campId).map((a) => a.eartag),
        ...extra,
      ];
      suggested = suggestNextEartag({
        campCode: camp?.code,
        sequenceEartags: [...campTags, ...(remembered ? [remembered] : [])],
        existingEartags: [...allTags, ...(remembered ? [remembered] : [])],
      });
      last = last || remembered;
    }

    setLastEartag(last);
    setForm((prev) => {
      const shouldFill =
        opts?.forceEartag || !eartagManual || !prev.eartag.trim();
      return {
        ...prev,
        campId,
        eartag: shouldFill && suggested ? suggested : prev.eartag,
      };
    });
    if (opts?.forceEartag) setEartagManual(false);
  }

  useEffect(() => {
    function applyLookups(
      c: unknown,
      o: unknown,
      b: unknown,
      a: unknown
    ) {
      setCamps(Array.isArray(c) ? (c as CampOption[]) : []);
      const ownerList = Array.isArray(o) ? o : [];
      setOwners(ownerList);
      setBreeds(Array.isArray(b) ? b : []);
      setAnimals(
        parseAnimalsList<{
          id: string;
          eartag: string;
          sex: string;
          camp?: { id: string; name: string };
        }>(a).map((row) => ({
          id: row.id,
          eartag: row.eartag,
          sex: row.sex,
          campId: row.camp?.id || "",
          campName: row.camp?.name || "",
        }))
      );
      const ranchOwner = ownerList.find(
        (u: { role?: string }) => u.role === "OWNER"
      );
      if (ranchOwner) {
        setForm((prev) =>
          prev.ownerId ? prev : { ...prev, ownerId: ranchOwner.id }
        );
      }
    }

    try {
      const cached = localStorage.getItem(LOOKUPS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          camps?: unknown;
          owners?: unknown;
          breeds?: unknown;
          animals?: unknown;
        };
        applyLookups(parsed.camps, parsed.owners, parsed.breeds, parsed.animals);
      }
    } catch {
      // ignore bad cache
    }

    if (!defaultsApplied.current) {
      defaultsApplied.current = true;
      const remembered = loadRememberedDefaults();
      if (remembered) {
        setForm((prev) => ({
          ...prev,
          breed: remembered.breed || prev.breed,
          sex: remembered.sex || prev.sex,
          isCastrated: Boolean(remembered.isCastrated),
          isPregnant: Boolean(remembered.isPregnant),
          campId: campFromQuery || remembered.campId || prev.campId,
          ownerId: remembered.ownerId || prev.ownerId,
          sireId: remembered.sireId || prev.sireId,
          damId: remembered.damId || prev.damId,
          colorMarkings: remembered.colorMarkings || prev.colorMarkings,
          acquisitionType: remembered.acquisitionType || prev.acquisitionType,
          acquisitionDate: remembered.acquisitionDate || prev.acquisitionDate,
        }));
      }
    }

    if (!navigator.onLine) return;

    Promise.all([
      fetch("/api/camps").then((r) => r.json()),
      fetch("/api/owners").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/breeds").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/animals?status=ACTIVE&limit=5000").then((r) => r.json()),
    ])
      .then(([c, o, b, a]) => {
        applyLookups(c, o, b, a);
        try {
          localStorage.setItem(
            LOOKUPS_CACHE_KEY,
            JSON.stringify({ camps: c, owners: o, breeds: b, animals: a })
          );
        } catch {
          // quota / private mode
        }
      })
      .catch(() => {
        // keep cached lookups if online fetch fails
      });
  }, [campFromQuery]);

  useEffect(() => {
    if (campPrefillDone.current || camps.length === 0) return;
    const campId = campFromQuery || form.campId;
    if (!campId || !camps.some((c) => c.id === campId)) return;
    // Query camp always wins; remembered camp only auto-suggests eartag once
    if (!campFromQuery && form.eartag.trim()) {
      campPrefillDone.current = true;
      return;
    }
    campPrefillDone.current = true;
    void applyCampEartagSuggestion(campId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once lookups ready
  }, [campFromQuery, camps, form.campId]);

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const file of photoFiles) {
      urls.push(await uploadPhotoFile(file, "animals", t("photoUploadFailed")));
    }
    return urls;
  }

  function persistDefaultsFromForm() {
    saveRememberedDefaults({
      breed: form.breed,
      sex: form.sex,
      isCastrated: form.isCastrated,
      isPregnant: form.isPregnant,
      campId: form.campId,
      ownerId: form.ownerId,
      sireId: form.sireId,
      damId: form.damId,
      colorMarkings: form.colorMarkings,
      acquisitionType: form.acquisitionType,
      acquisitionDate: form.acquisitionDate,
    });
  }

  async function prepareNextAnimal(justSavedEartag: string) {
    const campId = form.campId;
    setPhotoFiles([]);
    setShowMore(false);
    setEartagManual(false);
    setForm((prev) => ({
      ...prev,
      eartag: "",
      dob: "",
      ageYears: "",
      ageMonthsPart: "",
      notes: "",
      // Keep batch fields: camp, breed, sex, source, owner, parents, markings, acquisition date
    }));
    setLastEartag(justSavedEartag);
    if (campId) {
      await applyCampEartagSuggestion(campId, {
        forceEartag: true,
        extraEartags: [justSavedEartag],
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.eartag.trim() || !form.breed || !form.campId) {
      alert(t("eartagBreedRequired"));
      return;
    }
    const taken = animals.some(
      (a) => a.eartag.trim().toUpperCase() === form.eartag.trim().toUpperCase()
    );
    if (taken) {
      alert(t("eartagTaken"));
      return;
    }
    setLoading(true);

    const payload = {
      ...form,
      sireId: form.sireId || null,
      damId: form.damId || null,
      ownerId: form.ownerId || undefined,
      dob: form.dob || null,
      acquisitionType: form.acquisitionType,
      acquisitionDate: isExternal ? form.acquisitionDate || null : null,
      isCastrated: form.sex === "MALE" ? form.isCastrated : false,
      isPregnant: form.sex === "FEMALE" ? form.isPregnant : false,
      ageYears: form.dob ? undefined : form.ageYears ? Number(form.ageYears) : 0,
      ageMonthsPart: form.dob
        ? undefined
        : form.ageMonthsPart
          ? Number(form.ageMonthsPart)
          : 0,
    };

    const savedEartag = form.eartag.trim();
    const campName =
      camps.find((c) => c.id === form.campId)?.name || "";

    if (!navigator.onLine) {
      try {
        await enqueueSync("create", "animal", payload, photoFiles);
        rememberCampEartag(form.campId, savedEartag);
        persistDefaultsFromForm();
      } catch (err) {
        alert(err instanceof Error ? err.message : t("failedToCreateAnimal"));
        setLoading(false);
        return;
      }
      setAnimals((prev) => [
        ...prev,
        {
          id: `offline-${savedEartag}`,
          eartag: savedEartag,
          sex: form.sex,
          campId: form.campId,
          campName,
        },
      ]);
      setLoading(false);
      setSuccess({ eartag: savedEartag, animalId: null, offline: true });
      return;
    }

    let photoUrls: string[] = [];
    if (photoFiles.length > 0) {
      try {
        photoUrls = await uploadPhotos();
      } catch (err) {
        alert(err instanceof Error ? err.message : t("photoUploadFailed"));
        setLoading(false);
        return;
      }
    }

    const res = await fetch("/api/animals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        photoUrls,
        photoUrl: photoUrls[0] || null,
      }),
    });

    if (res.ok) {
      const animal = await res.json();
      rememberCampEartag(form.campId, savedEartag);
      persistDefaultsFromForm();
      setAnimals((prev) => [
        ...prev,
        {
          id: animal.id,
          eartag: savedEartag,
          sex: form.sex,
          campId: form.campId,
          campName,
        },
      ]);
      setLoading(false);
      setSuccess({ eartag: savedEartag, animalId: animal.id, offline: false });
    } else {
      const err = await res.json();
      alert(err.error || t("failedToCreateAnimal"));
      setLoading(false);
    }
  }

  async function onAddAnother() {
    const eartag = success?.eartag;
    setSuccess(null);
    if (eartag) await prepareNextAnimal(eartag);
  }

  function onBackToListing() {
    setSuccess(null);
    router.push("/animals");
  }

  const males = animals.filter((a) => a.sex === "MALE");
  const females = animals.filter((a) => a.sex === "FEMALE");

  function parentsForSelect(
    list: { id: string; eartag: string; campId: string; campName: string }[]
  ) {
    const campId = form.campId;
    const inCamp = list
      .filter((a) => campId && a.campId === campId)
      .sort((a, b) => a.eartag.localeCompare(b.eartag));
    const other = list
      .filter((a) => !campId || a.campId !== campId)
      .sort((a, b) => a.eartag.localeCompare(b.eartag));
    return { inCamp, other };
  }

  const sires = parentsForSelect(males);
  const dams = parentsForSelect(females);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/animals"
            className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("navAnimals")}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {t("registerAnimal")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg">
            {t("registerAnimalSubtitle")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form="register-animal-form"
            disabled={loading || !form.breed || !form.campId || !form.eartag}
            className="bg-foreground text-background hover:bg-foreground/90 min-w-[7rem]"
          >
            {loading ? t("saving") : t("save")}
          </Button>
        </div>
      </div>

      <form
        id="register-animal-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Card className="rounded-xl shadow-sm">
          <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
            <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("sectionIdentity")}
            </p>
            <Field
              label={t("camp")}
              required
              className="sm:col-span-2"
              hint={t("eartagAutoHint")}
            >
              <Select
                value={form.campId || undefined}
                onValueChange={(v) => {
                  void applyCampEartagSuggestion(v);
                }}
                required
              >
                <SelectTrigger autoFocus>
                  <SelectValue placeholder={t("selectCamp")} />
                </SelectTrigger>
                <SelectContent>
                  {camps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code ? `${c.code} · ${c.name}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label={t("eartag")}
              required
              className="sm:col-span-2"
              hint={
                lastEartag || form.eartag
                  ? [
                      lastEartag
                        ? t("eartagLastUsed", { tag: lastEartag })
                        : null,
                      form.eartag && !eartagManual
                        ? t("eartagSuggested", { tag: form.eartag })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
            >
              <Input
                id="eartag"
                value={form.eartag}
                onChange={(e) => {
                  setEartagManual(true);
                  setForm({ ...form, eartag: e.target.value });
                }}
                placeholder="e.g. MR-01-042"
                required
              />
            </Field>

            <Field
              label={t("breed")}
              required
              className="sm:col-span-2"
              hint={
                <Link
                  href="/settings/breeds"
                  className="text-primary hover:underline"
                >
                  {t("manageBreeds")}
                </Link>
              }
            >
              <Select
                value={form.breed || undefined}
                onValueChange={(v) => setForm({ ...form, breed: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectBreed")} />
                </SelectTrigger>
                <SelectContent>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("sex")} required className="sm:col-span-2">
              <ChoicePills
                value={form.sex as "MALE" | "FEMALE" | "UNKNOWN"}
                onChange={(v) =>
                  setForm({
                    ...form,
                    sex: v,
                    isCastrated: v === "MALE" ? form.isCastrated : false,
                    isPregnant: v === "FEMALE" ? form.isPregnant : false,
                  })
                }
                options={[
                  { value: "MALE", label: t("male") },
                  { value: "FEMALE", label: t("female") },
                  { value: "UNKNOWN", label: t("unknownSex") },
                ]}
              />
            </Field>

            {form.sex === "MALE" && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isCastrated}
                  onChange={(e) =>
                    setForm({ ...form, isCastrated: e.target.checked })
                  }
                />
                {t("castrated")}
              </label>
            )}
            {form.sex === "FEMALE" && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isPregnant}
                  onChange={(e) =>
                    setForm({ ...form, isPregnant: e.target.checked })
                  }
                />
                {t("pregnant")}
              </label>
            )}

            <Field label={t("source")} className="sm:col-span-2">
              <ChoicePills
                value={
                  form.acquisitionType as "BORN_ON_FARM" | "PURCHASED" | "GIFT"
                }
                onChange={(v) =>
                  setForm({
                    ...form,
                    acquisitionType: v,
                    acquisitionDate:
                      v === "BORN_ON_FARM" ? "" : form.acquisitionDate,
                  })
                }
                options={[
                  { value: "BORN_ON_FARM", label: t("bornOnFarm") },
                  { value: "PURCHASED", label: t("purchased") },
                  { value: "GIFT", label: t("gift") },
                ]}
              />
            </Field>

            {isBornOnFarm && (
              <>
                <Field label={t("dob")} className="sm:col-span-2">
                  <Input
                    type="date"
                    value={form.dob}
                    onChange={(e) =>
                      setForm({ ...form, dob: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("sire")} hint={t("sireMaleOnly")}>
                  <Select
                    value={form.sireId || "__none__"}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        sireId: v === "__none__" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("none")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("none")}</SelectItem>
                      {sires.inCamp.length > 0 && (
                        <>
                          <SelectItem value="__hdr_sire_camp__" disabled>
                            — {t("parentsInCamp")} —
                          </SelectItem>
                          {sires.inCamp.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.eartag}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {sires.other.length > 0 && (
                        <>
                          <SelectItem value="__hdr_sire_other__" disabled>
                            — {t("parentsOtherCamps")} —
                          </SelectItem>
                          {sires.other.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.eartag}
                              {a.campName ? ` · ${a.campName}` : ""}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t("dam")} hint={t("damFemaleOnly")}>
                  <Select
                    value={form.damId || "__none__"}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        damId: v === "__none__" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("none")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("none")}</SelectItem>
                      {dams.inCamp.length > 0 && (
                        <>
                          <SelectItem value="__hdr_dam_camp__" disabled>
                            — {t("parentsInCamp")} —
                          </SelectItem>
                          {dams.inCamp.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.eartag}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {dams.other.length > 0 && (
                        <>
                          <SelectItem value="__hdr_dam_other__" disabled>
                            — {t("parentsOtherCamps")} —
                          </SelectItem>
                          {dams.other.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.eartag}
                              {a.campName ? ` · ${a.campName}` : ""}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}

            {isExternal && (
              <>
                <Field
                  label={t("acquisitionDate")}
                  hint={
                    form.acquisitionType === "PURCHASED"
                      ? t("purchaseDateHint")
                      : t("giftDateHint")
                  }
                  className="sm:col-span-2"
                >
                  <Input
                    type="date"
                    value={form.acquisitionDate}
                    onChange={(e) =>
                      setForm({ ...form, acquisitionDate: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("dob")} className="sm:col-span-2">
                  <Input
                    type="date"
                    value={form.dob}
                    onChange={(e) =>
                      setForm({ ...form, dob: e.target.value })
                    }
                  />
                </Field>
                {!form.dob && (
                  <>
                    <Field label={t("ageYears")}>
                      <Input
                        type="number"
                        min={0}
                        value={form.ageYears}
                        onChange={(e) =>
                          setForm({ ...form, ageYears: e.target.value })
                        }
                        placeholder="0"
                      />
                    </Field>
                    <Field label={t("ageMonthsPart")}>
                      <Input
                        type="number"
                        min={0}
                        max={11}
                        value={form.ageMonthsPart}
                        onChange={(e) =>
                          setForm({ ...form, ageMonthsPart: e.target.value })
                        }
                        placeholder="0"
                      />
                    </Field>
                  </>
                )}
              </>
            )}

            <Field
              label={t("owner")}
              hint={t("defaultOwner")}
              className="sm:col-span-2"
            >
              <Select
                value={form.ownerId || undefined}
                onValueChange={(v) => setForm({ ...form, ownerId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("defaultOwner")} />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                      {o.role === "OWNER" ? ` (${t("roleOWNER")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <button
              type="button"
              className="flex w-full items-center justify-between py-1 text-left"
              onClick={() => setShowMore(!showMore)}
            >
              <span className="text-sm font-medium">{t("sectionPhotosNotes")}</span>
              {showMore ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showMore && (
              <div className="mt-4 space-y-4 border-t pt-4">
                <Field label={t("photos")} hint={t("photosHelperText")}>
                  <PhotoSourcePicker
                    onFiles={(files) =>
                      setPhotoFiles((prev) => [...prev, ...files])
                    }
                  />
                  {photoFiles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {photoFiles.map((file, i) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="group relative h-20 w-20 overflow-hidden rounded-lg bg-muted"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photoPreviewUrls[i]}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Field>
                <Field label={t("colorMarkings")}>
                  <Input
                    value={form.colorMarkings}
                    onChange={(e) =>
                      setForm({ ...form, colorMarkings: e.target.value })
                    }
                    placeholder={t("colorMarkingsPlaceholder")}
                  />
                </Field>
                <Field label={t("notes")}>
                  <Textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    rows={3}
                  />
                </Field>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex sticky bottom-0 z-10 items-center gap-3 border-t bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            type="submit"
            disabled={loading || !form.breed || !form.campId || !form.eartag}
            className="min-w-[10rem] bg-foreground text-background hover:bg-foreground/90"
          >
            {loading ? t("saving") : t("registerAnimal")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
        </div>
      </form>

      {success && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="animal-added-title"
            className="relative w-full max-w-md rounded-2xl border bg-background p-6 pt-8 shadow-lg"
          >
            <button
              type="button"
              onClick={() => void onAddAnother()}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label={t("cancel")}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" strokeWidth={2} />
              </div>
              <h2 id="animal-added-title" className="text-xl font-semibold tracking-tight">
                {t("animalAddedTitle")}
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                {success.offline
                  ? t("animalAddedOfflineMessage", { eartag: success.eartag })
                  : t("animalAddedMessage", { eartag: success.eartag })}
              </p>
              <div className="flex w-full flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onBackToListing}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("backToAnimalsListing")}
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                  onClick={() => void onAddAnother()}
                >
                  {t("addAnotherAnimal")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
