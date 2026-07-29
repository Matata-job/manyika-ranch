import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import type { TreatmentType } from "@prisma/client";

const TYPES: TreatmentType[] = ["DEWORMING", "DIPPING", "ANTIBIOTIC", "OTHER"];

export async function GET() {
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const items = await prisma.treatmentCatalog.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const type = (body.type || "OTHER") as TreatmentType;
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const intervalDays =
    body.intervalDays != null && body.intervalDays !== ""
      ? parseInt(String(body.intervalDays), 10)
      : null;
  const withdrawalPeriod =
    body.withdrawalPeriod != null && body.withdrawalPeriod !== ""
      ? parseInt(String(body.withdrawalPeriod), 10)
      : null;

  try {
    const item = await prisma.treatmentCatalog.create({
      data: {
        name: body.name.trim(),
        type,
        intervalDays:
          intervalDays != null && Number.isFinite(intervalDays)
            ? intervalDays
            : null,
        withdrawalPeriod:
          withdrawalPeriod != null && Number.isFinite(withdrawalPeriod)
            ? withdrawalPeriod
            : null,
        description: body.description?.trim() || null,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A treatment schedule with that name already exists" },
      { status: 409 }
    );
  }
}
