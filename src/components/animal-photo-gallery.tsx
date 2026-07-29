"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, X, ZoomIn } from "lucide-react";

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
}

export function AnimalPhotoGallery({
  animalId,
  initialPhotos = [],
  coverUrl,
  canEdit = false,
  onPhotosChange,
}: AnimalPhotoGalleryProps) {
  const [photos, setPhotos] = useState<AnimalPhoto[]>(initialPhotos);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  const displayPhotos =
    photos.length > 0
      ? photos
      : coverUrl
        ? [{ id: "cover", url: coverUrl, caption: null, takenAt: new Date().toISOString() }]
        : [];

  const cover = displayPhotos[0];

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "animals");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }
    const { url } = await res.json();
    return url;
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
      alert(err instanceof Error ? err.message : "Failed to upload photos");
    } finally {
      setUploading(false);
    }
  }

  function openLightbox(index: number) {
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function prevPhoto() {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + displayPhotos.length) % displayPhotos.length);
  }

  function nextPhoto() {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % displayPhotos.length);
  }

  return (
    <div className="space-y-4">
      <div
        className="w-full md:w-48 h-48 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer group relative"
        onClick={() => cover && openLightbox(0)}
      >
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover.url} alt="Animal" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {displayPhotos.length > 1 && (
              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                {displayPhotos.length} photos
              </span>
            )}
          </>
        ) : (
          <span className="text-6xl">🐄</span>
        )}
      </div>

      {displayPhotos.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {displayPhotos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => openLightbox(i)}
              className="w-16 h-16 rounded-md overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="space-y-2 max-w-md">
          <Label>Add photos</Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
          />
          {newFiles.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {newFiles.map((f, i) => (
                <div key={i} className="w-14 h-14 rounded overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
          <Button size="sm" onClick={addPhotos} disabled={uploading || newFiles.length === 0}>
            <Plus className="h-4 w-4 mr-1" />
            {uploading ? "Uploading..." : `Upload ${newFiles.length || ""} photo${newFiles.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {lightboxIndex !== null && displayPhotos[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={closeLightbox}
          >
            <X className="h-8 w-8" />
          </button>

          {displayPhotos.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 text-white hover:text-gray-300 p-2"
                onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              >
                <ChevronLeft className="h-10 w-10" />
              </button>
              <button
                type="button"
                className="absolute right-4 text-white hover:text-gray-300 p-2"
                onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              >
                <ChevronRight className="h-10 w-10" />
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayPhotos[lightboxIndex].url}
              alt=""
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
            <div className="mt-3 text-center text-white text-sm">
              <p>{formatDate(displayPhotos[lightboxIndex].takenAt)}</p>
              {displayPhotos[lightboxIndex].caption && (
                <p className="text-gray-300">{displayPhotos[lightboxIndex].caption}</p>
              )}
              {displayPhotos[lightboxIndex].uploadedBy && (
                <p className="text-gray-400 text-xs">Added by {displayPhotos[lightboxIndex].uploadedBy!.name}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                {lightboxIndex + 1} / {displayPhotos.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
