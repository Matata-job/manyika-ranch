"use client";

import { useState } from "react";
import { ZoomIn } from "lucide-react";
import { PhotoLightbox } from "@/components/zoomable-photo-lightbox";
import { useT } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  downloadName?: string;
  className?: string;
  imageClassName?: string;
};

export function ZoomableCampImage({
  src,
  alt,
  downloadName = "camp-image",
  className,
  imageClassName,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        aria-label={alt || t("campPhotos")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || ""}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30"
          aria-hidden
        >
          <ZoomIn className="h-5 w-5 text-white opacity-0 drop-shadow-md transition-opacity group-hover:opacity-100 sm:h-6 sm:w-6" />
        </span>
      </button>

      <PhotoLightbox
        open={open}
        onClose={() => setOpen(false)}
        src={src}
        downloadName={downloadName}
        downloadLabel={t("downloadPhoto")}
        zoomHint={t("photoZoomHint")}
        sizeLabel={t("photoActualSize")}
      />
    </>
  );
}
