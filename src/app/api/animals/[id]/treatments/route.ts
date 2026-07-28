import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requireAnimalAccess } from "@/lib/auth/api-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const treatments = await prisma.treatment.findMany({
    where: { animalId: id },
    orderBy: { date: "desc" },
    include: { administeredBy: { select: { name: true } } },
  });

  return NextResponse.json(treatments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const body = await req.json();
  const treatment = await prisma.treatment.create({
    data: {
      animalId: id,
      type: body.type,
      product: body.product,
      dose: body.dose,
      withdrawalPeriod: body.withdrawalPeriod,
      date: body.date ? new Date(body.date) : new Date(),
      administeredById: result.user.id,
      notes: body.notes,
    },
  });

  return NextResponse.json(treatment, { status: 201 });
}
