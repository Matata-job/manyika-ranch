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

  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const records = await prisma.healthRecord.findMany({
    where: { animalId: id },
    orderBy: { date: "desc" },
    include: { vet: { select: { name: true } } },
  });

  return NextResponse.json(records);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const body = await req.json();
  const record = await prisma.healthRecord.create({
    data: {
      animalId: id,
      type: body.type,
      diagnosis: body.diagnosis,
      treatment: body.treatment,
      outcome: body.outcome,
      vetId: result.user.id,
      date: body.date ? new Date(body.date) : new Date(),
      notes: body.notes,
    },
  });

  await logAnimalEvent({
    animalId: id,
    type: "HEALTH",
    title: `Health: ${record.type}`,
    description: [record.diagnosis, record.treatment].filter(Boolean).join(" · ") || undefined,
    occurredAt: record.date,
    recordedById: result.user.id,
    metadata: { healthType: record.type },
  });

  return NextResponse.json(record, { status: 201 });
}
