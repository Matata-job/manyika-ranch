import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const { id, logId } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("editAnimal");
  if (!result.ok) return result.error;

  const log = await prisma.weightLog.findFirst({
    where: { id: logId, animalId: id },
  });
  if (!log) {
    return NextResponse.json({ error: "Weight log not found" }, { status: 404 });
  }

  await prisma.weightLog.delete({ where: { id: logId } });

  await createAuditLog(result.user.id, "DELETE", "WeightLog", logId, {
    animalId: id,
    weightKg: log.weightKg,
    date: log.date,
  });

  return NextResponse.json({ success: true });
}
