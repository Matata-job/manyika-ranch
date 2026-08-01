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
  let vaccineName = body.vaccineName?.trim() || "";
  let vaccineCatalogId = body.vaccineCatalogId || null;

  if (vaccineCatalogId) {
    const catalog = await prisma.vaccineCatalog.findUnique({
      where: { id: vaccineCatalogId },
    });
    if (!catalog) {
      return NextResponse.json({ error: "Vaccine not found" }, { status: 400 });
    }
    if (!vaccineName) vaccineName = catalog.name;
    if (!nextDue && catalog.intervalDays) {
      const date = body.date ? new Date(body.date) : new Date();
      nextDue = new Date(date.getTime() + catalog.intervalDays * 86400000);
    }
  }

  if (!vaccineName) {
    return NextResponse.json({ error: "Vaccine name is required" }, { status: 400 });
  }

  const vaccination = await prisma.vaccination.create({
    data: {
      animalId: id,
      vaccineCatalogId,
      vaccineName,
      batchNo: body.batchNo,
      date: body.date ? new Date(body.date) : new Date(),
      nextDue,
      administeredById: result.user.id,
      notes: body.notes,
    },
  });

  const {
    clearPriorVaccinationNextDue,
    resolveHealthAlertsForDose,
  } = await import("@/lib/services/health-schedule");
  await clearPriorVaccinationNextDue(id, vaccineName, vaccination.id);
  await resolveHealthAlertsForDose(id, "VACCINATION_DUE", vaccineName);
  const { syncAllRanchAlerts } = await import("@/lib/services/alert-sync");
  await syncAllRanchAlerts(result.user.ranchId);

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
