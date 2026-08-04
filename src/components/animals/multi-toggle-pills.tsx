"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleMultiValue } from "@/lib/multi-filter";
import { useT } from "@/components/providers/locale-provider";

export type MultiToggleOption = {
  value: string;
  label: string;
};

/** Multi-select pills — empty selection means “all”. */
export function MultiTogglePills({
  options,
  value,
  onChange,
  allLabel,
  className,
}: {
  options: MultiToggleOption[];
  value: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
  className?: string;
}) {
  const t = useT();
  const noneSelected = value.length === 0;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        aria-pressed={noneSelected}
        onClick={() => onChange([])}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
          noneSelected
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40"
        )}
      >
        {noneSelected && <Check className="h-3.5 w-3.5" />}
        {allLabel ?? t("all")}
      </button>
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(toggleMultiValue(value, opt.value))}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/40"
            )}
          >
            {selected && <Check className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
