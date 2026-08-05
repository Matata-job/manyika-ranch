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

function campPlaceholderLabel(name: string, code: string | null): string {
  const c = code?.trim();
  if (c) return c.toUpperCase();
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 3).toUpperCase() || "?";
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
    <div className="space-y-5">
      <div className="flex justify-end">
        <div
          className="inline-flex rounded-full border border-border/80 bg-background p-1 shadow-sm"
          role="group"
          aria-label={t("campsViewMode")}
        >
          <button
            type="button"
            onClick={() => setViewMode("photos")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              view === "photos"
                ? "bg-foreground text-background"
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
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              view === "list"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Rows3 className="h-3.5 w-3.5" />
            {t("campsViewList")}
          </button>
        </div>
      </div>

      {view === "photos" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {camps.map((camp) => (
            <PhotoCampCard key={camp.id} camp={camp} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {camps.map((camp) => (
            <DetailCampCard key={camp.id} camp={camp} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function Media({
  camp,
  className,
}: {
  camp: CampListItem;
  className?: string;
}) {
  const coverUrl = camp.logoUrl || camp.coverUrl;
  const label = campPlaceholderLabel(camp.name, camp.code);

  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt=""
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-muted font-mono font-semibold tracking-wide text-muted-foreground",
        className
      )}
      aria-hidden
    >
      {label}
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

  return (
    <Link
      href={`/camps/${camp.id}`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <article
        className={cn(
          "overflow-hidden rounded-2xl border border-border/70 bg-card transition-colors",
          "hover:border-foreground/20",
          !camp.isActive && "opacity-70"
        )}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <Media
            camp={camp}
            className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>

        <div className="space-y-2.5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {camp.code && (
                <p className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                  {camp.code}
                </p>
              )}
              <h2 className="truncate text-base font-semibold tracking-tight">
                {camp.name}
              </h2>
            </div>
            {!camp.isActive && (
              <Badge variant="secondary" className="shrink-0 font-normal">
                {t("campInactive")}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {camp.animalCount}
              </span>{" "}
              {t("animalsTitle").toLowerCase()}
            </p>
            {camp.tagColor && (
              <TagColorSwatch color={camp.tagColor} locale={locale} />
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

function DetailCampCard({
  camp,
  locale,
}: {
  camp: CampListItem;
  locale: string;
}) {
  const t = useT();

  return (
    <Link
      href={`/camps/${camp.id}`}
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <article
        className={cn(
          "flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow",
          "hover:shadow-md",
          !camp.isActive && "opacity-75"
        )}
      >
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h2
            className={cn(
              "text-lg font-semibold tracking-tight",
              !camp.isActive && "text-muted-foreground"
            )}
          >
            {camp.name}
          </h2>
          {camp.code && (
            <span className="text-sm text-muted-foreground">{camp.code}</span>
          )}
          {!camp.isActive && (
            <Badge variant="secondary" className="font-normal">
              {t("campInactive")}
            </Badge>
          )}
        </div>

        <div className="mt-auto space-y-2">
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            {camp.animalCount}{" "}
            <span className="text-base font-medium text-muted-foreground">
              {t("animalsTitle").toLowerCase()}
            </span>
          </p>

          {camp.tagColor && (
            <TagColorSwatch color={camp.tagColor} locale={locale} />
          )}

          {camp.sizeAcres != null && (
            <p className="text-sm text-muted-foreground">
              {camp.sizeAcres} {t("acres")}
            </p>
          )}

          {camp.supervisors.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("supervisor")}:{" "}
              <span className="text-foreground/90">
                {camp.supervisors.join(", ")}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/70">
              {t("noSupervisorAssigned")}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}
