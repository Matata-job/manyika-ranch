import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewBuyers");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const activeOnly = searchParams.get("active") !== "false";

  const buyers = await prisma.buyer.findMany({
    where: {
      ranchId: result.user.ranchId,
      ...(activeOnly ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { sales: true } },
    },
    take: 100,
  });

  return NextResponse.json(buyers);
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageBuyers");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const buyer = await prisma.buyer.create({
    data: {
      ranchId: result.user.ranchId,
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      location: body.location?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  });

  await createAuditLog(result.user.id, "CREATE", "Buyer", buyer.id, {
    name: buyer.name,
  });

  return NextResponse.json(buyer, { status: 201 });
}
