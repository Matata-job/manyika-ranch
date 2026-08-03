"use client";

import { cn } from "@/lib/utils";
import { TAG_COLORS, tagColorLabel, tagColorStyle } from "@/lib/tag-color";
import { useLocale } from "@/components/providers/locale-provider";

/** Horizontal ear-tag colour swatches for animal filters. */
export function TagColorFilter({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
  className?: string;
}) {
  const locale = useLocale().locale;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {TAG_COLORS.map((code) => {
        const style = tagColorStyle(code);
        const selected = value === code;
        return (
          <button
            key={code}
            type="button"
            title={tagColorLabel(code, locale)}
            aria-label={tagColorLabel(code, locale)}
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : code)}
            className={cn(
              "h-7 w-7 rounded-full border-2 shadow-sm transition-transform",
              style.swatch,
              selected
                ? "scale-110 ring-2 ring-foreground ring-offset-2"
                : "border-black/10 hover:scale-105"
            )}
          />
        );
      })}
    </div>
  );
}
