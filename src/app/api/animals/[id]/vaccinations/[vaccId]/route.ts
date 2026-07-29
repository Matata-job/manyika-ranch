import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vaccId: string }> }
) {
  const { id, vaccId } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const vaccination = await prisma.vaccination.findFirst({
    where: { id: vaccId, animalId: id },
  });
  if (!vaccination) {
    return NextResponse.json({ error: "Vaccination not found" }, { status: 404 });
  }

  await prisma.vaccination.delete({ where: { id: vaccId } });

  await createAuditLog(result.user.id, "DELETE", "Vaccination", vaccId, {
    animalId: id,
    vaccineName: vaccination.vaccineName,
    date: vaccination.date,
  });

  return NextResponse.json({ success: true });
}
