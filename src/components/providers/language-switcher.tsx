"use client";

import { useLocale } from "@/components/providers/locale-provider";
import type { Locale } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useLocale();

  function pick(next: Locale) {
    if (next !== locale) setLocale(next);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border p-1 text-xs",
        className
      )}
      role="group"
      aria-label={t("language")}
    >
      {!compact && (
        <span className="px-2 text-muted-foreground hidden sm:inline">
          {t("language")}
        </span>
      )}
      <button
        type="button"
        onClick={() => pick("en")}
        className={cn(
          "rounded-md px-2 py-1 font-medium transition-colors",
          locale === "en"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => pick("sw")}
        className={cn(
          "rounded-md px-2 py-1 font-medium transition-colors",
          locale === "sw"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        SW
      </button>
    </div>
  );
}
