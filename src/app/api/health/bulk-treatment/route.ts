import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  buildAnimalScope,
} from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { parseOptionalNonNegative, roundTzs } from "@/lib/money";
import { isTreatmentType, TREATMENT_TYPE_VALUES } from "@/lib/treatment-types";
import type { Role, TreatmentType } from "@prisma/client";

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

  const doseKind =
    body.doseKind === "vaccination" ? ("vaccination" as const) : ("treatment" as const);
  const date = body.date ? new Date(body.date) : new Date();
  const notes = body.notes?.trim() || null;

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

  let costEach: number | null = null;
  const totalCost = parseOptionalNonNegative(body.totalCostTzs);
  if (!totalCost.ok) {
    return NextResponse.json({ error: totalCost.error }, { status: 400 });
  }
  const perCost = parseOptionalNonNegative(body.costTzs);
  if (!perCost.ok) {
    return NextResponse.json({ error: perCost.error }, { status: 400 });
  }
  if (totalCost.value != null && animals.length > 0) {
    costEach = roundTzs(totalCost.value / animals.length);
  } else if (perCost.value != null) {
    costEach = perCost.value;
  }

  const {
    clearPriorTreatmentNextDue,
    clearPriorVaccinationNextDue,
    resolveHealthAlertsForDose,
  } = await import("@/lib/services/health-schedule");

  if (doseKind === "vaccination") {
    let vaccineName = body.vaccineName?.trim() || body.product?.trim() || "";
    let vaccineCatalogId: string | null = body.vaccineCatalogId || null;
    let nextDue = body.nextDue ? new Date(body.nextDue) : null;
    const batchNo = body.batchNo?.trim() || null;

    if (vaccineCatalogId) {
      const catalog = await prisma.vaccineCatalog.findUnique({
        where: { id: vaccineCatalogId },
      });
      if (!catalog) {
        return NextResponse.json({ error: "Vaccine not found" }, { status: 400 });
      }
      if (!vaccineName) vaccineName = catalog.name;
      if (!nextDue && catalog.intervalDays) {
        nextDue = new Date(date.getTime() + catalog.intervalDays * 86400000);
      }
    }

    if (!vaccineName) {
      return NextResponse.json(
        { error: "Vaccine name is required" },
        { status: 400 }
      );
    }

    for (const a of animals) {
      await clearPriorVaccinationNextDue(a.id, vaccineName);
      await resolveHealthAlertsForDose(a.id, "VACCINATION_DUE", vaccineName);
    }

    await prisma.$transaction(async (tx) => {
      await tx.vaccination.createMany({
        data: animals.map((a) => ({
          animalId: a.id,
          vaccineCatalogId,
          vaccineName,
          batchNo,
          nextDue,
          date,
          administeredById: result.user.id,
          notes,
          costTzs: costEach,
        })),
      });
    });

    const { logAnimalEventsBulk } = await import("@/lib/services/event-service");
    await logAnimalEventsBulk(
      animals.map((a) => ({
        animalId: a.id,
        type: "HEALTH" as const,
        title: `Vaccinated: ${vaccineName}`,
        description: [
          batchNo ? `Batch: ${batchNo}` : null,
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
          vaccineName,
          batchNo,
          nextDue: nextDue ? nextDue.toISOString() : null,
          vaccineCatalogId,
          costTzs: costEach,
        },
      }))
    );

    const { syncAllRanchAlerts } = await import("@/lib/services/alert-sync");
    await syncAllRanchAlerts(result.user.ranchId);

    await createAuditLog(result.user.id, "CREATE", "BulkVaccination", result.user.ranchId, {
      vaccineName,
      count: animals.length,
      animalIds: animals.map((a) => a.id),
      skipped: animalIds.length - animals.length,
      vaccineCatalogId,
    });

    return NextResponse.json(
      {
        success: true,
        applied: animals.length,
        skipped: animalIds.length - animals.length,
        doseKind: "vaccination",
        eartags: animals.map((a) => a.eartag),
      },
      { status: 201 }
    );
  }

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
  if (!treatmentType || !isTreatmentType(treatmentType)) {
    return NextResponse.json(
      { error: "Valid treatment type is required" },
      { status: 400 }
    );
  }
  if (!(TREATMENT_TYPE_VALUES as readonly string[]).includes(treatmentType)) {
    return NextResponse.json(
      { error: "Valid treatment type is required" },
      { status: 400 }
    );
  }

  const dose = body.dose?.trim() || null;
  const withdrawal =
    withdrawalPeriod != null && Number.isFinite(withdrawalPeriod)
      ? withdrawalPeriod
      : null;

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
        costTzs: costEach,
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
        costTzs: costEach,
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
      doseKind: "treatment",
      eartags: animals.map((a) => a.eartag),
    },
    { status: 201 }
  );
}
