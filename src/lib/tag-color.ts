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

export type TagColorSource = "animal" | "year" | "camp" | null;

const STYLES: Record<
  string,
  { swatch: string; badge: string; labelEn: string; labelSw: string }
> = {
  NJANO: {
    swatch: "bg-yellow-400 border-yellow-600",
    badge: "bg-yellow-100 text-yellow-950 border-yellow-400",
    labelEn: "Yellow (Njano)",
    labelSw: "Njano",
  },
  BLUE: {
    swatch: "bg-blue-500 border-blue-700",
    badge: "bg-blue-100 text-blue-950 border-blue-400",
    labelEn: "Blue",
    labelSw: "Bluu",
  },
  KIJANI: {
    swatch: "bg-green-500 border-green-700",
    badge: "bg-green-100 text-green-950 border-green-400",
    labelEn: "Green (Kijani)",
    labelSw: "Kijani",
  },
  NYEKUNDU: {
    swatch: "bg-red-600 border-red-800",
    badge: "bg-red-100 text-red-950 border-red-400",
    labelEn: "Red (Nyekundu)",
    labelSw: "Nyekundu",
  },
  NYEUPE: {
    swatch: "bg-white border-neutral-400",
    badge: "bg-neutral-50 text-neutral-900 border-neutral-400",
    labelEn: "White (Nyeupe)",
    labelSw: "Nyeupe",
  },
  ORANGE: {
    swatch: "bg-orange-500 border-orange-700",
    badge: "bg-orange-100 text-orange-950 border-orange-400",
    labelEn: "Orange",
    labelSw: "Chungwa",
  },
  BLACK: {
    swatch: "bg-neutral-900 border-neutral-950",
    badge: "bg-neutral-800 text-neutral-50 border-neutral-700",
    labelEn: "Black",
    labelSw: "Nyeusi",
  },
  PINK: {
    swatch: "bg-pink-400 border-pink-600",
    badge: "bg-pink-100 text-pink-950 border-pink-400",
    labelEn: "Pink",
    labelSw: "Pink",
  },
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

export function tagColorStyle(code: string | null | undefined) {
  const key = normalizeTagColor(code);
  if (!key || !STYLES[key]) {
    return {
      swatch: "bg-muted border-muted-foreground/30",
      badge: "bg-muted text-muted-foreground border-muted-foreground/20",
      labelEn: key || "—",
      labelSw: key || "—",
    };
  }
  return STYLES[key];
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

/**
 * Resolve plastic tag colour:
 * 1) animal override → 2) birth-year ranch setting → 3) camp default
 */
export function resolveTagColor(input: {
  animalTagColor?: string | null;
  campTagColor?: string | null;
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

  return { color: null, source: null, birthYear };
}
