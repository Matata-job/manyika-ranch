"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Images, List } from "lucide-react";
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

function campInitials(name: string, code: string | null): string {
  if (code?.trim()) {
    const parts = code.trim().split(/[-_\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1].slice(0, 2))
        .toUpperCase()
        .slice(0, 3);
    }
    return code.trim().slice(0, 3).toUpperCase();
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
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
            <List className="h-3.5 w-3.5" />
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
                    "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50",
                    !camp.isActive && "opacity-70"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-bold tracking-wide",
                      "bg-gradient-to-br from-stone-200 to-amber-100 text-stone-700",
                      "dark:from-stone-700 dark:to-amber-950/50 dark:text-stone-200"
                    )}
                    aria-hidden
                  >
                    {campInitials(camp.name, camp.code)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {camp.code && (
                        <span className="text-xs font-semibold text-muted-foreground">
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
                        <Badge variant="secondary" className="font-normal text-[10px]">
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

                  <span className="inline-flex shrink-0 items-center gap-1.5 tabular-nums">
                    <CowHeadIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-base font-bold">{camp.animalCount}</span>
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
  const initials = campInitials(camp.name, camp.code);

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
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-300 via-amber-100/80 to-stone-400 dark:from-stone-700 dark:via-amber-950/40 dark:to-stone-900"
              aria-hidden
            >
              <span className="select-none text-4xl font-bold tracking-wide text-stone-700/70 dark:text-stone-200/70 sm:text-5xl">
                {initials}
              </span>
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {camp.code && (
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
