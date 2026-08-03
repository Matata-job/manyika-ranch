import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import { logAnimalEvent } from "@/lib/services/event-service";

/**
 * Undo accidental death / cull — OWNER only (editMortality).
 * Removes DeathRecord and returns animal to ACTIVE.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("editMortality");
  if (!result.ok) return result.error;

  const animal = await prisma.animal.findUnique({
    where: { id },
    include: { deathRecord: true },
  });
  if (!animal) {
    return NextResponse.json({ error: "Animal not found" }, { status: 404 });
  }
  if (animal.status !== "DECEASED" || !animal.deathRecord) {
    return NextResponse.json(
      { error: "Animal has no death record to undo" },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.deathRecord.delete({ where: { animalId: id } }),
    prisma.animal.update({
      where: { id },
      data: { status: "ACTIVE" },
    }),
  ]);

  await logAnimalEvent({
    animalId: id,
    type: "NOTE",
    title: "Death record undone",
    description: "Accidental death/cull marking was reversed by the ranch owner.",
    recordedById: result.user.id,
  });

  await createAuditLog(result.user.id, "UPDATE", "Animal", id, {
    undoDeath: true,
  });

  return NextResponse.json({ success: true, status: "ACTIVE" });
}
