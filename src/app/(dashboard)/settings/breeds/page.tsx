"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { PhotoSourcePicker } from "@/components/photo-source-picker";
import { uploadPhotoFile } from "@/lib/client/upload-photo";
import { useObjectUrls } from "@/hooks/use-object-urls";

interface Breed {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
}

export default function BreedsPage() {
  const t = useT();
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoPreview = useObjectUrls(photoFile ? [photoFile] : []);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadBreeds() {
    const res = await fetch("/api/breeds");
    if (res.ok) setBreeds(await res.json());
  }

  useEffect(() => {
    loadBreeds();
  }, []);

  async function addBreed(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    let photoUrl: string | null = null;
    if (photoFile) {
      try {
        photoUrl = await uploadPhotoFile(photoFile, "breeds", t("failedToSave"));
      } catch (err) {
        setSaving(false);
        alert(err instanceof Error ? err.message : t("failedToSave"));
        return;
      }
    }

    const res = await fetch("/api/breeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        photoUrl,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert((err as { error?: string }).error || t("failedToSave"));
      return;
    }
    setForm({ name: "", description: "" });
    setPhotoFile(null);
    setShowForm(false);
    loadBreeds();
  }

  async function replaceBreedPhoto(breedId: string, file: File) {
    setUpdatingId(breedId);
    try {
      const photoUrl = await uploadPhotoFile(file, "breeds", t("failedToSave"));
      const res = await fetch(`/api/breeds/${breedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error || t("failedToSave"));
        return;
      }
      await loadBreeds();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("failedToSave"));
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeBreedPhoto(breedId: string) {
    if (!window.confirm(t("removeBreedPhoto") + "?")) return;
    setUpdatingId(breedId);
    const res = await fetch(`/api/breeds/${breedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl: null }),
    });
    setUpdatingId(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert((err as { error?: string }).error || t("failedToSave"));
      return;
    }
    loadBreeds();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/animals/new"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToRegister")}
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("breedsTitle")}</h1>
          <p className="text-muted-foreground">{t("breedsSubtitle")}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("addBreed")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t("newBreed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addBreed} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("breedName")} *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Boran, Sahiwal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("breedDescription")}</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder={t("breedDescriptionPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("breedPhoto")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("breedPhotoHelp")}
                </p>
                <PhotoSourcePicker
                  multiple={false}
                  onFiles={(files) => setPhotoFile(files[0] || null)}
                />
                {photoFile && photoPreview[0] && (
                  <div className="relative mt-2 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview[0]}
                      alt=""
                      className="h-24 w-24 rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoFile(null)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-black/60 p-0.5 text-white"
                      aria-label={t("cancel")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <Button type="submit" disabled={saving || !form.name.trim()}>
                {saving ? t("saving") : t("addBreed")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!showForm && breeds.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("breedsCount", { n: breeds.length })}
        </p>
      )}

      {breeds.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noBreeds")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {breeds.map((b) => (
            <div
              key={b.id}
              className="flex flex-col gap-2 rounded-xl border bg-card overflow-hidden"
            >
              <div className="relative">
                <label
                  className={`relative block aspect-square w-full overflow-hidden bg-muted ${
                    updatingId === b.id
                      ? "pointer-events-none opacity-60"
                      : "cursor-pointer"
                  }`}
                >
                  {b.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-muted-foreground">
                      {b.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*,image/heic,image/heif,.heic,.heif"
                    className="sr-only"
                    disabled={updatingId === b.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void replaceBreedPhoto(b.id, file);
                    }}
                  />
                </label>
                {b.photoUrl && (
                  <button
                    type="button"
                    disabled={updatingId === b.id}
                    onClick={() => void removeBreedPhoto(b.id)}
                    className="absolute right-2 top-2 rounded-md bg-black/60 p-1 text-white"
                    aria-label={t("removeBreedPhoto")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="px-3 pb-3 text-base font-semibold leading-tight line-clamp-2">
                {b.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
