"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { TAG_COLORS, tagColorLabel, tagColorSwatchCss } from "@/lib/tag-color";
import { useLocale, useT } from "@/components/providers/locale-provider";

/** Horizontal ear-tag colour swatches for animal filters. */
export function TagColorFilter({
  value,
  onChange,
  className,
  showHelp = true,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
  className?: string;
  showHelp?: boolean;
}) {
  const locale = useLocale().locale;
  const t = useT();
  const selectedLabel = value ? tagColorLabel(value, locale) : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={value == null}
          onClick={() => onChange(null)}
          className={cn(
            "inline-flex h-9 items-center rounded-full border px-3 text-sm transition-colors",
            value == null
              ? "border-foreground bg-foreground text-background shadow-sm"
              : "border-border bg-background hover:bg-muted"
          )}
        >
          {t("all")}
        </button>
        {TAG_COLORS.map((code) => {
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
                "inline-flex h-9 items-center gap-2 rounded-full border px-2.5 pr-3 text-sm shadow-sm transition-all",
                selected
                  ? "border-foreground bg-muted ring-2 ring-foreground/15"
                  : "border-border bg-background hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "h-4 w-4 rounded-full border border-black/10",
                  selected && "ring-2 ring-background"
                )}
                style={tagColorSwatchCss(code)}
              />
              <span className="whitespace-nowrap">{tagColorLabel(code, locale)}</span>
            </button>
          );
        })}
      </div>
      {showHelp && (
        <div className="rounded-xl border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span>{selectedLabel || t("eartagColor")}</span>
            <span className="hidden sm:inline text-muted-foreground/70">·</span>
            <Link
              href="/settings/ranch"
              className="inline-flex items-center rounded-full border px-2 py-0.5 hover:bg-background hover:text-foreground"
            >
              {t("tagColorYearRules")}
            </Link>
            <Link
              href="/camps"
              className="inline-flex items-center rounded-full border px-2 py-0.5 hover:bg-background hover:text-foreground"
            >
              {t("tagColorCamp")}
            </Link>
          </div>
          <p className="mt-2 leading-relaxed">{t("eartagColorFilterHelp")}</p>
        </div>
      )}
    </div>
  );
}
