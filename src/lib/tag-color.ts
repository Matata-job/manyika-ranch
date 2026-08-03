/** Plastic eartag colours used at Manyika Ranch camps. */

export const TAG_COLORS = [
  "NJANO",
  "BLUE",
  "KIJANI",
  "NYEKUNDU",
  "NYEUPE",
  "ORANGE",
  "BLACK",
  "PINK",
] as const;

export type TagColorCode = (typeof TAG_COLORS)[number];

export type TagColorSource = "animal" | "year" | "camp" | "default" | null;

type TagStyle = {
  /** Inline fill — required so colours render even if Tailwind purged utility classes. */
  fill: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  labelEn: string;
  labelSw: string;
};

const STYLES: Record<string, TagStyle> = {
  NJANO: {
    fill: "#facc15",
    border: "#ca8a04",
    badgeBg: "#fef9c3",
    badgeText: "#422006",
    badgeBorder: "#facc15",
    labelEn: "Yellow (Njano)",
    labelSw: "Njano",
  },
  BLUE: {
    fill: "#3b82f6",
    border: "#1d4ed8",
    badgeBg: "#dbeafe",
    badgeText: "#172554",
    badgeBorder: "#60a5fa",
    labelEn: "Blue",
    labelSw: "Bluu",
  },
  KIJANI: {
    fill: "#22c55e",
    border: "#15803d",
    badgeBg: "#dcfce7",
    badgeText: "#14532d",
    badgeBorder: "#4ade80",
    labelEn: "Green (Kijani)",
    labelSw: "Kijani",
  },
  NYEKUNDU: {
    fill: "#dc2626",
    border: "#991b1b",
    badgeBg: "#fee2e2",
    badgeText: "#450a0a",
    badgeBorder: "#f87171",
    labelEn: "Red (Nyekundu)",
    labelSw: "Nyekundu",
  },
  NYEUPE: {
    fill: "#ffffff",
    border: "#a3a3a3",
    badgeBg: "#fafafa",
    badgeText: "#171717",
    badgeBorder: "#a3a3a3",
    labelEn: "White (Nyeupe)",
    labelSw: "Nyeupe",
  },
  ORANGE: {
    fill: "#f97316",
    border: "#c2410c",
    badgeBg: "#ffedd5",
    badgeText: "#7c2d12",
    badgeBorder: "#fb923c",
    labelEn: "Orange",
    labelSw: "Chungwa",
  },
  BLACK: {
    fill: "#171717",
    border: "#0a0a0a",
    badgeBg: "#262626",
    badgeText: "#fafafa",
    badgeBorder: "#404040",
    labelEn: "Black",
    labelSw: "Nyeusi",
  },
  PINK: {
    fill: "#f472b6",
    border: "#db2777",
    badgeBg: "#fce7f3",
    badgeText: "#500724",
    badgeBorder: "#f9a8d4",
    labelEn: "Pink",
    labelSw: "Pink",
  },
};

const FALLBACK: TagStyle = {
  fill: "#e5e5e5",
  border: "#a3a3a3",
  badgeBg: "#f5f5f5",
  badgeText: "#737373",
  badgeBorder: "#d4d4d4",
  labelEn: "—",
  labelSw: "—",
};

export function normalizeTagColor(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  if (!key) return null;
  // Accept common English aliases from sheets
  if (key === "YELLOW") return "NJANO";
  if (key === "GREEN") return "KIJANI";
  if (key === "RED") return "NYEKUNDU";
  if (key === "WHITE") return "NYEUPE";
  return key;
}

export function tagColorStyle(code: string | null | undefined): TagStyle {
  const key = normalizeTagColor(code);
  if (!key || !STYLES[key]) {
    return {
      ...FALLBACK,
      labelEn: key || "—",
      labelSw: key || "—",
    };
  }
  return STYLES[key];
}

/** CSS properties for a colour swatch circle. */
export function tagColorSwatchCss(code: string | null | undefined): {
  backgroundColor: string;
  borderColor: string;
} {
  const style = tagColorStyle(code);
  return { backgroundColor: style.fill, borderColor: style.border };
}

export function tagColorBadgeCss(code: string | null | undefined): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const style = tagColorStyle(code);
  return {
    backgroundColor: style.badgeBg,
    color: style.badgeText,
    borderColor: style.badgeBorder,
  };
}

export function tagColorLabel(code: string | null | undefined, locale = "en"): string {
  const key = normalizeTagColor(code);
  if (!key) return "—";
  const style = STYLES[key];
  if (!style) return key;
  return locale === "sw" ? style.labelSw : style.labelEn;
}

export function birthYearFromAnimal(
  dob: string | Date | null | undefined,
  ageMonths: number | null | undefined
): number | null {
  if (dob) {
    const d = typeof dob === "string" ? new Date(dob) : dob;
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }
  if (ageMonths != null && Number.isFinite(ageMonths)) {
    const d = new Date();
    d.setMonth(d.getMonth() - Math.max(0, ageMonths));
    return d.getFullYear();
  }
  return null;
}

export function getRanchEartagYearColors(settings: unknown): Record<string, string> {
  const raw = (settings as { eartagYearColors?: unknown } | null)?.eartagYearColors;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [year, color] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(year)) continue;
    const n = normalizeTagColor(typeof color === "string" ? color : null);
    if (n) out[year] = n;
  }
  return out;
}

export function getRanchDefaultTagColor(settings: unknown): string | null {
  return normalizeTagColor(
    (settings as { defaultTagColor?: unknown } | null)?.defaultTagColor as
      | string
      | null
      | undefined
  );
}

/**
 * Resolve plastic tag colour:
 * 1) animal override → 2) birth-year → 3) camp → 4) ranch default
 */
export function resolveTagColor(input: {
  animalTagColor?: string | null;
  campTagColor?: string | null;
  defaultTagColor?: string | null;
  dob?: string | Date | null;
  ageMonths?: number | null;
  yearColors?: Record<string, string>;
}): { color: string | null; source: TagColorSource; birthYear: number | null } {
  const birthYear = birthYearFromAnimal(input.dob, input.ageMonths);
  const animal = normalizeTagColor(input.animalTagColor);
  if (animal) return { color: animal, source: "animal", birthYear };

  if (birthYear != null && input.yearColors) {
    const year = normalizeTagColor(input.yearColors[String(birthYear)]);
    if (year) return { color: year, source: "year", birthYear };
  }

  const camp = normalizeTagColor(input.campTagColor);
  if (camp) return { color: camp, source: "camp", birthYear };

  const ranchDefault = normalizeTagColor(input.defaultTagColor);
  if (ranchDefault) return { color: ranchDefault, source: "default", birthYear };

  return { color: null, source: null, birthYear };
}
