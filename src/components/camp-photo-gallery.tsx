"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { Plus, X, ZoomIn } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { PhotoSourcePicker } from "@/components/photo-source-picker";
import { useObjectUrls } from "@/hooks/use-object-urls";
import { uploadPhotoFile } from "@/lib/client/upload-photo";
import { PhotoLightbox } from "@/components/zoomable-photo-lightbox";
import { ZoomableCampImage } from "@/components/zoomable-camp-image";

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
  /** Used for download filenames (e.g. camp code). */
  campLabel?: string;
  canEdit?: boolean;
  onPhotosChange?: () => void;
  onLogoChange?: (url: string | null) => void;
}

export function CampPhotoGallery({
  campId,
  initialPhotos = [],
  logoUrl,
  campLabel,
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
  const previewUrls = useObjectUrls(newFiles);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  async function uploadFile(file: File, folder: string): Promise<string> {
    return uploadPhotoFile(file, folder, t("photoUploadFailed"));
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

  const downloadStem = (campLabel || campId).replace(/[^\w.-]+/g, "-");
  const activePhoto =
    lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>{t("campLogo")}</Label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <ZoomableCampImage
              src={logoUrl}
              alt={t("campLogo")}
              downloadName={`${downloadStem}-logo`}
              className="h-20 w-20 rounded-lg"
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
                key={`${f.name}-${f.size}-${f.lastModified}`}
                className="relative w-14 h-14 rounded overflow-hidden bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrls[i]}
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

      {activePhoto && lightboxIndex !== null && (
        <PhotoLightbox
          open
          onClose={() => setLightboxIndex(null)}
          src={activePhoto.url}
          downloadName={`${downloadStem}-photo-${lightboxIndex + 1}`}
          downloadLabel={t("downloadPhoto")}
          zoomHint={t("photoZoomHint")}
          sizeLabel={t("photoActualSize")}
          showNav={photos.length > 1}
          onPrev={() =>
            setLightboxIndex(
              (lightboxIndex - 1 + photos.length) % photos.length
            )
          }
          onNext={() =>
            setLightboxIndex((lightboxIndex + 1) % photos.length)
          }
          footer={
            <>
              <p>{formatDate(activePhoto.takenAt)}</p>
              {activePhoto.caption && (
                <p className="text-gray-300">{activePhoto.caption}</p>
              )}
              {activePhoto.uploadedBy && (
                <p className="text-xs text-gray-400">
                  {activePhoto.uploadedBy.name}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {lightboxIndex + 1} / {photos.length}
              </p>
            </>
          }
        />
      )}
    </div>
  );
}
