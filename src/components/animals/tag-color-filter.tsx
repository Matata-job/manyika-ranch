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

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
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
                "h-8 w-8 rounded-full border-2 shadow-sm transition-transform",
                selected
                  ? "scale-110 ring-2 ring-foreground ring-offset-2"
                  : "hover:scale-105"
              )}
              style={tagColorSwatchCss(code)}
            />
          );
        })}
      </div>
      {showHelp && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("eartagColorFilterHelp")}{" "}
          <Link
            href="/settings/ranch"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {t("tagColorYearRules")}
          </Link>
          {" · "}
          <Link
            href="/camps"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {t("tagColorCamp")}
          </Link>
        </p>
      )}
    </div>
  );
}
