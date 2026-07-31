/** Shared types + field mapping for camp record import. */

export type RawAnimalRow = {
  sn?: string;
  hereni: string;
  sex?: string;
  ageClass?: string;
  aina?: string;
  damHereni?: string;
  sireHereni?: string;
  hasiwa?: string;
  mimba?: string;
  mmiliki?: string;
  notes?: string;
  source: "docx" | "ocr" | "pdf-annotation";
  needsReview?: boolean;
  reviewReason?: string;
};

export type CampImportJson = {
  code: string;
  name: string;
  legacyCode: string;
  tagColor?: string;
  locationHint?: string;
  supervisorName?: string;
  supervisorEmail?: string;
  waterSources?: string;
  summaryNotes: string[];
  untaggedNotes: string[];
  animals: MappedAnimal[];
  counts: Record<string, number>;
  needsReview: string[];
  sourceFiles: string[];
};

export type MappedAnimal = {
  eartag: string;
  hereni: string;
  sex: "MALE" | "FEMALE" | null;
  ageMonths: number | null;
  ageClass: string | null;
  breed: string;
  breedNote?: string;
  isCastrated: boolean;
  isPregnant: boolean;
  ownerCode: string | null;
  ownerKey: "OWNER" | "MNOKOTE" | "KIMWALA" | "OTHER";
  ownerOtherLabel?: string;
  damHereni?: string;
  sireHereni?: string;
  colorMarkings?: string;
  notes?: string;
  needsReview: boolean;
  reviewReason?: string;
  source: RawAnimalRow["source"];
};

const OWNER_MAP: Record<string, { key: MappedAnimal["ownerKey"]; label?: string }> = {
  mno: { key: "MNOKOTE", label: "Mnokote" },
  mnokote: { key: "MNOKOTE", label: "Mnokote" },
  kim: { key: "KIMWALA", label: "Kimwala" },
  kimw: { key: "KIMWALA", label: "Kimwala" },
  kimwala: { key: "KIMWALA", label: "Kimwala" },
  mnyk: { key: "OTHER", label: "Manyika / Mnyk" },
  mamk: { key: "OTHER", label: "Mamk" },
  chbg: { key: "OTHER", label: "Chibago" },
  chibag: { key: "OTHER", label: "Chibago" },
  chibago: { key: "OTHER", label: "Chibago" },
  chmn: { key: "OTHER", label: "Chiumbo" },
  mshk: { key: "OTHER", label: "Mashaka family" },
  mashk: { key: "OTHER", label: "Mashaka family" },
};

export function mapAgeClass(raw?: string): { ageMonths: number | null; ageClass: string | null } {
  if (!raw) return { ageMonths: null, ageClass: null };
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (/ndama/.test(s)) return { ageMonths: 2, ageClass: "Ndama" };
  if (/s\.?\s*kati|skati|s kati/.test(s)) return { ageMonths: 9, ageClass: "S. Kati" };
  if (/kubwa|bado kubwa/.test(s)) return { ageMonths: 36, ageClass: "Kubwa" };
  return { ageMonths: null, ageClass: raw.trim() || null };
}

export function mapSex(raw?: string): "MALE" | "FEMALE" | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (s === "M" || s === "MALE" || s.startsWith("DUME")) return "MALE";
  if (s === "F" || s === "FEMALE" || s.startsWith("JIKE")) return "FEMALE";
  return null;
}

export function mapBreed(aina?: string): { breed: string; breedNote?: string } {
  if (!aina || !aina.trim()) return { breed: "KIENYEJI - Zebu" };
  const raw = aina.trim();
  const lower = raw.toLowerCase();
  let breed = "KIENYEJI - Zebu";
  if (/sahiwal/.test(lower)) breed = "SAHIWAL";
  else if (/kisasa/.test(lower)) breed = "KISASA";
  else if (/nyankole|ankole/.test(lower)) breed = "NYANKOLE";
  else if (/kienyeji|zebu|kenyeji/.test(lower)) breed = "KIENYEJI - Zebu";
  else if (/boran/.test(lower)) breed = "BORAN";
  else breed = raw.split(",")[0].trim().toUpperCase() || "KIENYEJI - Zebu";

  const flags: string[] = [];
  if (/\bP\b|,?\s*P\b|pure/i.test(raw)) flags.push("Pure");
  if (/\bC\b|chotar/i.test(raw)) flags.push("Chotar/cross");
  return { breed, breedNote: flags.length ? flags.join(", ") : undefined };
}

