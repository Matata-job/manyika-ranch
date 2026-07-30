"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, X, ZoomIn } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { PhotoSourcePicker } from "@/components/photo-source-picker";

export interface CampPhoto {
  id: string;
  url: string;
  caption: string | null;
  takenAt: string;
  uploadedBy?: { name: string } | null;
}

interface CampPhotoGalleryProps {
  campId: string;
  initialPhotos?: CampPhoto[];
  logoUrl?: string | null;
  canEdit?: boolean;
  onPhotosChange?: () => void;
  onLogoChange?: (url: string | null) => void;
}

export function CampPhotoGallery({
  campId,
  initialPhotos = [],
  logoUrl,
  canEdit = false,
  onPhotosChange,
  onLogoChange,
}: CampPhotoGalleryProps) {
  const t = useT();
  const [photos, setPhotos] = useState<CampPhoto[]>(initialPhotos);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  async function uploadFile(file: File, folder: string): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || t("photoUploadFailed"));
    }
    const { url } = await res.json();
    return url;
  }

  async function addPhotos() {
    if (newFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of newFiles) {
        const url = await uploadFile(file, "camps");
        const res = await fetch(`/api/camps/${campId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, takenAt: new Date().toISOString() }),
        });
        if (res.ok) {
          const photo = await res.json();
          setPhotos((prev) => [photo, ...prev]);
        }
      }
      setNewFiles([]);
      onPhotosChange?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("photoUploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file) return;
    setLogoUploading(true);
    try {
      const url = await uploadFile(file, "camp-logos");
      const res = await fetch(`/api/camps/${campId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("failedToSave"));
      }
      onLogoChange?.(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("photoUploadFailed"));
    } finally {
      setLogoUploading(false);
    }
  }

  async function clearLogo() {
    const res = await fetch(`/api/camps/${campId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl: null }),
    });
    if (res.ok) onLogoChange?.(null);
  }

  async function deletePhoto(photoId: string) {
    if (!confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/camps/${campId}/photos/${photoId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      onPhotosChange?.();
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>{t("campLogo")}</Label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={t("campLogo")}
              className="h-20 w-20 rounded-lg border object-cover bg-muted"
            />
          ) : (
            <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center text-xs text-muted-foreground">
              {t("noLogo")}
            </div>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <PhotoSourcePicker
                multiple={false}
                disabled={logoUploading}
                onFiles={(files) => uploadLogo(files[0] || null)}
              />
              {logoUrl && (
                <Button type="button" size="sm" variant="ghost" onClick={clearLogo}>
                  {t("removeLogo")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label>{t("campPhotos")}</Label>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <PhotoSourcePicker
                disabled={uploading}
                onFiles={(files) =>
                  setNewFiles((prev) => [...prev, ...files])
                }
              />
              <Button
                size="sm"
                onClick={addPhotos}
                disabled={uploading || newFiles.length === 0}
              >
                <Plus className="h-4 w-4 mr-1" />
                {uploading
                  ? t("saving")
                  : t("uploadPhotos", { n: newFiles.length || "" })}
              </Button>
            </div>
          )}
        </div>
        {canEdit && newFiles.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {newFiles.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="relative w-14 h-14 rounded overflow-hidden bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(f)}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white"
                  onClick={() =>
                    setNewFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noCampPhotos")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((p, i) => (
              <div key={p.id} className="relative group rounded-lg overflow-hidden border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.caption || t("campPhotos")}
                  className="h-32 w-full object-cover cursor-pointer"
                  onClick={() => setLightboxIndex(i)}
                />
                <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-xs px-2 py-1 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>{formatDate(p.takenAt)}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setLightboxIndex(i)}>
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    {canEdit && (
                      <button type="button" onClick={() => deletePhoto(p.id)}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="absolute left-4 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(
                (lightboxIndex - 1 + photos.length) % photos.length
              );
            }}
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[lightboxIndex].url}
            alt=""
            className="max-h-[85vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute right-4 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((lightboxIndex + 1) % photos.length);
            }}
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </div>
      )}
    </div>
  );
}
