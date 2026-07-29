import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAnimalAccess, requirePermission } from "@/lib/auth/api-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const photos = await prisma.animalPhoto.findMany({
    where: { animalId: id },
    orderBy: { takenAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  });

  return NextResponse.json(photos);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("editAnimal");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const photo = await prisma.animalPhoto.create({
    data: {
      animalId: id,
      url: body.url,
      caption: body.caption || null,
      takenAt: body.takenAt ? new Date(body.takenAt) : new Date(),
      uploadedById: result.user.id,
    },
    include: { uploadedBy: { select: { name: true } } },
  });

  await prisma.animal.update({
    where: { id },
    data: { photoUrl: body.url },
  });

  return NextResponse.json(photo, { status: 201 });
}
