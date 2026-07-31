import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCampAccess, requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

function parseOptionalFloat(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requireCampAccess(id);
  if (!result.ok) return result.error;

  const camp = await prisma.camp.findUnique({
    where: { id },
    include: {
      animals: {
        where: { status: "ACTIVE" },
        select: { id: true, eartag: true, breed: true, sex: true, ageMonths: true },
        take: 50,
        orderBy: { eartag: "asc" },
      },
      _count: { select: { animals: { where: { status: "ACTIVE" } } } },
      assignments: {
        include: { user: { select: { id: true, name: true, role: true } } },
      },
      photos: {
        orderBy: { takenAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });

  if (!camp) return NextResponse.json({ error: "Camp not found" }, { status: 404 });
  return NextResponse.json(camp);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const existing = await prisma.camp.findFirst({
    where: { id, ranchId: result.user.ranchId },
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

  const camp = await prisma.camp.update({
    where: { id },
    data,
  });

  await createAuditLog(result.user.id, "UPDATE", "Camp", id, body);
  return NextResponse.json(camp);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const animalCount = await prisma.animal.count({
    where: { campId: id, status: "ACTIVE" },
  });
  if (animalCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete camp with active animals" },
      { status: 400 }
    );
  }

  await prisma.camp.delete({ where: { id } });
  await createAuditLog(result.user.id, "DELETE", "Camp", id);
  return NextResponse.json({ success: true });
}
