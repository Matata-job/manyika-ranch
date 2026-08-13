import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  buildAnimalScope,
  resolveAccessibleCampIds,
} from "@/lib/auth/api-guard";
import { prismaDateRange } from "@/lib/reports/date-range";
import { computeProductionCosts } from "@/lib/production-cost";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewFinance");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const campId = searchParams.get("camp");
  const animalId = searchParams.get("animalId");

  const dateFilter = prismaDateRange(from, to);
  const periodFrom = dateFilter?.gte ?? new Date("1970-01-01T00:00:00.000Z");
  const periodTo = dateFilter?.lte ?? new Date();

  const animalScope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role,
    { campId: campId && campId !== "all" ? campId : null }
  );
  if ("error" in animalScope) return animalScope.error;

  if (animalId) {
    const allowed = await prisma.animal.findFirst({
      where: { id: animalId, ...animalScope },
      select: { id: true },
    });
    if (!allowed) {
      return NextResponse.json({ error: "Animal not found" }, { status: 404 });
    }
  }

  const accessible = await resolveAccessibleCampIds(
    result.user.id,
    result.user.role as Role
  );

  let campScope:
    | { campId: string }
    | { OR: ({ campId: null } | { campId: { in: string[] } })[] }
    | Record<string, never> = {};
  if (campId && campId !== "all") {
    if (accessible !== "all" && !accessible.includes(campId)) {
      return NextResponse.json(
        { error: "Forbidden: camp access denied" },
        { status: 403 }
      );
    }
    campScope = { campId };
  } else if (accessible !== "all") {
    campScope = {
      OR: [
        { campId: null },
        { campId: { in: accessible.length ? accessible : ["__none__"] } },
      ],
    };
  }

  const [animals, expenses] = await Promise.all([
    prisma.animal.findMany({
      where: {
        ...animalScope,
        ...(animalId ? { id: animalId } : {}),
        createdAt: { lte: periodTo },
      },
      select: {
        id: true,
        eartag: true,
        breed: true,
        sex: true,
        status: true,
        herdPlan: true,
        campId: true,
        camp: { select: { name: true } },
        acquisitionType: true,
        acquisitionDate: true,
        createdAt: true,
        dob: true,
        purchasePriceTzs: true,
        movements: {
          select: { date: true, fromCampId: true, toCampId: true },
          orderBy: { date: "asc" },
        },
        treatments: {
          where: {
            costTzs: { not: null },
            date: { gte: periodFrom, lte: periodTo },
          },
          select: { date: true, costTzs: true },
        },
        vaccinations: {
          where: {
            costTzs: { not: null },
            date: { gte: periodFrom, lte: periodTo },
          },
          select: { date: true, costTzs: true },
        },
        weightLogs: {
          where: { date: { lte: periodTo } },
          select: { date: true, weightKg: true },
          orderBy: { date: "asc" },
        },
        sales: {
          select: {
            saleDate: true,
            priceTzs: true,
            weightAtSale: true,
            returnedAt: true,
          },
        },
        deathRecord: { select: { date: true } },
      },
    }),
    prisma.expense.findMany({
      where: {
        ranchId: result.user.ranchId,
        ...campScope,
        date: { gte: periodFrom, lte: periodTo },
      },
      select: {
        id: true,
        amountTzs: true,
        date: true,
        campId: true,
        fundingSource: true,
        allocGroup: true,
      },
    }),
  ]);

  const computed = computeProductionCosts({
    periodFrom,
    periodTo,
    expenses,
    animals: animals.map((a) => ({
      id: a.id,
      eartag: a.eartag,
      breed: a.breed,
      sex: a.sex,
      status: a.status,
      herdPlan: a.herdPlan,
      campId: a.campId,
      campName: a.camp.name,
      acquisitionType: a.acquisitionType,
      acquisitionDate: a.acquisitionDate,
      createdAt: a.createdAt,
      dob: a.dob,
      purchasePriceTzs: a.purchasePriceTzs,
      movements: a.movements,
      treatments: a.treatments,
      vaccinations: a.vaccinations,
      weights: a.weightLogs,
      sales: a.sales,
      deathDate: a.deathRecord?.date ?? null,
    })),
  });

  const rows = animalId
    ? computed.rows
    : computed.rows.filter(
        (r) => r.periodCostTzs > 0 || r.animalDays > 0 || r.status === "ACTIVE"
      );

  return NextResponse.json({
    summary: computed.summary,
    rows,
  });
}
