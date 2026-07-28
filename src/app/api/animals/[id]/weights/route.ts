import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { logAnimalEvent } from "@/lib/services/event-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const logs = await prisma.weightLog.findMany({
    where: { animalId: id },
    orderBy: { date: "asc" },
    include: { recordedBy: { select: { name: true } } },
  });

  return NextResponse.json(logs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("editAnimal");
  if (!result.ok) return result.error;

  const body = await req.json();
  const log = await prisma.weightLog.create({
    data: {
      animalId: id,
      weightKg: body.weightKg,
      date: body.date ? new Date(body.date) : new Date(),
      method: body.method || "scale",
      recordedById: result.user.id,
      notes: body.notes,
    },
  });

  await logAnimalEvent({
    animalId: id,
    type: "WEIGHT",
    title: `Weight: ${log.weightKg} kg`,
    description: body.notes || `Method: ${log.method}`,
    occurredAt: log.date,
    recordedById: result.user.id,
    metadata: { weightKg: log.weightKg, method: log.method },
  });

  return NextResponse.json(log, { status: 201 });
}
