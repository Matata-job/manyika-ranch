"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type ChoiceOption<T extends string = string> = {
  value: T;
  label: string;
};

/** Compact pill selector for ranch forms (sex, source, etc.). */
export function ChoicePills<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ChoiceOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
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
