"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type Props = {
  src: string;
  alt?: string;
  downloadName?: string;
  downloadLabel: string;
  zoomHint: string;
  sizeLabel?: string;
  className?: string;
};

/**
 * Pinch / wheel / double-tap zoom + pan, with download of the original file.
 */
export function ZoomablePhoto({
  src,
  alt = "",
  downloadName = "animal-photo.jpg",
  downloadLabel,
  zoomHint,
  sizeLabel,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [fileBytes, setFileBytes] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null
  );
  const scaleRef = useRef(scale);
  const txRef = useRef(tx);
  const tyRef = useRef(ty);
  scaleRef.current = scale;
  txRef.current = tx;
  tyRef.current = ty;

  const resetView = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  useEffect(() => {
    resetView();
    setNatural(null);
    setFileBytes(null);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src, { mode: "cors" });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (!cancelled) setFileBytes(blob.size);
      } catch {
        // Cross-origin without CORS — size unknown until download attempt
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, resetView]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStart.current = { dist, scale: scaleRef.current };
      panStart.current = null;
    } else if (pointers.current.size === 1 && scaleRef.current > 1) {
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: txRef.current,
        ty: tyRef.current,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const next = Math.min(
        5,
        Math.max(1, (pinchStart.current.scale * dist) / pinchStart.current.dist)
      );
      setScale(next);
      if (next <= 1.02) {
        setTx(0);
        setTy(0);
      }
      return;
    }

    if (pointers.current.size === 1 && panStart.current && scaleRef.current > 1) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTx(panStart.current.tx + dx);
      setTy(panStart.current.ty + dy);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale((s) => {
      const next = Math.min(5, Math.max(1, s + delta));
      if (next <= 1) {
        setTx(0);
        setTy(0);
      }
      return next;
    });
  }

  function onDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (scale > 1.1) {
      resetView();
    } else {
      setScale(2.5);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(src, { mode: "cors" });
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      setFileBytes(blob.size);
      const ext =
        blob.type.split("/")[1]?.replace("jpeg", "jpg") ||
        downloadName.split(".").pop() ||
        "jpg";
      const name = downloadName.includes(".")
        ? downloadName
        : `${downloadName}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open original (user can save from browser)
      window.open(src, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  const sizeText = [
    natural ? `${natural.w}×${natural.h}px` : null,
    fileBytes != null ? formatBytes(fileBytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("flex w-full flex-col items-center gap-3", className)}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setScale((s) => Math.min(5, s + 0.5));
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-sm text-white hover:bg-white/25"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setScale((s) => {
              const next = Math.max(1, s - 0.5);
              if (next <= 1) {
                setTx(0);
                setTy(0);
              }
              return next;
            });
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-sm text-white hover:bg-white/25"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        {scale > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetView();
            }}
            className="inline-flex h-10 items-center rounded-lg bg-white/15 px-3 text-sm text-white hover:bg-white/25"
          >
            {Math.round(scale * 100)}%
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void download();
          }}
          disabled={downloading}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-sm text-white hover:bg-white/25 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloadLabel}
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative max-h-[70vh] w-full max-w-4xl touch-none overflow-hidden rounded-lg"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="mx-auto max-h-[70vh] max-w-full select-none object-contain"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "center center",
            transition:
              pointers.current.size === 0 ? "transform 0.12s ease-out" : undefined,
          }}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
      </div>

      <div className="space-y-0.5 text-center text-xs text-stone-300">
        {sizeText && (
          <p>
            {sizeLabel ? `${sizeLabel}: ` : ""}
            {sizeText}
          </p>
        )}
        <p className="text-stone-500">{zoomHint}</p>
      </div>
    </div>
  );
}

type LightboxProps = {
  open: boolean;
  onClose: () => void;
  src: string;
  downloadName?: string;
  downloadLabel: string;
  zoomHint: string;
  sizeLabel: string;
  footer?: React.ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  showNav?: boolean;
  prevLabel?: string;
  nextLabel?: string;
};

export function PhotoLightbox({
  open,
  onClose,
  src,
  downloadName,
  downloadLabel,
  zoomHint,
  sizeLabel,
  footer,
  onPrev,
  onNext,
  showNav,
}: LightboxProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onPrev, onNext]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-10 text-white hover:text-gray-300"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-8 w-8" />
      </button>

      {showNav && onPrev && (
        <button
          type="button"
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 p-2 text-white hover:text-gray-300 sm:left-4"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
        >
          <span className="text-4xl leading-none">‹</span>
        </button>
      )}
      {showNav && onNext && (
        <button
          type="button"
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-2 text-white hover:text-gray-300 sm:right-4"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          <span className="text-4xl leading-none">›</span>
        </button>
      )}

      <div
        className="flex max-h-[95vh] w-full max-w-5xl flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <ZoomablePhoto
          src={src}
          downloadName={downloadName}
          downloadLabel={downloadLabel}
          zoomHint={zoomHint}
          sizeLabel={sizeLabel}
        />
        {footer && <div className="mt-2 text-center text-sm text-white">{footer}</div>}
      </div>
    </div>
  );
}
