import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import { logAnimalEventsBulk } from "@/lib/services/event-service";
import { isHerdPlan } from "@/lib/herd-plan";
import type { Prisma, Role } from "@prisma/client";

/**
 * Bulk update herd plan.
 * Body: { animalIds: string[], herdPlan: HerdPlan, herdPlanNote?: string | null }
 */
export async function PATCH(req: NextRequest) {
  const result = await requirePermission("updateAnimalRecords");
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
      { error: "Maximum 500 animals per bulk update" },
      { status: 400 }
    );
  }

  if (!isHerdPlan(body.herdPlan)) {
    return NextResponse.json(
      {
        error:
          "Invalid herd plan (EXCLUDED, KEEP_BREEDING, SELL_NEXT_CYCLE, or KULIMA)",
      },
      { status: 400 }
    );
  }

  const herdPlan = body.herdPlan;
  const scope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in scope) return scope.error;

  const animals = await prisma.animal.findMany({
    where: {
      id: { in: animalIds },
      status: { notIn: ["DECEASED", "SOLD"] },
      ...scope,
    },
    select: { id: true, eartag: true, herdPlan: true },
  });

  const skipped = animalIds.length - animals.length;
  if (animals.length === 0) {
    return NextResponse.json(
      { error: "No accessible animals to update", updated: 0, skipped },
      { status: 400 }
    );
  }

  const now = new Date();
  const data: Prisma.AnimalUpdateManyMutationInput = {
    herdPlan,
    herdPlanAt: herdPlan === "EXCLUDED" ? null : now,
  };

  if (herdPlan === "EXCLUDED") {
    data.herdPlanNote = null;
  } else if (body.herdPlanNote !== undefined) {
    data.herdPlanNote =
      body.herdPlanNote === null || body.herdPlanNote === ""
        ? null
        : String(body.herdPlanNote).trim();
  }

  await prisma.animal.updateMany({
    where: { id: { in: animals.map((a) => a.id) } },
    data,
  });

  const noteDesc =
    herdPlan === "EXCLUDED"
      ? undefined
      : typeof data.herdPlanNote === "string"
        ? data.herdPlanNote
        : data.herdPlanNote === null
          ? undefined
          : undefined;

  const titles: Record<string, string> = {
    EXCLUDED: "Herd plan cleared (excluded)",
    KEEP_BREEDING: "Marked keep for breeding",
    SELL_NEXT_CYCLE: "Marked sell next cycle",
    KULIMA: "Marked plough team (kulima)",
  } as const;

  const changed = animals.filter((a) => a.herdPlan !== herdPlan);
  await logAnimalEventsBulk(
    changed.map((a) => ({
      animalId: a.id,
      type: "STATUS_CHANGE" as const,
      title: titles[herdPlan] || "Herd plan updated",
      description: noteDesc,
      recordedById: result.user.id,
      metadata: {
        herdPlan,
        herdPlanNote: noteDesc ?? null,
        bulk: true,
      },
    }))
  );

  return NextResponse.json({
    updated: animals.length,
    skipped,
    herdPlan,
  });
}
