import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-TZ", {
    dateStyle: "medium",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(new Date(date));
}

export function computeAgeMonths(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  return Math.max(0, months);
}

/** How age is shown across the ranch (set by Owner / Manager). */
export type AgeDisplayMode = "YEARS_AND_MONTHS" | "MONTHS_ONLY" | "AUTO";

/**
 * Format age for display.
 * - YEARS_AND_MONTHS: "2y 3mo"
 * - MONTHS_ONLY: "27 mo"
 * - AUTO: months only if under 12 months, otherwise years + months
 */
export function formatAge(
  ageMonths: number | null | undefined,
  mode: AgeDisplayMode = "AUTO"
): string {
  if (ageMonths == null || Number.isNaN(ageMonths)) return "—";
  const total = Math.max(0, Math.floor(ageMonths));

  const asYearsMonths = () => {
    const years = Math.floor(total / 12);
    const months = total % 12;
    if (years === 0) return `${months} mo`;
    if (months === 0) return `${years}y`;
    return `${years}y ${months}mo`;
  };

  if (mode === "MONTHS_ONLY") return `${total} mo`;
  if (mode === "YEARS_AND_MONTHS") return asYearsMonths();
  // AUTO
  if (total < 12) return `${total} mo`;
  return asYearsMonths();
}

export function getRanchAgeDisplayMode(settings: unknown): AgeDisplayMode {
  const mode = (settings as { ageDisplayMode?: string } | null)?.ageDisplayMode;
  if (mode === "YEARS_AND_MONTHS" || mode === "MONTHS_ONLY" || mode === "AUTO") {
    return mode;
  }
  return "AUTO";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(amount);
}
