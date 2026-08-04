"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Minimal show/hide block for optional form sections. */
export function OptionalSection({
  open,
  onToggle,
  title,
  summary,
  children,
  className,
  embedded = false,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  summary?: string;
  children: React.ReactNode;
  className?: string;
  /** Inside a grouped card — no outer border/radius. */
  embedded?: boolean;
}) {
  return (
    <div className={cn(!embedded && "rounded-lg border", className)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between gap-3 text-left hover:bg-muted/30 transition-colors",
          embedded ? "px-4 py-3" : "px-3 py-2.5"
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {!open && summary && (
            <p className="truncate text-xs text-muted-foreground mt-0.5">
              {summary}
            </p>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div
          className={cn(
            "space-y-3 border-t bg-muted/10",
            embedded ? "px-4 py-4" : "px-3 py-3"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
