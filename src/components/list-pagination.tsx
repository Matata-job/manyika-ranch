"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

interface ListPaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPrev: () => void;
  onNext: () => void;
  loading?: boolean;
  className?: string;
  /** Optional label override for the range text */
  rangeLabel?: string;
}

/** Prev / Next controls when a list is longer than one page. */
export function ListPagination({
  total,
  limit,
  offset,
  onPrev,
  onNext,
  loading = false,
  className,
  rangeLabel,
}: ListPaginationProps) {
  const t = useT();
  if (total <= 0) return null;

  const from = Math.min(offset + 1, total);
  const to = Math.min(offset + limit, total);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  if (!hasPrev && !hasNext && total <= limit) return null;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">
        {rangeLabel ??
          t("showingRangeOf", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!hasPrev || loading}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t("previous")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext || loading}
        >
          {t("next")}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

export const DEFAULT_PAGE_SIZE = 50;
