import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const vaccinations = await prisma.vaccination.findMany({
    where: { animalId: id },
    orderBy: { date: "desc" },
    include: {
      administeredBy: { select: { name: true } },
      vaccineCatalog: true,
    },
  });

  return NextResponse.json(vaccinations);
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
  let nextDue = body.nextDue ? new Date(body.nextDue) : null;

  if (!nextDue && body.vaccineCatalogId) {
    const catalog = await prisma.vaccineCatalog.findUnique({
      where: { id: body.vaccineCatalogId },
    });
    if (catalog?.intervalDays) {
      const date = body.date ? new Date(body.date) : new Date();
      nextDue = new Date(date.getTime() + catalog.intervalDays * 86400000);
    }
  }

  const vaccination = await prisma.vaccination.create({
    data: {
      animalId: id,
      vaccineCatalogId: body.vaccineCatalogId,
      vaccineName: body.vaccineName,
      batchNo: body.batchNo,
      date: body.date ? new Date(body.date) : new Date(),
      nextDue,
      administeredById: result.user.id,
      notes: body.notes,
    },
  });

  const { logAnimalEvent } = await import("@/lib/services/event-service");
  await logAnimalEvent({
    animalId: id,
    type: "VACCINATION",
    title: `Vaccinated: ${vaccination.vaccineName}`,
    description: vaccination.nextDue
      ? `Next due ${vaccination.nextDue.toISOString().slice(0, 10)}`
      : undefined,
    occurredAt: vaccination.date,
    recordedById: result.user.id,
    metadata: { vaccineName: vaccination.vaccineName, nextDue: vaccination.nextDue },
  });

  return NextResponse.json(vaccination, { status: 201 });
}
