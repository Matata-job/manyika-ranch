import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import type { DeathCause, DisposalMethod, Role } from "@prisma/client";

const CAUSES: DeathCause[] = [
  "DISEASE",
  "INJURY",
  "PREDATION",
  "DROUGHT_STARVATION",
  "BIRTHING",
  "OLD_AGE",
  "CULLING",
  "UNKNOWN",
  "OTHER",
];

const DISPOSALS: DisposalMethod[] = [
  "BURIED",
  "BURNED",
  "SOLD_CARCASS",
  "REMOVED",
  "OTHER",
];

/**
 * Bulk death / culling. Photos are not supported in bulk — add per animal later if needed.
 * Body: { animalIds, date?, cause, causeDetail?, disposalMethod?, disposalNotes?,
 *         location?, notes?, isCulling?, insuranceClaim?, claimAmountTzs?, claimReference? }
 */
export async function POST(req: NextRequest) {
  const result = await requirePermission("manageMortality");
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
      { error: "Maximum 500 animals per bulk mortality record" },
      { status: 400 }
    );
  }

  const cause = (body.cause || "UNKNOWN") as DeathCause;
  if (!CAUSES.includes(cause)) {
    return NextResponse.json({ error: "Invalid cause" }, { status: 400 });
  }

  const disposalMethod = (body.disposalMethod || "BURIED") as DisposalMethod;
  if (!DISPOSALS.includes(disposalMethod)) {
    return NextResponse.json(
      { error: "Invalid disposal method" },
      { status: 400 }
    );
  }

  const isCulling = Boolean(body.isCulling) || cause === "CULLING";
  const date = body.date ? new Date(body.date) : new Date();
  const causeDetail =
    typeof body.causeDetail === "string" && body.causeDetail.trim()
      ? body.causeDetail.trim()
      : null;
  const disposalNotes =
    typeof body.disposalNotes === "string" && body.disposalNotes.trim()
      ? body.disposalNotes.trim()
      : null;
  const location =
    typeof body.location === "string" && body.location.trim()
      ? body.location.trim()
      : null;
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : null;
  const insuranceClaim = Boolean(body.insuranceClaim);
  const claimAmountTzs =
    body.claimAmountTzs != null && body.claimAmountTzs !== ""
      ? parseFloat(String(body.claimAmountTzs))
      : null;
  const claimReference =
    typeof body.claimReference === "string" && body.claimReference.trim()
      ? body.claimReference.trim()
      : null;

  const scope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in scope) return scope.error;

  const animals = await prisma.animal.findMany({
    where: {
      id: { in: animalIds },
      status: { notIn: ["DECEASED", "SOLD"] },
      deathRecord: null,
      ...scope,
    },
    select: { id: true, eartag: true },
  });

  if (animals.length === 0) {
    return NextResponse.json(
      {
        error:
          "No accessible animals found (already deceased/sold or death recorded)",
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.deathRecord.createMany({
      data: animals.map((a) => ({
        animalId: a.id,
        date,
        cause,
        causeDetail,
        disposalMethod,
        disposalNotes,
        location,
        insuranceClaim,
        claimAmountTzs:
          claimAmountTzs != null && Number.isFinite(claimAmountTzs)
            ? claimAmountTzs
            : null,
        claimReference,
        isCulling,
        recordedById: result.user.id,
        notes,
      })),
    });

    await tx.animal.updateMany({
      where: { id: { in: animals.map((a) => a.id) } },
      data: { status: "DECEASED" },
    });
  });

  const { logAnimalEventsBulk } = await import("@/lib/services/event-service");
  await logAnimalEventsBulk(
    animals.map((a) => ({
      animalId: a.id,
      type: isCulling ? ("CULLING" as const) : ("DEATH" as const),
      title: isCulling
        ? `Culled: ${a.eartag}`
        : `Death recorded: ${a.eartag}`,
      description: [
        `Cause: ${cause}`,
        causeDetail,
        `Disposal: ${disposalMethod}`,
        "bulk",
      ]
        .filter(Boolean)
        .join(" · "),
      occurredAt: date,
      recordedById: result.user.id,
      metadata: {
        cause,
        disposalMethod,
        insuranceClaim,
        isCulling,
        bulk: true,
      },
    }))
  );

  await createAuditLog(
    result.user.id,
    "CREATE",
    "BulkMortality",
    result.user.ranchId,
    {
      cause,
      isCulling,
      disposalMethod,
      count: animals.length,
      animalIds: animals.map((a) => a.id),
      skipped: animalIds.length - animals.length,
    }
  );

  return NextResponse.json(
    {
      success: true,
      recorded: animals.length,
      skipped: animalIds.length - animals.length,
      isCulling,
      eartags: animals.map((a) => a.eartag),
    },
    { status: 201 }
  );
}
