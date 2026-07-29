import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  resolveAccessibleCampIds,
} from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";
import type { OtherIncomeCategory, Prisma, Role } from "@prisma/client";

async function financeCampFilter(
  userId: string,
  role: Role,
  campId: string | null
): Promise<Prisma.OtherIncomeWhereInput | { error: NextResponse }> {
  const accessible = await resolveAccessibleCampIds(userId, role);
  if (campId && campId !== "all") {
    if (accessible !== "all" && !accessible.includes(campId)) {
      return {
        error: NextResponse.json({ error: "Forbidden: camp access denied" }, { status: 403 }),
      };
    }
    return { campId };
  }
  if (accessible === "all") return {};
  return {
    OR: [{ campId: null }, { campId: { in: accessible.length ? accessible : ["__none__"] } }],
  };
}

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewFinance");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const campId = searchParams.get("camp");
  const category = searchParams.get("category");

  const campFilter = await financeCampFilter(
    result.user.id,
    result.user.role as Role,
    campId
  );
  if ("error" in campFilter) return campFilter.error;

  const incomes = await prisma.otherIncome.findMany({
    where: {
      ranchId: result.user.ranchId,
      ...campFilter,
      ...(category && category !== "all"
        ? { category: category as OtherIncomeCategory }
        : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    include: {
      camp: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  const total = incomes.reduce((sum, e) => sum + e.amountTzs, 0);

  return NextResponse.json({ incomes, total });
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageFinance");
  if (!result.ok) return result.error;

  const body = await req.json();
  const amountTzs = parseFloat(body.amountTzs);
  if (!Number.isFinite(amountTzs) || amountTzs < 0) {
    return NextResponse.json({ error: "Valid amount (TZS) is required" }, { status: 400 });
  }
  if (!body.category) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }

  if (body.campId) {
    const camp = await prisma.camp.findFirst({
      where: { id: body.campId, ranchId: result.user.ranchId },
    });
    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 });
    }
  }

  const income = await prisma.otherIncome.create({
    data: {
      ranchId: result.user.ranchId,
      category: body.category,
      amountTzs,
      date: body.date ? new Date(body.date) : new Date(),
      description: body.description?.trim() || null,
      campId: body.campId || null,
      recordedById: result.user.id,
      notes: body.notes?.trim() || null,
    },
    include: {
      camp: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
    },
  });

  await createAuditLog(result.user.id, "CREATE", "OtherIncome", income.id, {
    category: income.category,
    amountTzs: income.amountTzs,
  });

  return NextResponse.json(income, { status: 201 });
}
