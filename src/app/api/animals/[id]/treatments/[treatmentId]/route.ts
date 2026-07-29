import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; treatmentId: string }> }
) {
  const { id, treatmentId } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const treatment = await prisma.treatment.findFirst({
    where: { id: treatmentId, animalId: id },
  });
  if (!treatment) {
    return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
  }

  await prisma.treatment.delete({ where: { id: treatmentId } });

  await createAuditLog(result.user.id, "DELETE", "Treatment", treatmentId, {
    animalId: id,
    type: treatment.type,
    product: treatment.product,
  });

  return NextResponse.json({ success: true });
}
