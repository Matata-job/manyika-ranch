"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Images, Rows3 } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { TagColorSwatch } from "@/components/eartag-badge";
import { cn } from "@/lib/utils";

export type CampListItem = {
  id: string;
  name: string;
  code: string | null;
  tagColor: string | null;
  sizeAcres: number | null;
  isActive: boolean;
  logoUrl: string | null;
  coverUrl: string | null;
  photoCount: number;
  animalCount: number;
  supervisors: string[];
};

type ViewMode = "photos" | "list";

const STORAGE_KEY = "manyika-camps-view";

/** Prefer full camp code (e.g. MR-14); else short name initials. */
function campPlaceholderLabel(name: string, code: string | null): string {
  const c = code?.trim();
  if (c) return c.toUpperCase();
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 3).toUpperCase() || "?";
}

function CampThumb({ camp }: { camp: CampListItem }) {
  const coverUrl = camp.logoUrl || camp.coverUrl;
  const label = campPlaceholderLabel(camp.name, camp.code);

  if (coverUrl) {
    return (
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg px-0.5 text-center",
        "bg-stone-100 text-[10px] font-bold leading-tight tracking-tight text-stone-600",
        "ring-1 ring-stone-200/80 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700"
      )}
      aria-hidden
      title={label}
    >
      <span className="line-clamp-2 break-all">{label}</span>
    </div>
  );
}

type Props = {
  camps: CampListItem[];
  locale: string;
};

export function CampsDirectory({ camps, locale }: Props) {
  const t = useT();
  const [view, setView] = useState<ViewMode>("photos");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "photos" || saved === "list") setView(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function setViewMode(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div
          className="inline-flex rounded-lg border bg-muted/40 p-0.5"
          role="group"
          aria-label={t("campsViewMode")}
        >
          <button
            type="button"
            onClick={() => setViewMode("photos")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "photos"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Images className="h-3.5 w-3.5" />
            {t("campsViewPhotos")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Rows3 className="h-3.5 w-3.5" />
            {t("campsViewList")}
          </button>
        </div>
      </div>

      {view === "photos" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {camps.map((camp) => (
            <PhotoCampCard key={camp.id} camp={camp} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <ul className="divide-y divide-border/80">
            {camps.map((camp) => (
              <li key={camp.id}>
                <Link
                  href={`/camps/${camp.id}`}
                  className={cn(
                    "flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-muted/40",
                    !camp.isActive && "opacity-65"
                  )}
                >
                  <CampThumb camp={camp} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {camp.code && (
                        <span className="font-mono text-[11px] font-semibold tracking-wide text-muted-foreground">
                          {camp.code}
                        </span>
                      )}
                      <span
                        className={cn(
                          "truncate text-[15px] font-semibold tracking-tight",
                          !camp.isActive && "text-muted-foreground"
                        )}
                      >
                        {camp.name}
                      </span>
                      {!camp.isActive && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal"
                        >
                          {t("campInactive")}
                        </Badge>
                      )}
                    </div>
                    {camp.supervisors.length > 0 && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {camp.supervisors.join(", ")}
                      </p>
                    )}
                  </div>

                  {camp.tagColor && (
                    <div className="hidden sm:block">
                      <TagColorSwatch color={camp.tagColor} locale={locale} />
                    </div>
                  )}

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold tabular-nums leading-none tracking-tight">
                      {camp.animalCount}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("animalsTitle")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PhotoCampCard({
  camp,
  locale,
}: {
  camp: CampListItem;
  locale: string;
}) {
  const t = useT();
  const coverUrl = camp.logoUrl || camp.coverUrl;
  const label = campPlaceholderLabel(camp.name, camp.code);

  return (
    <Link
      href={`/camps/${camp.id}`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <article
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all",
          "hover:border-foreground/15 hover:shadow-md",
          !camp.isActive && "opacity-75"
        )}
      >
        <div className="relative aspect-[5/4] overflow-hidden sm:aspect-[4/3]">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center bg-stone-100 dark:bg-stone-900"
              aria-hidden
            >
              <span className="select-none font-mono text-3xl font-bold tracking-[0.08em] text-stone-400 dark:text-stone-600 sm:text-4xl">
                {label}
              </span>
            </div>
          )}

          {/* Scrim for readable type */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />

          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
            {camp.code && (
              <span className="rounded-full bg-white/95 px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-stone-900 shadow-sm">
                {camp.code}
              </span>
            )}
            {!camp.isActive && (
              <Badge className="border-0 bg-black/50 font-normal text-white backdrop-blur-sm">
                {t("campInactive")}
              </Badge>
            )}
          </div>

          {camp.tagColor && (
            <div className="absolute right-3 top-3 rounded-full bg-white/90 p-1 shadow-sm backdrop-blur-sm">
              <TagColorSwatch color={camp.tagColor} locale={locale} />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <h2 className="truncate text-xl font-semibold tracking-tight drop-shadow-sm">
              {camp.name}
            </h2>
            <p className="mt-1 flex items-baseline gap-1.5 text-sm text-white/85">
              <span className="text-2xl font-bold tabular-nums leading-none text-white">
                {camp.animalCount}
              </span>
              <span className="tracking-wide">
                {t("animalsTitle").toLowerCase()}
              </span>
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}
