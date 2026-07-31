import fs from "fs";
import path from "path";
import { CAMP_MANIFEST, formatEartag } from "./manifest";
import {
  mapRawAnimal,
  summarizeAnimals,
  type CampImportJson,
  type RawAnimalRow,
} from "./mapping";
import { parseDocxAnimals, pickBestDocx } from "./parse-docx";
import {
  extractPdfAnnotations,
  ocrPdfAnimals,
  untaggedFromAnnotations,
} from "./parse-pdf";

const OUT_DIR = path.join(process.cwd(), "data", "imports");

export function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  return OUT_DIR;
}

export async function buildCampJson(
  code?: string,
  opts: { skipOcr?: boolean } = {}
): Promise<CampImportJson[]> {
  ensureOutDir();
  const entries = code
    ? CAMP_MANIFEST.filter((c) => c.code === code)
    : CAMP_MANIFEST;
  const results: CampImportJson[] = [];

  for (const camp of entries) {
    const sourceFiles: string[] = [];
    const summaryNotes: string[] = [];
    const needsReview: string[] = [];
    let rawAnimals: RawAnimalRow[] = [];

    const docx = pickBestDocx(camp.docxRelPaths);
    if (docx) {
      sourceFiles.push(docx);
      const parsed = parseDocxAnimals(docx);
      rawAnimals = parsed.animals;
      summaryNotes.push(...parsed.summaryNotes);
    }

    for (const pdf of camp.pdfRelPaths) {
      if (!fs.existsSync(pdf)) continue;
      sourceFiles.push(pdf);
      const ann = extractPdfAnnotations(pdf);
      summaryNotes.push(...ann.filter((l) => /jumla|summary|ndama|kubwa|msimamizi/i.test(l)));
      const untagged = untaggedFromAnnotations(ann);
      if (untagged.length) summaryNotes.push(...untagged);

      if (!opts.skipOcr) {
        console.log(`Extract PDF ${camp.code} ← ${path.basename(pdf)} …`);
        const ocr = ocrPdfAnimals(pdf);
        console.log(`  method=${ocr.method} rows=${ocr.animals.length}`);
        try {
          const parsed = JSON.parse(ocr.ocrText || "{}") as {
            summaryNotes?: string[];
          };
          if (parsed.summaryNotes?.length) {
            summaryNotes.push(...parsed.summaryNotes);
          }
        } catch {
          /* not JSON (tesseract path) */
        }
        fs.writeFileSync(
          path.join(OUT_DIR, `${camp.code.toLowerCase()}-ocr.txt`),
          ocr.ocrText || ""
        );
        // Prefer DOCX rows when present; otherwise use PDF extract
        if (rawAnimals.length === 0) {
          if (ocr.animals.length) {
            rawAnimals = ocr.animals;
          } else {
            needsReview.push(
              `PDF extract produced no animal rows (${ocr.method}). Handwritten sheet or empty template — see untaggedNotes.`
            );
          }
        }
      } else if (rawAnimals.length === 0) {
        needsReview.push(
          "No DOCX animal rows; PDF extract skipped. Re-run without --skip-ocr."
        );
      }
    }

    const animals = rawAnimals
      .filter((r) => String(r.hereni).replace(/\D/g, "").length > 0)
      .map((r) => mapRawAnimal(camp.code, r, formatEartag));

    const untaggedNotes = summaryNotes.filter((l) =>
      /hazijawekewa|hajawekewa|alama|noted|haina|zina hereni|jumla\s*:/i.test(l)
    );

    for (const a of animals) {
      if (a.needsReview && a.reviewReason) {
        needsReview.push(`${a.eartag}: ${a.reviewReason}`);
      }
    }

    const json: CampImportJson = {
      code: camp.code,
      name: camp.name,
      legacyCode: camp.legacyCode,
      tagColor: camp.tagColor,
      locationHint: camp.locationHint,
      supervisorName: camp.supervisorName,
      supervisorEmail: camp.supervisorEmail,
      waterSources: camp.locationHint,
      summaryNotes: [...new Set(summaryNotes)],
      untaggedNotes: [...new Set(untaggedNotes)],
      animals,
      counts: summarizeAnimals(animals),
      needsReview: [...new Set(needsReview)],
      sourceFiles,
    };

    const outPath = path.join(OUT_DIR, `${camp.code.toLowerCase()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(json, null, 2));
    console.log(
      `Wrote ${outPath} — ${animals.length} animals, ${json.needsReview.length} review flags`
    );
    results.push(json);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    camps: (() => {
      // When building a single camp, merge into existing report
      if (code) {
        const reportPath = path.join(OUT_DIR, "_report.json");
        let existing: {
          camps: Array<{
            code: string;
            name: string;
            counts: Record<string, number>;
            untaggedNotes: string[];
            needsReviewCount: number;
          }>;
        } = { camps: [] };
        if (fs.existsSync(reportPath)) {
          try {
            existing = JSON.parse(fs.readFileSync(reportPath, "utf8"));
          } catch {
            /* ignore */
          }
        }
        const byCode = new Map(existing.camps.map((c) => [c.code, c]));
        for (const r of results) {
          byCode.set(r.code, {
            code: r.code,
            name: r.name,
            counts: r.counts,
            untaggedNotes: r.untaggedNotes,
            needsReviewCount: r.needsReview.length,
          });
        }
        return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
      }
      return results.map((r) => ({
        code: r.code,
        name: r.name,
        counts: r.counts,
        untaggedNotes: r.untaggedNotes,
        needsReviewCount: r.needsReview.length,
      }));
    })(),
  };
  const totalAnimals = report.camps.reduce(
    (s, c) => s + (c.counts?.total || 0),
    0
  );
  const totalReview = report.camps.reduce(
    (s, c) => s + (c.counts?.needsReview || 0),
    0
  );
  Object.assign(report, { totalAnimals, totalReview, campCount: report.camps.length });
  fs.writeFileSync(
    path.join(OUT_DIR, "_report.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(
    `\nReport: ${report.camps.length} camps, ${totalAnimals} animals, ${totalReview} needsReview`
  );
  return results;
}
