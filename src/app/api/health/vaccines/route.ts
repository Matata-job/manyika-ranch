import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";

export async function GET() {
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const vaccines = await prisma.vaccineCatalog.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(vaccines);
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageHealth");
  if (!result.ok) return result.error;

  const body = await req.json();
  const vaccine = await prisma.vaccineCatalog.create({
    data: {
      name: body.name,
      intervalDays: body.intervalDays,
      species: body.species || "cattle",
      description: body.description,
    },
  });

  return NextResponse.json(vaccine, { status: 201 });
}
