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
  if (!body.product?.trim()) {
    return NextResponse.json({ error: "Product is required" }, { status: 400 });
  }
  if (!body.type || !TREATMENT_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Valid treatment type is required" }, { status: 400 });
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

  const date = body.date ? new Date(body.date) : new Date();
  const product = body.product.trim();
  const dose = body.dose?.trim() || null;
  const notes = body.notes?.trim() || null;
  const withdrawalPeriod =
    body.withdrawalPeriod != null && body.withdrawalPeriod !== ""
      ? parseInt(String(body.withdrawalPeriod), 10)
      : null;
  const withdrawal =
    withdrawalPeriod != null && Number.isFinite(withdrawalPeriod)
      ? withdrawalPeriod
      : null;

  const treatmentType = body.type as TreatmentType;

  await prisma.$transaction(async (tx) => {
    await tx.treatment.createMany({
      data: animals.map((a) => ({
        animalId: a.id,
        type: treatmentType,
        product,
        dose,
        withdrawalPeriod: withdrawal,
        date,
        administeredById: result.user.id,
        notes,
      })),
    });

    await tx.animalEvent.createMany({
      data: animals.map((a) => ({
        animalId: a.id,
        type: "TREATMENT" as const,
        title: `Treatment: ${treatmentType.replace(/_/g, " ")}`,
        description: [
          product,
          dose ? `Dose: ${dose}` : null,
          withdrawal != null ? `Withdrawal: ${withdrawal} days` : null,
          notes,
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
        },
      })),
    });
  });

  await createAuditLog(result.user.id, "CREATE", "BulkTreatment", result.user.ranchId, {
    type: treatmentType,
    product,
    count: animals.length,
    animalIds: animals.map((a) => a.id),
    skipped: animalIds.length - animals.length,
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
