import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/api-guard";
import { Role } from "@prisma/client";
import { wipeDemoHerd } from "../../../../../scripts/import-camps/wipe";
import { loadCampJson } from "../../../../../scripts/import-camps/load";
import type { CampImportJson } from "../../../../../scripts/import-camps/mapping";

export const runtime = "nodejs";
export const maxDuration = 300;

function loadImportFiles(): CampImportJson[] {
  const dir = path.join(process.cwd(), "data", "imports");
  if (!fs.existsSync(dir)) {
    throw new Error(`Import JSON folder missing: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => /^mr-\d+\.json$/i.test(f))
    .sort()
    .map(
      (f) =>
        JSON.parse(
          fs.readFileSync(path.join(dir, f), "utf8")
        ) as CampImportJson
    );
}

/**
 * OWNER-only: wipe demo herd and load Sept 2025 camp JSON into this ranch DB.
 * POST { "confirm": "REPLACE_DEMO_HERD" }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;
  if (auth.user.role !== Role.OWNER) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }

  let body: { confirm?: string; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }

  if (body.confirm !== "REPLACE_DEMO_HERD" && !body.dryRun) {
    return NextResponse.json(
      {
        error: 'Send JSON body { "confirm": "REPLACE_DEMO_HERD" } to apply',
        hint: 'Use { "dryRun": true } to preview counts without writing',
      },
      { status: 400 }
    );
  }

  const files = loadImportFiles();
  const preview = files.map((f) => ({
    code: f.code,
    name: f.name,
    animals: f.animals.length,
    untaggedNotes: f.untaggedNotes,
    needsReview: f.needsReview.length,
  }));
  const totalAnimals = preview.reduce((s, c) => s + c.animals, 0);

  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      camps: preview.length,
      totalAnimals,
      preview,
    });
  }

  const ranch = await prisma.ranch.findFirst({
    where: { id: auth.user.ranchId },
  });
  if (!ranch) {
    return NextResponse.json({ error: "Ranch not found" }, { status: 404 });
  }

  const wipe = await wipeDemoHerd(prisma, ranch.id);
  const loaded = [];
  for (const f of files) {
    loaded.push(await loadCampJson(prisma, ranch.id, auth.user.id, f));
  }

  return NextResponse.json({
    ok: true,
    wipe,
    loaded,
    camps: loaded.length,
    animalsLoaded: loaded.reduce((s, r) => s + (r.animalCount || 0), 0),
  });
}

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;
  if (auth.user.role !== Role.OWNER) {
    return NextResponse.json({ error: "Owner only" }, { status: 403 });
  }
  try {
    const files = loadImportFiles();
    return NextResponse.json({
      ready: true,
      camps: files.length,
      totalAnimals: files.reduce((s, f) => s + f.animals.length, 0),
      codes: files.map((f) => f.code),
    });
  } catch (e) {
    return NextResponse.json(
      { ready: false, error: String(e) },
      { status: 500 }
    );
  }
}
