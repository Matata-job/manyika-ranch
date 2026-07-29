import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const { id, recordId } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const record = await prisma.healthRecord.findFirst({
    where: { id: recordId, animalId: id },
  });
  if (!record) {
    return NextResponse.json({ error: "Health record not found" }, { status: 404 });
  }

  await prisma.healthRecord.delete({ where: { id: recordId } });

  await createAuditLog(result.user.id, "DELETE", "HealthRecord", recordId, {
    animalId: id,
    type: record.type,
    diagnosis: record.diagnosis,
  });

  return NextResponse.json({ success: true });
}
