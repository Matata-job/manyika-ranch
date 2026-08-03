import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildCampScope } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";

function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function parseOptionalNonNegInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewCamps");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const forMovement = searchParams.get("for") === "movement";

  if (forMovement && hasPermission(result.user.role as Role, "manageMovements")) {
    const camps = await prisma.camp.findMany({
      where: {
        ranchId: result.user.ranchId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(camps);
  }

  const where = await buildCampScope(
    result.user.id,
    result.user.role as Role,
    result.user.ranchId
  );

  const camps = await prisma.camp.findMany({
    where,
    include: {
      _count: {
        select: {
          animals: { where: { status: "ACTIVE", deletedAt: null } },
        },
      },
      assignments: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(camps);
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Camp name is required" }, { status: 400 });
  }

  const camp = await prisma.camp.create({
    data: {
      ranchId: result.user.ranchId,
      name: body.name.trim(),
      code: body.code?.trim() || null,
      tagColor: body.tagColor?.trim() || null,
      legacyCode: body.legacyCode?.trim() || null,
      latitude: parseOptionalFloat(body.latitude) ?? null,
      longitude: parseOptionalFloat(body.longitude) ?? null,
      sizeAcres: parseOptionalFloat(body.sizeAcres) ?? null,
      estimatedLive: parseOptionalNonNegInt(body.estimatedLive) ?? null,
      logoUrl: body.logoUrl?.trim() || null,
      waterSources: body.waterSources?.trim() || null,
      notes: body.notes?.trim() || null,
      isActive: body.isActive !== false,
    },
  });

  await createAuditLog(result.user.id, "CREATE", "Camp", camp.id, body);
  return NextResponse.json(camp, { status: 201 });
}
