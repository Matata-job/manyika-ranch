import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { parseOptionalNonNegative } from "@/lib/money";
import {
  healthRecordSummarySelect,
  resolveHealthRecordId,
} from "@/lib/health-record-link";
import type { TreatmentType } from "@prisma/client";

const TYPES: TreatmentType[] = ["DEWORMING", "DIPPING", "ANTIBIOTIC", "OTHER"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const treatments = await prisma.treatment.findMany({
    where: { animalId: id },
    orderBy: { date: "desc" },
    include: {
      administeredBy: { select: { name: true } },
      treatmentCatalog: true,
      healthRecord: { select: healthRecordSummarySelect },
    },
  });

  return NextResponse.json(treatments);
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
  const date = body.date ? new Date(body.date) : new Date();

  let type = body.type as TreatmentType | undefined;
  let product = body.product?.trim() || "";
  let withdrawalPeriod =
    body.withdrawalPeriod != null && body.withdrawalPeriod !== ""
      ? parseInt(String(body.withdrawalPeriod), 10)
      : null;
  let nextDue = body.nextDue ? new Date(body.nextDue) : null;
  let treatmentCatalogId: string | null = body.treatmentCatalogId || null;

  if (treatmentCatalogId) {
    const catalog = await prisma.treatmentCatalog.findUnique({
      where: { id: treatmentCatalogId },
    });
    if (!catalog) {
      return NextResponse.json(
        { error: "Treatment schedule not found" },
        { status: 400 }
      );
    }
    type = catalog.type;
    if (!product) product = catalog.name;
    if (withdrawalPeriod == null && catalog.withdrawalPeriod != null) {
      withdrawalPeriod = catalog.withdrawalPeriod;
    }
    if (!nextDue && catalog.intervalDays) {
      nextDue = new Date(date.getTime() + catalog.intervalDays * 86400000);
    }
  }

  if (!product) {
    return NextResponse.json({ error: "Product is required" }, { status: 400 });
  }
  if (!type || !TYPES.includes(type)) {
    return NextResponse.json(
      { error: "Valid treatment type is required" },
      { status: 400 }
    );
  }

  const costParsed = parseOptionalNonNegative(body.costTzs);
  if (!costParsed.ok) {
    return NextResponse.json({ error: costParsed.error }, { status: 400 });
  }

  const healthLink = await resolveHealthRecordId(id, body.healthRecordId);
  if (!healthLink.ok) {
    return NextResponse.json({ error: healthLink.error }, { status: 400 });
  }

  const treatment = await prisma.treatment.create({
    data: {
      animalId: id,
      treatmentCatalogId,
      healthRecordId: healthLink.value,
      type,
      product,
      dose: body.dose?.trim() || null,
      withdrawalPeriod:
        withdrawalPeriod != null && Number.isFinite(withdrawalPeriod)
          ? withdrawalPeriod
          : null,
      nextDue,
      date,
      administeredById: result.user.id,
      notes: body.notes?.trim() || null,
      costTzs: costParsed.value,
    },
  });

  const {
    clearPriorTreatmentNextDue,
    resolveHealthAlertsForDose,
  } = await import("@/lib/services/health-schedule");
  await clearPriorTreatmentNextDue(id, product, treatment.id);
  await resolveHealthAlertsForDose(id, "TREATMENT_DUE", product);
  const { syncAllRanchAlerts } = await import("@/lib/services/alert-sync");
  await syncAllRanchAlerts(result.user.ranchId);

  const { logAnimalEvent } = await import("@/lib/services/event-service");
  await logAnimalEvent({
    animalId: id,
    type: "TREATMENT",
    title: `Treatment: ${String(treatment.type).replace(/_/g, " ")}`,
    description: [
      treatment.product,
      treatment.dose,
      treatment.nextDue
        ? `Next due ${treatment.nextDue.toISOString().slice(0, 10)}`
        : null,
      treatment.notes,
    ]
      .filter(Boolean)
      .join(" · "),
    occurredAt: treatment.date,
    recordedById: result.user.id,
    metadata: {
      type: treatment.type,
      product: treatment.product,
      withdrawalPeriod: treatment.withdrawalPeriod,
      nextDue: treatment.nextDue,
      costTzs: treatment.costTzs,
      healthRecordId: treatment.healthRecordId,
    },
  });

  return NextResponse.json(treatment, { status: 201 });
}
