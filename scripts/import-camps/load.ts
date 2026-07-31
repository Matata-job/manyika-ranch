import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import type { CampImportJson, MappedAnimal } from "./mapping";
import { formatEartag } from "./manifest";

const DEFAULT_PASSWORD = "admin123";

async function ensureBreed(
  prisma: PrismaClient,
  ranchId: string,
  name: string
) {
  return prisma.breedCatalog.upsert({
    where: { ranchId_name: { ranchId, name } },
    update: {},
    create: { ranchId, name },
  });
}

async function ensureOwner(
  prisma: PrismaClient,
  ranchId: string,
  passwordHash: string,
  animal: MappedAnimal,
  ranchOwnerId: string,
  cache: Map<string, string>
): Promise<string> {
  if (animal.ownerKey === "OWNER") return ranchOwnerId;

  const key =
    animal.ownerKey === "MNOKOTE"
      ? "mnokote"
      : animal.ownerKey === "KIMWALA"
        ? "kimwala"
        : `other:${(animal.ownerOtherLabel || animal.ownerCode || "unknown").toLowerCase()}`;

  if (cache.has(key)) return cache.get(key)!;

  const name =
    animal.ownerKey === "MNOKOTE"
      ? "Mnokote"
      : animal.ownerKey === "KIMWALA"
        ? "Kimwala"
        : animal.ownerOtherLabel || animal.ownerCode || "External Owner";

  const email =
    animal.ownerKey === "MNOKOTE"
      ? "mnokote@manyikaranch.co.tz"
      : animal.ownerKey === "KIMWALA"
        ? "kimwala@manyikaranch.co.tz"
        : `${key.replace(/[^a-z0-9]+/g, ".")}@owners.manyikaranch.co.tz`;

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role: "EXTERNAL_OWNER", isActive: true, ranchId },
    create: {
      email,
      name,
      passwordHash,
      role: "EXTERNAL_OWNER",
      ranchId,
      isActive: true,
    },
  });
  cache.set(key, user.id);
  return user.id;
}

export async function loadCampJson(
  prisma: PrismaClient,
  ranchId: string,
  ranchOwnerId: string,
  campJson: CampImportJson,
  opts: { dryRun?: boolean } = {}
) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const breeds = new Set(campJson.animals.map((a) => a.breed));
  for (const b of breeds) {
    if (!opts.dryRun) await ensureBreed(prisma, ranchId, b);
  }

  if (opts.dryRun) {
    return {
      dryRun: true,
      code: campJson.code,
      animalCount: campJson.animals.length,
      untaggedNotes: campJson.untaggedNotes,
    };
  }

  const notesParts = [
    campJson.legacyCode ? `Sept 2025 sheet code (legacy): ${campJson.legacyCode}` : "",
    campJson.tagColor ? `Eartag colour: ${campJson.tagColor}` : "",
    campJson.locationHint ? `Location: ${campJson.locationHint}` : "",
    ...campJson.untaggedNotes.map((n) => `Untagged / notes: ${n}`),
    ...campJson.summaryNotes.filter((n) => /jumla/i.test(n)).slice(0, 3),
  ].filter(Boolean);

  const camp = await prisma.camp.upsert({
    where: {
      ranchId_code: { ranchId, code: campJson.code },
    },
    update: {
      name: campJson.name,
      legacyCode: campJson.legacyCode,
      tagColor: campJson.tagColor || null,
      waterSources: campJson.waterSources || null,
      notes: notesParts.join("\n"),
    },
    create: {
      ranchId,
      name: campJson.name,
      code: campJson.code,
      legacyCode: campJson.legacyCode,
      tagColor: campJson.tagColor || null,
      waterSources: campJson.waterSources || null,
      notes: notesParts.join("\n"),
    },
  });

  if (campJson.supervisorEmail && campJson.supervisorName) {
    const sup = await prisma.user.upsert({
      where: { email: campJson.supervisorEmail },
      update: {
        name: campJson.supervisorName,
        role: "CAMP_SUPERVISOR",
        isActive: true,
        ranchId,
      },
      create: {
        email: campJson.supervisorEmail,
        name: campJson.supervisorName,
        passwordHash,
        role: "CAMP_SUPERVISOR",
        ranchId,
        isActive: true,
      },
    });
    await prisma.userCampAssignment.upsert({
      where: {
        userId_campId: { userId: sup.id, campId: camp.id },
      },
      update: {},
      create: { userId: sup.id, campId: camp.id },
    });
  }

  const ownerCache = new Map<string, string>();
  const created: { id: string; hereni: string; eartag: string }[] = [];

  // First pass: create without pedigree
  for (const a of campJson.animals) {
    if (!a.sex || !a.hereni) continue;
    const ownerId = await ensureOwner(
      prisma,
      ranchId,
      passwordHash,
      a,
      ranchOwnerId,
      ownerCache
    );

    const animal = await prisma.animal.upsert({
      where: { eartag: a.eartag },
      update: {
        breed: a.breed,
        sex: a.sex,
        ageMonths: a.ageMonths,
        isCastrated: a.isCastrated,
        isPregnant: a.isPregnant,
        ownerId,
        campId: camp.id,
        colorMarkings: a.colorMarkings || null,
        notes: a.notes || null,
        status: "ACTIVE",
        acquisitionType: "BORN_ON_FARM",
      },
      create: {
        eartag: a.eartag,
        breed: a.breed,
        sex: a.sex,
        ageMonths: a.ageMonths,
        isCastrated: a.isCastrated,
        isPregnant: a.isPregnant,
        ownerId,
        campId: camp.id,
        colorMarkings: a.colorMarkings || null,
        notes: a.notes || null,
        status: "ACTIVE",
        acquisitionType: "BORN_ON_FARM",
      },
    });
    created.push({ id: animal.id, hereni: a.hereni, eartag: a.eartag });
  }

  // Second pass: pedigree within camp
  const byHereni = new Map(created.map((c) => [c.hereni, c.id]));
  for (const a of campJson.animals) {
    if (!a.damHereni && !a.sireHereni) continue;
    const id = byHereni.get(a.hereni);
    if (!id) continue;
    const damId = a.damHereni ? byHereni.get(a.damHereni) : undefined;
    const sireId = a.sireHereni ? byHereni.get(a.sireHereni) : undefined;
    if (!damId && !sireId) continue;
    await prisma.animal.update({
      where: { id },
      data: {
        ...(damId ? { damId } : {}),
        ...(sireId ? { sireId } : {}),
      },
    });
  }

  return {
    dryRun: false,
    code: campJson.code,
    campId: camp.id,
    animalCount: created.length,
    untaggedNotes: campJson.untaggedNotes,
  };
}

export { formatEartag };
