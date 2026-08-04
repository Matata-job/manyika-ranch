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

export interface AnimalPhoto {
  id: string;
  url: string;
  caption: string | null;
  takenAt: string;
  uploadedBy?: { name: string } | null;
}

interface AnimalPhotoGalleryProps {
  animalId: string;
  initialPhotos?: AnimalPhoto[];
  coverUrl?: string | null;
  canEdit?: boolean;
  onPhotosChange?: () => void;
  /** Optional eartag for download filenames */
  eartag?: string | null;
}

export function AnimalPhotoGallery({
  animalId,
  initialPhotos = [],
  coverUrl,
  canEdit = false,
  onPhotosChange,
  eartag,
}: AnimalPhotoGalleryProps) {
  const t = useT();
  const [photos, setPhotos] = useState<AnimalPhoto[]>(initialPhotos);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const previewUrls = useObjectUrls(newFiles);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  const displayPhotos =
    photos.length > 0
      ? photos
      : coverUrl
        ? [
            {
              id: "cover",
              url: coverUrl,
              caption: null,
              takenAt: new Date().toISOString(),
            },
          ]
        : [];

  const cover = displayPhotos[0];
  const active =
    lightboxIndex !== null ? displayPhotos[lightboxIndex] : null;

  async function uploadFile(file: File): Promise<string> {
    return uploadPhotoFile(file, "animals", t("photoUploadFailed"));
  }

  function onPickFiles(files: File[]) {
    setNewFiles((prev) => [...prev, ...files]);
  }

  async function addPhotos() {
    if (newFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of newFiles) {
        const url = await uploadFile(file);
        const res = await fetch(`/api/animals/${animalId}/photos`, {
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

  const downloadStem = eartag
    ? `animal-${eartag.replace(/[^\w.-]+/g, "_")}`
    : `animal-${animalId.slice(0, 8)}`;

  return (
    <div className="space-y-4">
      <div
        className="group relative flex h-48 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-muted md:w-48"
        onClick={() => cover && setLightboxIndex(0)}
      >
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover.url}
              alt="Animal"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
              <ZoomIn className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            {displayPhotos.length > 1 && (
              <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                {displayPhotos.length} {t("photos").toLowerCase()}
              </span>
            )}
          </>
        ) : (
          <span className="text-6xl">🐄</span>
        )}
      </div>

      {displayPhotos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {displayPhotos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="h-16 w-16 overflow-hidden rounded-md border-2 border-transparent transition-colors hover:border-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="max-w-md space-y-2">
          <Label>{t("addPhotos")}</Label>
          <PhotoSourcePicker onFiles={onPickFiles} disabled={uploading} />
          {newFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {newFiles.map((f, i) => (
                <div
                  key={`${f.name}-${f.size}-${f.lastModified}`}
                  className="relative h-14 w-14 overflow-hidden rounded bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrls[i]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
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

      {active && lightboxIndex !== null && (
        <PhotoLightbox
          open
          onClose={() => setLightboxIndex(null)}
          src={active.url}
          downloadName={`${downloadStem}-${lightboxIndex + 1}`}
          downloadLabel={t("downloadPhoto")}
          zoomHint={t("photoZoomHint")}
          sizeLabel={t("photoActualSize")}
          showNav={displayPhotos.length > 1}
          onPrev={() =>
            setLightboxIndex(
              (lightboxIndex - 1 + displayPhotos.length) % displayPhotos.length
            )
          }
          onNext={() =>
            setLightboxIndex((lightboxIndex + 1) % displayPhotos.length)
          }
          footer={
            <>
              <p>{formatDate(active.takenAt)}</p>
              {active.caption && (
                <p className="text-gray-300">{active.caption}</p>
              )}
              {active.uploadedBy && (
                <p className="text-xs text-gray-400">
                  {active.uploadedBy.name}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {lightboxIndex + 1} / {displayPhotos.length}
              </p>
            </>
          }
        />
      )}
    </div>
  );
}
