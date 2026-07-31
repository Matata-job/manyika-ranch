"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, ChevronDown, ChevronRight, X } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { parseAnimalsList } from "@/lib/animals-api";
import { PhotoSourcePicker } from "@/components/photo-source-picker";
import { cn } from "@/lib/utils";
import { useObjectUrls } from "@/hooks/use-object-urls";
import { rememberCampEartag, suggestNextEartag } from "@/lib/eartag";

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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string; role?: string }[]>([]);
  const [breeds, setBreeds] = useState<{ id: string; name: string }[]>([]);
  const [animals, setAnimals] = useState<{ id: string; eartag: string; sex: string }[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const photoPreviewUrls = useObjectUrls(photoFiles);
  const [eartagManual, setEartagManual] = useState(false);
  const [lastEartag, setLastEartag] = useState<string | null>(null);
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

  async function applyCampEartagSuggestion(campId: string) {
    const camp = camps.find((c) => c.id === campId);
    let suggested: string | null = null;
    let last: string | null = null;

    try {
      const res = await fetch(`/api/camps/${campId}/next-eartag`);
      if (res.ok) {
        const data = await res.json();
        suggested = data.suggested || null;
        last = data.lastEartag || null;
      }
    } catch {
      /* offline */
    }

    if (!suggested) {
      const { recallCampEartag } = await import("@/lib/eartag");
      const remembered = recallCampEartag(campId);
      suggested = suggestNextEartag({
        campCode: camp?.code,
        existingEartags: [
          ...animals.map((a) => a.eartag),
          ...(remembered ? [remembered] : []),
        ],
      });
      last = last || remembered;
    }

    setLastEartag(last);
    setForm((prev) => {
      const shouldFill = !eartagManual || !prev.eartag.trim();
      return {
        ...prev,
        campId,
        eartag: shouldFill && suggested ? suggested : prev.eartag,
      };
    });
  }

  useEffect(() => {
    const CACHE_KEY = "register-lookups-v1";

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
        parseAnimalsList<{ id: string; eartag: string; sex: string }>(a).map(
          (row) => ({
            id: row.id,
            eartag: row.eartag,
            sex: row.sex,
          })
        )
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
      const cached = localStorage.getItem(CACHE_KEY);
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
            CACHE_KEY,
            JSON.stringify({ camps: c, owners: o, breeds: b, animals: a })
          );
        } catch {
          // quota / private mode
        }
      })
      .catch(() => {
        // keep cached lookups if online fetch fails
      });
  }, []);

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const file of photoFiles) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("photoUploadFailed"));
      }
      const { url } = await res.json();
      urls.push(url);
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.eartag.trim() || !form.breed || !form.campId) {
      alert(t("eartagBreedRequired"));
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

    if (!navigator.onLine) {
      try {
        await enqueueSync("create", "animal", payload, photoFiles);
        rememberCampEartag(form.campId, form.eartag.trim());
      } catch (err) {
        alert(err instanceof Error ? err.message : t("failedToCreateAnimal"));
        setLoading(false);
        return;
      }
      alert(
        photoFiles.length > 0
          ? t("savedOfflineWithPhotos", { n: photoFiles.length })
          : t("savedOffline")
      );
      router.push("/animals");
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
      rememberCampEartag(form.campId, form.eartag.trim());
      router.push(`/animals/${animal.id}`);
    } else {
      const err = await res.json();
      alert(err.error || t("failedToCreateAnimal"));
      setLoading(false);
    }
  }

  const males = animals.filter((a) => a.sex === "MALE");
  const females = animals.filter((a) => a.sex === "FEMALE");

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-8">
      <div>
        <Link
          href="/animals"
          className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("navAnimals")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("registerAnimal")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("registerAnimalSubtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
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

            <Field label={t("sex")} required>
              <Select
                value={form.sex}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    sex: v,
                    isCastrated: v === "MALE" ? form.isCastrated : false,
                    isPregnant: v === "FEMALE" ? form.isPregnant : false,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">{t("male")}</SelectItem>
                  <SelectItem value="FEMALE">{t("female")}</SelectItem>
                  <SelectItem value="UNKNOWN">{t("unknownSex")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("source")} className="sm:col-span-2">
              <Select
                value={form.acquisitionType}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    acquisitionType: v,
                    acquisitionDate:
                      v === "BORN_ON_FARM" ? "" : form.acquisitionDate,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BORN_ON_FARM">{t("bornOnFarm")}</SelectItem>
                  <SelectItem value="PURCHASED">{t("purchased")}</SelectItem>
                  <SelectItem value="GIFT">{t("gift")}</SelectItem>
                </SelectContent>
              </Select>
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
                      {males.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.eartag}
                        </SelectItem>
                      ))}
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
                      {females.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.eartag}
                        </SelectItem>
                      ))}
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

            {form.sex === "MALE" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  className="rounded border"
                  checked={form.isCastrated}
                  onChange={(e) =>
                    setForm({ ...form, isCastrated: e.target.checked })
                  }
                />
                {t("castrated")}
              </label>
            )}
            {form.sex === "FEMALE" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  className="rounded border"
                  checked={form.isPregnant}
                  onChange={(e) =>
                    setForm({ ...form, isPregnant: e.target.checked })
                  }
                />
                {t("pregnant")}
              </label>
            )}
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
            className="min-w-[10rem]"
          >
            {loading ? t("saving") : t("registerAnimal")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
