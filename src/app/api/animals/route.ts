import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  requireCampAccess,
  buildAnimalScope,
} from "@/lib/auth/api-guard";
import { createAuditLog, withComputedAge } from "@/lib/services/animal-service";
import { computeAgeMonths } from "@/lib/utils";
import { logAnimalEvent } from "@/lib/services/event-service";
import type { Role, Sex, AnimalStatus, Prisma } from "@prisma/client";
import { ageGroupWhere, ageMonthsRangeWhere, dobRangeWhere } from "@/lib/reports/age-filter";
import { normalizeTagColor } from "@/lib/tag-color";
import { parseMultiParam } from "@/lib/multi-filter";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 5000;

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const ownerIds = parseMultiParam(searchParams.get("owner"));
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const sex = searchParams.get("sex");
  const breeds = parseMultiParam(searchParams.get("breed"));
  const castrated = searchParams.get("castrated");
  const pregnant = searchParams.get("pregnant");
  const herdPlan = searchParams.get("herdPlan");
  const ageGroup = searchParams.get("ageGroup");
  const ageMinRaw = searchParams.get("ageMinMonths");
  const ageMaxRaw = searchParams.get("ageMaxMonths");
  const dobFrom = searchParams.get("dobFrom");
  const dobTo = searchParams.get("dobTo");
  const tagColors = parseMultiParam(searchParams.get("tagColor"))
    .map((c) => normalizeTagColor(c))
    .filter((c): c is string => !!c);
  const sort = searchParams.get("sort") || "eartag_asc";
  const limit = Math.min(
    Math.max(
      parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT,
      1
    ),
    MAX_LIMIT
  );
  const offset = Math.max(
    parseInt(searchParams.get("offset") || "0", 10) || 0,
    0
  );

  const scope = await buildAnimalScope(result.user.id, result.user.role as Role, {
    campId: campId && campId !== "all" ? campId : null,
  });
  if ("error" in scope) return scope.error;

  const ageMinMonths =
    ageMinRaw != null && ageMinRaw !== ""
      ? parseInt(ageMinRaw, 10)
      : null;
  const ageMaxMonths =
    ageMaxRaw != null && ageMaxRaw !== ""
      ? parseInt(ageMaxRaw, 10)
      : null;
  const hasCustomAge =
    (ageMinMonths != null && !Number.isNaN(ageMinMonths)) ||
    (ageMaxMonths != null && !Number.isNaN(ageMaxMonths)) ||
    !!dobFrom ||
    !!dobTo;

  // Custom months / DOB range take precedence over preset age groups
  const ageWhere = hasCustomAge
    ? undefined
    : ageGroupWhere(ageGroup);
  const monthsWhere = ageMonthsRangeWhere(
    ageMinMonths != null && !Number.isNaN(ageMinMonths) ? ageMinMonths : null,
    ageMaxMonths != null && !Number.isNaN(ageMaxMonths) ? ageMaxMonths : null
  );
  const bornWhere = dobRangeWhere(dobFrom, dobTo);

  const where: Prisma.AnimalWhereInput = {
    ...scope,
    ...(ownerIds.length > 0 && result.user.role !== "EXTERNAL_OWNER"
      ? ownerIds.length === 1
        ? { ownerId: ownerIds[0] }
        : { ownerId: { in: ownerIds } }
      : {}),
    ...(status && status !== "ALL" ? { status: status as AnimalStatus } : {}),
    ...(sex === "MALE" || sex === "FEMALE" || sex === "UNKNOWN"
      ? { sex: sex as Sex }
      : {}),
    ...(breeds.length > 0
      ? breeds.length === 1
        ? { breed: breeds[0] }
        : { breed: { in: breeds } }
      : {}),
    ...(castrated === "true"
      ? { sex: "MALE" as Sex, isCastrated: true }
      : castrated === "false"
        ? { sex: "MALE" as Sex, isCastrated: false }
        : {}),
    ...(pregnant === "true"
      ? { sex: "FEMALE" as Sex, isPregnant: true }
      : pregnant === "false"
        ? { sex: "FEMALE" as Sex, isPregnant: false }
        : {}),
    ...(herdPlan &&
    ["EXCLUDED", "KEEP_BREEDING", "SELL_NEXT_CYCLE", "KULIMA"].includes(herdPlan)
      ? {
          herdPlan: herdPlan as
            | "EXCLUDED"
            | "KEEP_BREEDING"
            | "SELL_NEXT_CYCLE"
            | "KULIMA",
        }
      : {}),
    AND: [
      ...(search
        ? [
            {
              OR: [
                { eartag: { contains: search, mode: "insensitive" as const } },
                { breed: { contains: search, mode: "insensitive" as const } },
                { rfidChip: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
      ...(ageWhere ? [ageWhere] : []),
      ...(monthsWhere ? [monthsWhere] : []),
      ...(bornWhere ? [bornWhere] : []),
      ...(tagColors.length > 0
        ? [
            {
              OR: [
                { tagColor: { in: tagColors } },
                {
                  AND: [
                    { OR: [{ tagColor: null }, { tagColor: "" }] },
                    { camp: { tagColor: { in: tagColors } } },
                  ],
                },
              ],
            },
          ]
        : []),
    ],
  };

  const orderBy: Prisma.AnimalOrderByWithRelationInput[] =
    sort === "eartag_desc"
      ? [{ eartag: "desc" }]
      : sort === "breed_asc"
        ? [{ breed: "asc" }, { eartag: "asc" }]
        : sort === "sex_asc"
          ? [{ sex: "asc" }, { eartag: "asc" }]
          : sort === "sex_desc"
            ? [{ sex: "desc" }, { eartag: "asc" }]
            : sort === "newest"
              ? [{ createdAt: "desc" }]
              : sort === "age_asc"
                ? [{ ageMonths: "asc" }, { eartag: "asc" }]
                : sort === "age_desc"
                  ? [{ ageMonths: "desc" }, { eartag: "asc" }]
                  : sort === "camp_asc"
                    ? [{ camp: { name: "asc" } }, { eartag: "asc" }]
                    : [{ eartag: "asc" }];

  const [total, animals] = await Promise.all([
    prisma.animal.count({ where }),
    prisma.animal.findMany({
      where,
      include: {
      camp: { select: { id: true, name: true, tagColor: true, code: true } },
      owner: { select: { id: true, name: true } },
      sire: { select: { id: true, eartag: true } },
      dam: { select: { id: true, eartag: true } },
    },
    orderBy,
    take: limit,
    skip: offset,
  }),
]);

  const mapped = animals.map((a) => {
    const withAge = withComputedAge(a);
    return {
      ...withAge,
      notesPreview: a.notes ? a.notes.slice(0, 120) : null,
      hasNotes: Boolean(a.notes && a.notes.trim()),
    };
  });
  const hasMore = offset + mapped.length < total;

  return NextResponse.json({
    animals: mapped,
    total,
    limit,
    offset,
    hasMore,
  });
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("createAnimal");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.campId) {
    return NextResponse.json({ error: "campId is required" }, { status: 400 });
  }

  const campAccess = await requireCampAccess(body.campId);
  if (!campAccess.ok) return campAccess.error;

  const dob = body.dob ? new Date(body.dob) : null;

  const existing = await prisma.animal.findUnique({ where: { eartag: body.eartag } });
  if (existing) {
    return NextResponse.json({ error: "Eartag already exists" }, { status: 409 });
  }

  const rfidChip =
    typeof body.rfidChip === "string" && body.rfidChip.trim()
      ? body.rfidChip.trim()
      : null;
  if (rfidChip) {
    const rfidTaken = await prisma.animal.findFirst({
      where: { rfidChip },
      select: { id: true },
    });
    if (rfidTaken) {
      return NextResponse.json(
        { error: "RFID chip already registered to another animal" },
        { status: 409 }
      );
    }
  }

  const photoUrls: string[] = Array.isArray(body.photoUrls)
    ? body.photoUrls
    : body.photoUrl
      ? [body.photoUrl]
      : [];
  const primaryPhoto = photoUrls[0] || body.photoUrl || null;

  let ownerId =
    typeof body.ownerId === "string" && body.ownerId.trim()
      ? body.ownerId.trim()
      : null;

  if (!ownerId) {
    const ranchOwner = await prisma.user.findFirst({
      where: {
        ranchId: result.user.ranchId,
        role: "OWNER",
        isActive: true,
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    ownerId = ranchOwner?.id || null;
  }

  if (!ownerId) {
    return NextResponse.json(
      { error: "No ranch owner found to assign as animal owner" },
      { status: 400 }
    );
  }

  const ownerOk = await prisma.user.findFirst({
    where: {
      id: ownerId,
      ranchId: result.user.ranchId,
      isActive: true,
      role: { in: ["OWNER", "EXTERNAL_OWNER"] },
    },
    select: { id: true },
  });
  if (!ownerOk) {
    return NextResponse.json({ error: "Invalid animal owner" }, { status: 400 });
  }

  const sireId = body.sireId || null;
  const damId = body.damId || null;
  if (sireId) {
    const sire = await prisma.animal.findFirst({
      where: { id: sireId, sex: "MALE" },
      select: { id: true },
    });
    if (!sire) {
      return NextResponse.json(
        { error: "Sire must be a male animal" },
        { status: 400 }
      );
    }
  }
  if (damId) {
    const dam = await prisma.animal.findFirst({
      where: { id: damId, sex: "FEMALE" },
      select: { id: true },
    });
    if (!dam) {
      return NextResponse.json(
        { error: "Dam must be a female animal" },
        { status: 400 }
      );
    }
  }

  const animal = await prisma.animal.create({
    data: {
      eartag: body.eartag,
      rfidChip,
      photoUrl: primaryPhoto,
      breed: body.breed,
      sex: body.sex,
      isCastrated: body.sex === "MALE" ? Boolean(body.isCastrated) : false,
      isPregnant: body.sex === "FEMALE" ? Boolean(body.isPregnant) : false,
      dob,
      ageMonths: dob
        ? computeAgeMonths(dob)
        : typeof body.ageMonths === "number"
          ? body.ageMonths
          : body.ageYears != null || body.ageMonthsPart != null
            ? Math.max(
                0,
                (Number(body.ageYears) || 0) * 12 +
                  (Number(body.ageMonthsPart) || 0)
              )
            : null,
      ownerId,
      sireId,
      damId,
      campId: body.campId,
      status: body.status || "ACTIVE",
      acquisitionType: body.acquisitionType || "BORN_ON_FARM",
      acquisitionDate: body.acquisitionDate
        ? new Date(body.acquisitionDate)
        : null,
      colorMarkings: body.colorMarkings,
      tagColor: body.tagColor?.trim()
        ? String(body.tagColor).trim().toUpperCase()
        : null,
      notes: body.notes,
    },
    include: {
      camp: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });

  if (photoUrls.length > 0) {
    await prisma.animalPhoto.createMany({
      data: photoUrls.map((url: string) => ({
        animalId: animal.id,
        url,
        takenAt: new Date(),
        uploadedById: result.user.id,
      })),
    });
  }

  await createAuditLog(result.user.id, "CREATE", "Animal", animal.id, {
    eartag: body.eartag,
  });
  await logAnimalEvent({
    animalId: animal.id,
    type: "REGISTERED",
    title: `Registered ${animal.eartag}`,
    description: `${animal.breed} · ${animal.sex} · Camp ${animal.camp.name}`,
    recordedById: result.user.id,
    metadata: { campId: animal.campId, breed: animal.breed },
  });

  if (animal.isCastrated) {
    await logAnimalEvent({
      animalId: animal.id,
      type: "CASTRATION",
      title: "Castrated",
      description: "Registered as castrated (hasiwa)",
      recordedById: result.user.id,
      metadata: { isCastrated: true },
    });
  }

  if (damId) {
    const { clearDamPregnancy } = await import(
      "@/lib/services/breeding-service"
    );
    await clearDamPregnancy(damId, {
      recordedById: result.user.id,
      reason: "Calf registered and linked to dam",
      calfEartag: animal.eartag,
    });
  }

  return NextResponse.json(withComputedAge(animal), { status: 201 });
}
