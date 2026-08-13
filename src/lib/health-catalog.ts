import type { TreatmentType } from "@prisma/client";

export type DoseKind = "treatment" | "vaccination";

export type TreatmentScheduleRow = {
  id: string;
  name: string;
  type: string;
  intervalDays: number | null;
  withdrawalPeriod: number | null;
};

export type VaccineScheduleRow = {
  id: string;
  name: string;
  intervalDays: number | null;
};

export type HealthCatalogEntry = {
  /** Stable select value, e.g. treatment:abc or vaccine:xyz */
  key: string;
  kind: DoseKind;
  catalogId: string;
  name: string;
  type?: TreatmentType;
  intervalDays: number | null;
  withdrawalPeriod?: number | null;
};

export const CUSTOM_CATALOG_KEY = "custom";

export function treatmentCatalogKey(id: string) {
  return `treatment:${id}`;
}

export function vaccineCatalogKey(id: string) {
  return `vaccine:${id}`;
}

export function parseCatalogKey(
  key: string
): { kind: DoseKind; catalogId: string } | null {
  if (key === CUSTOM_CATALOG_KEY) return null;
  const [kind, catalogId] = key.split(":");
  if (!catalogId) return null;
  if (kind === "treatment") return { kind: "treatment", catalogId };
  if (kind === "vaccine") return { kind: "vaccination", catalogId };
  return null;
}

export function buildHealthCatalog(
  treatments: TreatmentScheduleRow[],
  vaccines: VaccineScheduleRow[]
): HealthCatalogEntry[] {
  const treatmentEntries: HealthCatalogEntry[] = treatments.map((s) => ({
    key: treatmentCatalogKey(s.id),
    kind: "treatment",
    catalogId: s.id,
    name: s.name,
    type: s.type as TreatmentType,
    intervalDays: s.intervalDays,
    withdrawalPeriod: s.withdrawalPeriod,
  }));
  const vaccineEntries: HealthCatalogEntry[] = vaccines.map((v) => ({
    key: vaccineCatalogKey(v.id),
    kind: "vaccination",
    catalogId: v.id,
    name: v.name,
    intervalDays: v.intervalDays,
  }));
  return [...treatmentEntries, ...vaccineEntries];
}
