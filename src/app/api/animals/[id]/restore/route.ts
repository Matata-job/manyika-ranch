import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

/** Restore a soft-deleted animal from Recently deleted. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id, { allowDeleted: true });
  if (!access.ok) return access.error;

  const result = await requirePermission("deleteAnimal");
  if (!result.ok) return result.error;

  const animal = await prisma.animal.findFirst({
    where: { id, deletedAt: { not: null } },
  });
  if (!animal) {
    return NextResponse.json(
      { error: "Deleted animal not found" },
      { status: 404 }
    );
  }

  const camp = await prisma.camp.findFirst({
    where: { id: animal.campId, deletedAt: null },
  });
  if (!camp) {
    return NextResponse.json(
      {
        error:
          "Cannot restore: this animal’s camp is also deleted. Restore the camp first.",
      },
      { status: 400 }
    );
  }

  const restored = await prisma.animal.update({
    where: { id },
    data: { deletedAt: null, deletedById: null },
  });

  await createAuditLog(result.user.id, "UPDATE", "Animal", id, {
    restore: true,
  });
  return NextResponse.json(restored);
}
