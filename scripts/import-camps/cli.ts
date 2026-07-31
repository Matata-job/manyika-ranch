#!/usr/bin/env tsx
/**
 * Manyika camp records import CLI
 *
 *   npx tsx scripts/import-camps/cli.ts build [--camp MR-01] [--skip-ocr]
 *   npx tsx scripts/import-camps/cli.ts dry-run
 *   npx tsx scripts/import-camps/cli.ts apply [--wipe]
 *   npx tsx scripts/import-camps/cli.ts wipe
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { buildCampJson, ensureOutDir } from "./build-json";
import { loadCampJson } from "./load";
import { wipeDemoHerd } from "./wipe";
import type { CampImportJson } from "./mapping";

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const cmd = argv[2] || "help";
  const flags = new Set(argv.slice(3).filter((a) => a.startsWith("--")));
  const campIdx = argv.indexOf("--camp");
  const camp = campIdx >= 0 ? argv[campIdx + 1] : undefined;
  return {
    cmd,
    camp,
    skipOcr: flags.has("--skip-ocr"),
    wipe: flags.has("--wipe"),
  };
}

function loadAllJson(): CampImportJson[] {
  const dir = ensureOutDir();
  return fs
    .readdirSync(dir)
    .filter((f) => /^mr-\d+\.json$/i.test(f))
    .sort()
    .map((f) =>
      JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as CampImportJson
    );
}

async function resolveRanch(prisma: PrismaClient) {
  const ranch =
    (await prisma.ranch.findFirst({
      where: {
        OR: [
          { name: { contains: "Manyika", mode: "insensitive" } },
          { name: { contains: "Ya Buu", mode: "insensitive" } },
          { name: { contains: "Yabuu", mode: "insensitive" } },
        ],
      },
    })) || (await prisma.ranch.findFirst());
  if (!ranch) throw new Error("No ranch found — run prisma db seed first");
  // Align display name with product branding when still on legacy seed name
  if (/ya\s*buu/i.test(ranch.name) && !/manyika/i.test(ranch.name)) {
    return prisma.ranch.update({
      where: { id: ranch.id },
      data: { name: "Manyika Ranch" },
    });
  }
  return ranch;
}

async function main() {
  const { cmd, camp, skipOcr, wipe } = parseArgs(process.argv);

  if (cmd === "help" || cmd === "--help") {
    console.log(`Usage:
  build [--camp MR-01] [--skip-ocr]   Parse DOCX/OCR → data/imports/*.json
  dry-run                             Summarize JSON without DB writes
  apply [--wipe]                      Load JSON into DB (optional wipe first)
  wipe                                Remove demo camps/animals/supervisors
`);
    return;
  }

  if (cmd === "build") {
    await buildCampJson(camp, { skipOcr });
    return;
  }

  if (cmd === "wipe") {
    const ranch = await resolveRanch(prisma);
    const result = await wipeDemoHerd(prisma, ranch.id);
    console.log("Wipe complete", result);
    return;
  }

  if (cmd === "dry-run" || cmd === "apply") {
    let files = loadAllJson();
    if (camp) files = files.filter((f) => f.code === camp);
    if (files.length === 0) {
      console.log("No JSON found — run `build` first.");
      return;
    }

    console.log("\n=== DRY-RUN REPORT ===");
    let total = 0;
    let totalReview = 0;
    for (const f of files) {
      total += f.animals.length;
      totalReview += f.counts.needsReview || 0;
      console.log(
        `${f.code} ${f.name}: ${f.counts.total} animals (M${f.counts.male}/F${f.counts.female}) Ndama=${f.counts.ndama} S.Kati=${f.counts.sKati} Kubwa=${f.counts.kubwa} review=${f.counts.needsReview}`
      );
      if (f.untaggedNotes.length) {
        console.log(`  untagged: ${f.untaggedNotes.join(" | ")}`);
      }
    }
    console.log(`TOTAL animals in JSON: ${total}`);
    console.log(`TOTAL needsReview: ${totalReview}`);

    const reviewPath = path.join(ensureOutDir(), "_needs_review.json");
    fs.writeFileSync(
      reviewPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalAnimals: total,
          totalNeedsReview: totalReview,
          camps: files.map((f) => ({
            code: f.code,
            name: f.name,
            counts: f.counts,
            untaggedNotes: f.untaggedNotes,
            needsReview: f.needsReview,
            sampleAnimals: f.animals
              .filter((a) => a.needsReview)
              .slice(0, 10)
              .map((a) => ({
                eartag: a.eartag,
                sex: a.sex,
                ageClass: a.ageClass,
                breed: a.breed,
                ownerKey: a.ownerKey,
                reason: a.reviewReason,
              })),
          })),
        },
        null,
        2
      )
    );
    console.log(`Report file: data/imports/_report.json`);
    console.log(`Needs-review file: data/imports/_needs_review.json\n`);

    if (cmd === "dry-run") return;

    const ranch = await resolveRanch(prisma);
    const owner = await prisma.user.findFirst({
      where: { ranchId: ranch.id, role: "OWNER", isActive: true },
    });
    if (!owner) throw new Error("Ranch OWNER user not found");

    if (wipe) {
      console.log("Wiping demo herd…");
      console.log(await wipeDemoHerd(prisma, ranch.id));
    }

    for (const f of files) {
      const result = await loadCampJson(prisma, ranch.id, owner.id, f);
      console.log("Loaded", result);
    }
    return;
  }

  console.error("Unknown command", cmd);
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
