import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  buildAnimalScope,
} from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import type { Role, TreatmentType } from "@prisma/client";

const TREATMENT_TYPES: TreatmentType[] = [
  "DEWORMING",
  "DIPPING",
  "ANTIBIOTIC",
  "OTHER",
];

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const body = await req.json();
  const animalIds: string[] = Array.isArray(body.animalIds)
    ? [
        ...new Set(
          (body.animalIds as unknown[]).filter(
            (id): id is string => typeof id === "string" && id.length > 0
          )
        ),
      ]
    : [];

  if (animalIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one animal" },
      { status: 400 }
    );
  }
  if (animalIds.length > 500) {
    return NextResponse.json(
      { error: "Maximum 500 animals per bulk treatment" },
      { status: 400 }
    );
  }

  const date = body.date ? new Date(body.date) : new Date();
  let treatmentType = body.type as TreatmentType | undefined;
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
    treatmentType = catalog.type;
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
  if (!treatmentType || !TREATMENT_TYPES.includes(treatmentType)) {
    return NextResponse.json(
      { error: "Valid treatment type is required" },
      { status: 400 }
    );
  }

  const scope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in scope) return scope.error;

  const animals = await prisma.animal.findMany({
    where: {
      id: { in: animalIds },
      status: { in: ["ACTIVE", "QUARANTINE"] },
      ...scope,
    },
    select: { id: true, eartag: true, campId: true },
  });

  if (animals.length === 0) {
    return NextResponse.json(
      { error: "No accessible active animals found for the selection" },
      { status: 400 }
    );
  }

  const dose = body.dose?.trim() || null;
  const notes = body.notes?.trim() || null;
  const withdrawal =
    withdrawalPeriod != null && Number.isFinite(withdrawalPeriod)
      ? withdrawalPeriod
      : null;

  const {
    clearPriorTreatmentNextDue,
    resolveHealthAlertsForDose,
  } = await import("@/lib/services/health-schedule");

  // Clear prior nextDue before creating new doses so we don't wipe the new rows.
  for (const a of animals) {
    await clearPriorTreatmentNextDue(a.id, product);
    await resolveHealthAlertsForDose(a.id, "TREATMENT_DUE", product);
  }

  await prisma.$transaction(async (tx) => {
    await tx.treatment.createMany({
      data: animals.map((a) => ({
        animalId: a.id,
        treatmentCatalogId,
        type: treatmentType!,
        product,
        dose,
        withdrawalPeriod: withdrawal,
        nextDue,
        date,
        administeredById: result.user.id,
        notes,
      })),
    });
  });

  const { logAnimalEventsBulk } = await import("@/lib/services/event-service");
  await logAnimalEventsBulk(
    animals.map((a) => ({
      animalId: a.id,
      type: "TREATMENT" as const,
      title: `Treatment: ${treatmentType!.replace(/_/g, " ")}`,
      description: [
        product,
        dose ? `Dose: ${dose}` : null,
        withdrawal != null ? `Withdrawal: ${withdrawal} days` : null,
        nextDue ? `Next due ${nextDue.toISOString().slice(0, 10)}` : null,
        notes,
        "bulk",
      ]
        .filter(Boolean)
        .join(" · "),
      occurredAt: date,
      recordedById: result.user.id,
      metadata: {
        bulk: true,
        type: treatmentType,
        product,
        withdrawalPeriod: withdrawal,
        nextDue: nextDue ? nextDue.toISOString() : null,
        treatmentCatalogId,
      },
    }))
  );

  const { syncAllRanchAlerts } = await import("@/lib/services/alert-sync");
  await syncAllRanchAlerts(result.user.ranchId);

  await createAuditLog(result.user.id, "CREATE", "BulkTreatment", result.user.ranchId, {
    type: treatmentType,
    product,
    count: animals.length,
    animalIds: animals.map((a) => a.id),
    skipped: animalIds.length - animals.length,
    treatmentCatalogId,
  });

  return NextResponse.json(
    {
      success: true,
      applied: animals.length,
      skipped: animalIds.length - animals.length,
      eartags: animals.map((a) => a.eartag),
    },
    { status: 201 }
  );
}
