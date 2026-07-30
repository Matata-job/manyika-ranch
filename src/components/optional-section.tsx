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
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  summary?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {!open && summary && (
            <p className="truncate text-xs text-muted-foreground">{summary}</p>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && <div className="space-y-3 border-t px-3 py-3">{children}</div>}
    </div>
  );
}
