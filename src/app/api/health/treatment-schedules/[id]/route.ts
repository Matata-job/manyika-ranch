import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import type { TreatmentType } from "@prisma/client";

const TYPES: TreatmentType[] = ["DEWORMING", "DIPPING", "ANTIBIOTIC", "OTHER"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const existing = await prisma.treatmentCatalog.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    data.name = String(body.name).trim();
  }
  if (body.type !== undefined) {
    if (!TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    data.type = body.type;
  }
  if (body.intervalDays !== undefined) {
    if (body.intervalDays === null || body.intervalDays === "") {
      data.intervalDays = null;
    } else {
      const n = parseInt(String(body.intervalDays), 10);
      data.intervalDays = Number.isFinite(n) ? n : null;
    }
  }
  if (body.withdrawalPeriod !== undefined) {
    if (body.withdrawalPeriod === null || body.withdrawalPeriod === "") {
      data.withdrawalPeriod = null;
    } else {
      const n = parseInt(String(body.withdrawalPeriod), 10);
      data.withdrawalPeriod = Number.isFinite(n) ? n : null;
    }
  }
  if (body.description !== undefined) {
    data.description = body.description?.trim() || null;
  }

  try {
    const item = await prisma.treatmentCatalog.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json(
      { error: "A treatment schedule with that name already exists" },
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

  const existing = await prisma.treatmentCatalog.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.treatment.updateMany({
    where: { treatmentCatalogId: id },
    data: { treatmentCatalogId: null },
  });
  await prisma.treatmentCatalog.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
