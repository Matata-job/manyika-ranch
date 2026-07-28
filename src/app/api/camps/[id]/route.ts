import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCampAccess, requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

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
      },
      _count: { select: { animals: { where: { status: "ACTIVE" } } } },
      assignments: { include: { user: { select: { id: true, name: true, role: true } } } },
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

  const body = await req.json();
  const camp = await prisma.camp.update({
    where: { id },
    data: {
      name: body.name,
      latitude: body.latitude,
      longitude: body.longitude,
      capacity: body.capacity,
      waterSources: body.waterSources,
      notes: body.notes,
    },
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

  const animalCount = await prisma.animal.count({ where: { campId: id, status: "ACTIVE" } });
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
