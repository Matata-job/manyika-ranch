import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const existing = await prisma.vaccineCatalog.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Vaccine not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    data.name = String(body.name).trim();
  }
  if (body.intervalDays !== undefined) {
    if (body.intervalDays === null || body.intervalDays === "") {
      data.intervalDays = null;
    } else {
      const n = parseInt(String(body.intervalDays), 10);
      data.intervalDays = Number.isFinite(n) ? n : null;
    }
  }
  if (body.description !== undefined) {
    data.description = body.description?.trim() || null;
  }
  if (body.species !== undefined) {
    data.species = body.species?.trim() || "cattle";
  }

  try {
    const vaccine = await prisma.vaccineCatalog.update({ where: { id }, data });
    return NextResponse.json(vaccine);
  } catch {
    return NextResponse.json(
      { error: "A vaccine with that name already exists" },
      { status: 409 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const existing = await prisma.vaccineCatalog.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Vaccine not found" }, { status: 404 });
  }

  // Unlink vaccinations then delete catalog entry
  await prisma.vaccination.updateMany({
    where: { vaccineCatalogId: id },
    data: { vaccineCatalogId: null },
  });
  await prisma.vaccineCatalog.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
