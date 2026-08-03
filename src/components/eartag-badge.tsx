import { cn } from "@/lib/utils";
import {
  resolveTagColor,
  tagColorBadgeCss,
  tagColorLabel,
  tagColorSwatchCss,
  type TagColorSource,
} from "@/lib/tag-color";

type Props = {
  eartag: string;
  campTagColor?: string | null;
  animalTagColor?: string | null;
  defaultTagColor?: string | null;
  dob?: string | Date | null;
  ageMonths?: number | null;
  yearColors?: Record<string, string>;
  locale?: string;
  className?: string;
  /** Larger title style for detail pages */
  size?: "sm" | "lg";
  showLabel?: boolean;
};

function sourceHint(
  source: TagColorSource,
  birthYear: number | null,
  locale: string
): string {
  if (source === "animal") {
    return locale === "sw" ? "Rangi ya mnyama" : "Animal override";
  }
  if (source === "year" && birthYear != null) {
    return locale === "sw" ? `Mwaka ${birthYear}` : `Year ${birthYear}`;
  }
  if (source === "camp") {
    return locale === "sw" ? "Rangi ya kambi" : "Camp colour";
  }
  if (source === "default") {
    return locale === "sw" ? "Chaguo-msingi la shamba" : "Ranch default";
  }
  return "";
}

export function EartagBadge({
  eartag,
  campTagColor,
  animalTagColor,
  defaultTagColor,
  dob,
  ageMonths,
  yearColors,
  locale = "en",
  className,
  size = "sm",
  showLabel = false,
}: Props) {
  const { color, source, birthYear } = resolveTagColor({
    animalTagColor,
    campTagColor,
    defaultTagColor,
    dob,
    ageMonths,
    yearColors,
  });
  const swatch = tagColorSwatchCss(color);
  const badge = tagColorBadgeCss(color);
  const hint = sourceHint(source, birthYear, locale);
  const title = color
    ? `${tagColorLabel(color, locale)}${hint ? ` · ${hint}` : ""}`
    : eartag;

  return (
    <span
      className={cn("inline-flex items-center gap-2 min-w-0", className)}
      title={title}
    >
      <span
        className={cn(
          "inline-block shrink-0 rounded-full border",
          size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5"
        )}
        style={swatch}
        aria-hidden
      />
      <span
        className={cn(
          "font-semibold tracking-tight truncate",
          size === "lg" ? "text-3xl" : "text-sm"
        )}
      >
        {eartag}
      </span>
      {showLabel && color && (
        <span
          className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
          style={badge}
        >
          {tagColorLabel(color, locale)}
        </span>
      )}
    </span>
  );
}

export function TagColorSwatch({
  color,
  locale = "en",
  className,
}: {
  color: string | null | undefined;
  locale?: string;
  className?: string;
}) {
  if (!color) return <span className="text-muted-foreground">—</span>;
  const swatch = tagColorSwatchCss(color);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="h-3 w-3 rounded-full border shrink-0"
        style={swatch}
      />
      <span className="text-sm">{tagColorLabel(color, locale)}</span>
    </span>
  );
}