export function mapOwner(mmiliki?: string): {
  ownerCode: string | null;
  ownerKey: MappedAnimal["ownerKey"];
  ownerOtherLabel?: string;
} {
  if (!mmiliki || !mmiliki.trim()) {
    return { ownerCode: null, ownerKey: "OWNER" };
  }
  // Hasiwa/Mimba yes marks sometimes land in owner column
  if (/^(ndio|ndiyo|yes|y|has|mi|mim)$/i.test(mmiliki.trim())) {
    return { ownerCode: null, ownerKey: "OWNER" };
  }
  const code = mmiliki.trim();
  const key = code.toLowerCase().replace(/[^a-z]/g, "");
  const hit = OWNER_MAP[key];
  if (hit) {
    return {
      ownerCode: code,
      ownerKey: hit.key,
      ownerOtherLabel: hit.label,
    };
  }
  return { ownerCode: code, ownerKey: "OTHER", ownerOtherLabel: code };
}

export function isYes(raw?: string): boolean {
  if (!raw) return false;
  return /^(ndio|ndiyo|yes|y|true|1|✓|✔)/i.test(raw.trim());
}

export function mapRawAnimal(
  campCode: string,
  row: RawAnimalRow,
  formatEartag: (campCode: string, hereni: string | number) => string
): MappedAnimal {
  const hereni = String(row.hereni).replace(/\D/g, "");
  const sex = mapSex(row.sex);
  const { ageMonths, ageClass } = mapAgeClass(row.ageClass);
  const { breed, breedNote } = mapBreed(row.aina);
  const owner = mapOwner(row.mmiliki);
  const needsReview =
    Boolean(row.needsReview) || !hereni || !sex || ageMonths == null;

  const reasons: string[] = [];
  if (row.reviewReason) reasons.push(row.reviewReason);
  if (!hereni) reasons.push("missing hereni");
  if (!sex) reasons.push("missing sex");
  if (ageMonths == null) reasons.push("missing/unknown age class");

  return {
    eartag: hereni ? formatEartag(campCode, hereni) : `${campCode}-???`,
    hereni,
    sex,
    ageMonths,
    ageClass,
    breed,
    breedNote,
    isCastrated: sex === "MALE" && isYes(row.hasiwa),
    isPregnant: sex === "FEMALE" && isYes(row.mimba),
    ownerCode: owner.ownerCode,
    ownerKey: owner.ownerKey,
    ownerOtherLabel: owner.ownerOtherLabel,
    damHereni: row.damHereni?.replace(/\D/g, "") || undefined,
    sireHereni: row.sireHereni?.replace(/\D/g, "") || undefined,
    colorMarkings: undefined,
    notes: [breedNote, row.notes].filter(Boolean).join(" · ") || undefined,
    needsReview,
    reviewReason: reasons.length ? reasons.join("; ") : undefined,
    source: row.source,
  };
}

export function summarizeAnimals(animals: MappedAnimal[]) {
  const counts: Record<string, number> = {
    total: animals.length,
    male: 0,
    female: 0,
    unknownSex: 0,
    ndama: 0,
    sKati: 0,
    kubwa: 0,
    needsReview: 0,
  };
  for (const a of animals) {
    if (a.sex === "MALE") counts.male++;
    else if (a.sex === "FEMALE") counts.female++;
    else counts.unknownSex++;
    if (a.ageClass === "Ndama") counts.ndama++;
    else if (a.ageClass === "S. Kati") counts.sKati++;
    else if (a.ageClass === "Kubwa") counts.kubwa++;
    if (a.needsReview) counts.needsReview++;
  }
  return counts;
}
