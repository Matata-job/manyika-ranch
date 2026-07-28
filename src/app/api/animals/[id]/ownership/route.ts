import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;
  const fromOwnerId = access.animal.ownerId;

  const result = await requirePermission("editAnimal");
  if (!result.ok) return result.error;

  const body = await req.json();

  const transfer = await prisma.ownershipTransfer.create({
    data: {
      animalId: id,
      fromOwnerId,
      toOwnerId: body.toOwnerId,
      date: body.date ? new Date(body.date) : new Date(),
      price: body.price,
      recordedById: result.user.id,
      notes: body.notes,
    },
  });

  await prisma.animal.update({
    where: { id },
    data: { ownerId: body.toOwnerId },
  });

  await createAuditLog(result.user.id, "TRANSFER_OWNERSHIP", "Animal", id, body);
  return NextResponse.json(transfer, { status: 201 });
}
