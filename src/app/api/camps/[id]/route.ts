import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCampAccess, requirePermission, buildCampAnimalCountWhere } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { parseBoundary } from "@/lib/camp-boundary";
import type { Role } from "@prisma/client";

function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireCampAccess(id);
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
    200
  );
  const offset = Math.max(
    parseInt(searchParams.get("offset") || "0", 10) || 0,
    0
  );

  const animalWhere = {
    campId: id,
    ...buildCampAnimalCountWhere(result.user.id, result.user.role as Role),
  };

  const [camp, animalTotal, sexGroups] = await Promise.all([
    prisma.camp.findFirst({
      where: { id, ranchId: result.user.ranchId, deletedAt: null },
      include: {
        animals: {
          where: animalWhere,
          select: {
            id: true,
            eartag: true,
            breed: true,
            sex: true,
            ageMonths: true,
          },
          take: limit,
          skip: offset,
          orderBy: { eartag: "asc" },
        },
        assignments: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        },
        photos: {
          orderBy: { takenAt: "desc" },
          include: { uploadedBy: { select: { name: true } } },
        },
        journalNotes: {
          orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
          take: 50,
          include: { author: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.animal.count({ where: animalWhere }),
    prisma.animal.groupBy({
      by: ["sex"],
      where: animalWhere,
      _count: { _all: true },
    }),
  ]);

  if (!camp) {
    return NextResponse.json({ error: "Camp not found" }, { status: 404 });
  }

  const bySex: Record<string, number> = {};
  for (const g of sexGroups) {
    bySex[g.sex] = g._count._all;
  }

  return NextResponse.json({
    ...camp,
    animalTotal,
    animalsLimit: limit,
    animalsOffset: offset,
    animalsHasMore: offset + camp.animals.length < animalTotal,
    bySex,
    _count: { animals: animalTotal },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const existing = await prisma.camp.findFirst({
    where: { id, ranchId: result.user.ranchId, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "Camp not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!String(body.name).trim()) {
      return NextResponse.json({ error: "Camp name is required" }, { status: 400 });
    }
    data.name = String(body.name).trim();
  }
  if (body.latitude !== undefined) data.latitude = parseOptionalFloat(body.latitude);
  if (body.longitude !== undefined) data.longitude = parseOptionalFloat(body.longitude);
  if (body.boundary !== undefined) {
    if (body.boundary === null || body.boundary === "") {
      data.boundary = Prisma.DbNull;
    } else {
      const parsed = parseBoundary(body.boundary);
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid camp boundary (need at least one area with 3+ points)" },
          { status: 400 }
        );
      }
      data.boundary = parsed;
    }
  }
  if (body.sizeAcres !== undefined) data.sizeAcres = parseOptionalFloat(body.sizeAcres);
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl?.trim() || null;
  if (body.waterSources !== undefined) {
    data.waterSources = body.waterSources?.trim() || null;
  }
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.code !== undefined) data.code = body.code?.trim() || null;
  if (body.tagColor !== undefined) data.tagColor = body.tagColor?.trim() || null;
  if (body.legacyCode !== undefined) {
    data.legacyCode = body.legacyCode?.trim() || null;
  }

  if (body.isActive !== undefined) {
    const nextActive = Boolean(body.isActive);
    if (!nextActive) {
      const activeAnimals = await prisma.animal.count({
        where: { campId: id, status: "ACTIVE", deletedAt: null },
      });
      if (activeAnimals > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot deactivate a camp that still has active animals. Move or sell them first.",
          },
          { status: 400 }
        );
      }
    }
    data.isActive = nextActive;
  }

  const camp = await prisma.camp.update({
    where: { id },
    data,
  });

  await createAuditLog(result.user.id, "UPDATE", "Camp", id, body);
  return NextResponse.json(camp);
}

/** Soft-delete camp into Recently deleted (no remaining animals). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const existing = await prisma.camp.findFirst({
    where: { id, ranchId: result.user.ranchId, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "Camp not found" }, { status: 404 });
  }

  const animalCount = await prisma.animal.count({
    where: { campId: id, deletedAt: null },
  });
  if (animalCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a camp that still has animals. Move, sell, or remove them first.",
      },
      { status: 400 }
    );
  }

  await prisma.camp.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: result.user.id,
      isActive: false,
    },
  });
  await createAuditLog(result.user.id, "DELETE", "Camp", id, {
    soft: true,
    name: existing.name,
    code: existing.code,
  });
  return NextResponse.json({ success: true, softDeleted: true });
}
