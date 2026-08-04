"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Images, Rows3 } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { TagColorSwatch } from "@/components/eartag-badge";
import { CowHeadIcon } from "@/components/icons/cow-head-icon";
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

function CampThumb({
  camp,
  size = "md",
}: {
  camp: CampListItem;
  size?: "sm" | "md";
}) {
  const coverUrl = camp.logoUrl || camp.coverUrl;
  const label = campPlaceholderLabel(camp.name, camp.code);
  const box =
    size === "sm"
      ? "h-10 w-10 rounded-md text-[9px] leading-tight"
      : "h-11 w-11 rounded-lg text-[10px] leading-tight";

  if (coverUrl) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-muted ring-1 ring-black/5",
          box
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center px-0.5 text-center font-bold tracking-tight",
        "bg-gradient-to-br from-stone-200 via-amber-50 to-stone-300 text-stone-700",
        "dark:from-stone-700 dark:via-amber-950/40 dark:to-stone-800 dark:text-stone-200",
        "ring-1 ring-black/5",
        box
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {camps.map((camp) => (
            <PhotoCampCard key={camp.id} camp={camp} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {camps.map((camp) => (
              <li key={camp.id}>
                <Link
                  href={`/camps/${camp.id}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 sm:px-4 sm:py-3",
                    !camp.isActive && "opacity-70"
                  )}
                >
                  <CampThumb camp={camp} size="sm" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {camp.code && (
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {camp.code}
                        </span>
                      )}
                      <span
                        className={cn(
                          "truncate font-semibold",
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

                  <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                    <CowHeadIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-bold sm:text-base">
                      {camp.animalCount}
                    </span>
                  </span>
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
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <article
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
          "hover:border-foreground/20 hover:shadow-md",
          !camp.isActive && "opacity-75"
        )}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-stone-200 dark:bg-stone-800">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-stone-300 via-amber-100/80 to-stone-400 dark:from-stone-700 dark:via-amber-950/40 dark:to-stone-900"
              aria-hidden
            >
              <CowHeadIcon className="h-8 w-8 text-stone-600/50 dark:text-stone-300/40" />
              <span className="select-none px-3 text-center text-2xl font-bold tracking-wide text-stone-700/80 dark:text-stone-100/80 sm:text-3xl">
                {label}
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {camp.code && coverUrl && (
              <span className="rounded-md bg-background/95 px-2 py-0.5 text-xs font-semibold tracking-wide text-foreground shadow-sm backdrop-blur-sm">
                {camp.code}
              </span>
            )}
            {!camp.isActive && (
              <Badge
                variant="secondary"
                className="bg-background/90 font-normal shadow-sm"
              >
                {t("campInactive")}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h2
            className={cn(
              "truncate text-lg font-semibold leading-tight tracking-tight",
              !camp.isActive && "text-muted-foreground"
            )}
          >
            {camp.name}
          </h2>

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <CowHeadIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xl font-bold tabular-nums leading-none">
                {camp.animalCount}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("animalsTitle").toLowerCase()}
              </span>
            </span>
            {camp.tagColor && (
              <TagColorSwatch color={camp.tagColor} locale={locale} />
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
