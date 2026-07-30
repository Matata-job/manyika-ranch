import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCampAccess, requirePermission } from "@/lib/auth/api-guard";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { id, photoId } = await params;
  const access = await requireCampAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageCamps");
  if (!result.ok) return result.error;

  const photo = await prisma.campPhoto.findFirst({
    where: { id: photoId, campId: id },
  });
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  await prisma.campPhoto.delete({ where: { id: photoId } });
  return NextResponse.json({ success: true });
}
