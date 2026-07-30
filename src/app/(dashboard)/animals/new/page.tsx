"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enqueueSync } from "@/lib/sync/offline-db";
import { X } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { PhotoSourcePicker } from "@/components/photo-source-picker";

export default function NewAnimalPage() {
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [breeds, setBreeds] = useState<{ id: string; name: string }[]>([]);
  const [animals, setAnimals] = useState<{ id: string; eartag: string }[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
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
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/camps").then((r) => r.json()),
      fetch("/api/owners").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/breeds").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/animals?status=ACTIVE").then((r) => r.json()),
    ]).then(([c, o, b, a]) => {
      setCamps(c);
      setOwners(o);
      setBreeds(b);
      setAnimals(a);
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
    setLoading(true);

    const payload = {
      ...form,
      sireId: form.sireId || null,
      damId: form.damId || null,
      ownerId: form.ownerId || undefined,
      dob: form.dob || null,
      isCastrated: form.sex === "MALE" ? form.isCastrated : false,
      isPregnant: form.sex === "FEMALE" ? form.isPregnant : false,
      ageYears: form.dob ? undefined : form.ageYears ? Number(form.ageYears) : 0,
      ageMonthsPart: form.dob ? undefined : form.ageMonthsPart ? Number(form.ageMonthsPart) : 0,
    };

    if (!navigator.onLine) {
      await enqueueSync("create", "animal", payload);
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
      body: JSON.stringify({ ...payload, photoUrls, photoUrl: photoUrls[0] || null }),
    });

    if (res.ok) {
      const animal = await res.json();
      router.push(`/animals/${animal.id}`);
    } else {
      const err = await res.json();
      alert(err.error || t("failedToCreateAnimal"));
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle>{t("registerAnimal")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eartag">{t("eartag")} *</Label>
              <Input id="eartag" value={form.eartag} onChange={(e) => setForm({ ...form, eartag: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>{t("breed")} *</Label>
              <Select value={form.breed} onValueChange={(v) => setForm({ ...form, breed: v })} required>
                <SelectTrigger><SelectValue placeholder={t("selectBreed")} /></SelectTrigger>
                <SelectContent>
                  {breeds.map((b) => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Link href="/settings/breeds" className="text-xs text-primary hover:underline">
                {t("manageBreeds")}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("sex")}</Label>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">{t("male")}</SelectItem>
                  <SelectItem value="FEMALE">{t("female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">{t("dob")}</Label>
              <Input id="dob" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </div>
          </div>

          {form.sex === "MALE" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isCastrated}
                onChange={(e) => setForm({ ...form, isCastrated: e.target.checked })}
              />
              {t("castrated")}
            </label>
          )}

          {form.sex === "FEMALE" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPregnant}
                onChange={(e) => setForm({ ...form, isPregnant: e.target.checked })}
              />
              {t("pregnant")}
            </label>
          )}

          {!form.dob && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("ageYears")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.ageYears}
                  onChange={(e) => setForm({ ...form, ageYears: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("ageMonthsPart")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={11}
                  value={form.ageMonthsPart}
                  onChange={(e) => setForm({ ...form, ageMonthsPart: e.target.value })}
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {t("ageHelperText")}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("camp")} *</Label>
              <Select value={form.campId} onValueChange={(v) => setForm({ ...form, campId: v })} required>
                <SelectTrigger><SelectValue placeholder={t("selectCamp")} /></SelectTrigger>
                <SelectContent>
                  {camps.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("owner")}</Label>
              <Select value={form.ownerId} onValueChange={(v) => setForm({ ...form, ownerId: v })}>
                <SelectTrigger><SelectValue placeholder={t("defaultOwner")} /></SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("sire")}</Label>
              <Select value={form.sireId} onValueChange={(v) => setForm({ ...form, sireId: v })}>
                <SelectTrigger><SelectValue placeholder={t("none")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("none")}</SelectItem>
                  {animals.map((a) => <SelectItem key={a.id} value={a.id}>{a.eartag}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("dam")}</Label>
              <Select value={form.damId} onValueChange={(v) => setForm({ ...form, damId: v })}>
                <SelectTrigger><SelectValue placeholder={t("none")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("none")}</SelectItem>
                  {animals.map((a) => <SelectItem key={a.id} value={a.id}>{a.eartag}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("photos")}</Label>
            <PhotoSourcePicker
              onFiles={(files) =>
                setPhotoFiles((prev) => [...prev, ...files])
              }
            />
            {photoFiles.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {photoFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t("photosHelperText")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="colorMarkings">{t("colorMarkings")}</Label>
            <Input id="colorMarkings" value={form.colorMarkings} onChange={(e) => setForm({ ...form, colorMarkings: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !form.breed}>
              {loading ? t("saving") : t("registerAnimal")}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>{t("cancel")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
