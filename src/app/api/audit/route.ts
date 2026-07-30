import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import type { Role } from "@prisma/client";

const FIELD_LABELS: Record<string, string> = {
  eartag: "Eartag",
  breed: "Breed",
  sex: "Sex",
  status: "Status",
  dob: "Date of birth",
  campId: "Camp",
  ownerId: "Owner",
  sireId: "Sire",
  damId: "Dam",
  notes: "Notes",
  colorMarkings: "Markings",
  acquisitionType: "Source",
  acquisitionDate: "Acquisition date",
  ageYears: "Age (years)",
  ageMonthsPart: "Age (months)",
  ageMonths: "Age (months)",
  isCastrated: "Castrated",
  isPregnant: "Pregnant",
  name: "Name",
  logoUrl: "Logo",
  sizeAcres: "Acres",
  latitude: "Latitude",
  longitude: "Longitude",
  waterSources: "Water sources",
  photoUrl: "Photo",
  role: "Role",
  email: "Email",
  phone: "Phone",
  grazingFeePerAnimal: "Grazing fee / animal",
};

const ACQUISITION_LABELS: Record<string, string> = {
  BORN_ON_FARM: "Born on farm",
  PURCHASED: "Purchased",
  GIFT: "Gift",
};

const SEX_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
};

function isIdLike(value: unknown): value is string {
  return typeof value === "string" && /^c[a-z0-9]{20,}$/i.test(value);
}

function formatScalar(key: string, value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "acquisitionType" && typeof value === "string") {
    return ACQUISITION_LABELS[value] || value.replace(/_/g, " ");
  }
  if (key === "sex" && typeof value === "string") {
    return SEX_LABELS[value] || value;
  }
  if (
    (key === "dob" || key === "acquisitionDate" || key.endsWith("Date") || key === "date") &&
    typeof value === "string"
  ) {
    const day = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  }
  if (typeof value === "object") return null;
  return String(value);
}

function summarizeChanges(
  changes: Record<string, unknown> | null,
  lookups: {
    camps: Map<string, string>;
    users: Map<string, string>;
    animals: Map<string, string>;
  }
): string {
  if (!changes || typeof changes !== "object") return "—";

  const parts: string[] = [];
  for (const [key, raw] of Object.entries(changes)) {
    if (raw == null || raw === "") continue;
    // Skip noisy / technical blobs
    if (
      ["photoUrls", "password", "passwordHash", "id", "createdAt", "updatedAt"].includes(
        key
      )
    ) {
      continue;
    }

    const label = FIELD_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

    let display: string | null = null;
    if (key === "campId" && typeof raw === "string") {
      display = lookups.camps.get(raw) || null;
    } else if ((key === "ownerId" || key === "userId") && typeof raw === "string") {
      display = lookups.users.get(raw) || null;
    } else if ((key === "sireId" || key === "damId" || key === "animalId") && typeof raw === "string") {
      display = lookups.animals.get(raw) || null;
    } else if (key === "logoUrl" || key === "photoUrl") {
      display = "Updated";
    } else if (isIdLike(raw)) {
      display =
        lookups.camps.get(raw) ||
        lookups.users.get(raw) ||
        lookups.animals.get(raw) ||
        null;
    } else {
      display = formatScalar(key, raw);
    }

    if (!display) continue;
    parts.push(`${label}: ${display}`);
    if (parts.length >= 6) break;
  }

  return parts.length > 0 ? parts.join(" · ") : "—";
}

export async function GET(req: NextRequest) {
  const result = await requirePermission("manageUsers");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const userId = searchParams.get("userId");
  const role = searchParams.get("role");
  const action = searchParams.get("action");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const take = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

  const logs = await prisma.auditLog.findMany({
    where: {
      user: {
        ranchId: result.user.ranchId,
        ...(userId && userId !== "all" ? { id: userId } : {}),
        ...(role && role !== "all" ? { role: role as Role } : {}),
      },
      ...(entityType && entityType !== "all" ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(action && action !== "all" ? { action } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  const animalIds = new Set<string>();
  const campIds = new Set<string>();
  const userIds = new Set<string>();

  for (const log of logs) {
    const type = log.entityType.toLowerCase();
    if (type.includes("animal")) animalIds.add(log.entityId);
    else if (type.includes("camp")) campIds.add(log.entityId);
    else if (type.includes("user") || type.includes("owner")) userIds.add(log.entityId);

    const changes =
      log.changes && typeof log.changes === "object"
        ? (log.changes as Record<string, unknown>)
        : null;
    if (!changes) continue;
    if (typeof changes.campId === "string") campIds.add(changes.campId);
    if (typeof changes.ownerId === "string") userIds.add(changes.ownerId);
    if (typeof changes.sireId === "string") animalIds.add(changes.sireId);
    if (typeof changes.damId === "string") animalIds.add(changes.damId);
    if (typeof changes.animalId === "string") animalIds.add(changes.animalId);
    if (typeof changes.userId === "string") userIds.add(changes.userId);
  }

  const [animals, camps, users] = await Promise.all([
    animalIds.size
      ? prisma.animal.findMany({
          where: { id: { in: [...animalIds] } },
          select: { id: true, eartag: true },
        })
      : Promise.resolve([] as { id: string; eartag: string }[]),
    campIds.size
      ? prisma.camp.findMany({
          where: { id: { in: [...campIds] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    userIds.size
      ? prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const animalMap = new Map(animals.map((a) => [a.id, a.eartag]));
  const campMap = new Map(camps.map((c) => [c.id, c.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const lookups = { camps: campMap, users: userMap, animals: animalMap };

  const enriched = logs.map((log) => {
    const type = log.entityType;
    let entityLabel = log.entityId;
    const t = type.toLowerCase();
    if (t.includes("animal")) entityLabel = animalMap.get(log.entityId) || "Animal";
    else if (t.includes("camp")) entityLabel = campMap.get(log.entityId) || "Camp";
    else if (t.includes("user") || t.includes("owner"))
      entityLabel = userMap.get(log.entityId) || "User";
    else if (t.includes("buyer")) entityLabel = "Buyer";

    const changes =
      log.changes && typeof log.changes === "object"
        ? (log.changes as Record<string, unknown>)
        : null;

    // Prefer eartag from changes when entity was just created/updated
    if (t.includes("animal") && changes?.eartag && typeof changes.eartag === "string") {
      entityLabel = changes.eartag;
    }
    if (t.includes("camp") && changes?.name && typeof changes.name === "string") {
      entityLabel = changes.name;
    }

    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      entityLabel,
      summary: summarizeChanges(changes, lookups),
      createdAt: log.createdAt,
      user: log.user,
    };
  });

  return NextResponse.json(enriched);
}
