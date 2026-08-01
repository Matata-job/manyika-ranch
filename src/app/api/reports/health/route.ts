import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import { ageGroupWhere } from "@/lib/reports/age-filter";
import { prismaDateRange } from "@/lib/reports/date-range";
import type { Prisma, Role } from "@prisma/client";

/**
 * Health report: vaccinations, treatments, and health checks in range,
 * filtered by camp and animal age group.
 */
export async function GET(req: NextRequest) {
  const result = await requirePermission("viewReports");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const ageGroup = searchParams.get("ageGroup");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const scope = await buildAnimalScope(result.user.id, result.user.role as Role, {
    campId: campId && campId !== "all" ? campId : null,
  });
  if ("error" in scope) return scope.error;

  const ageWhere = ageGroupWhere(ageGroup);
  const animalWhere: Prisma.AnimalWhereInput = {
    ...scope,
    ...(ageWhere ? { AND: [ageWhere] } : {}),
  };

  const dateRange = prismaDateRange(from, to);

  const [vaccinations, treatments, healthRecords] = await Promise.all([
    prisma.vaccination.findMany({
      where: {
        animal: animalWhere,
        ...(dateRange ? { date: dateRange } : {}),
      },
      include: {
        animal: {
          select: {
            id: true,
            eartag: true,
            breed: true,
            sex: true,
            ageMonths: true,
            camp: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 2000,
    }),
    prisma.treatment.findMany({
      where: {
        animal: animalWhere,
        ...(dateRange ? { date: dateRange } : {}),
      },
      include: {
        animal: {
          select: {
            id: true,
            eartag: true,
            breed: true,
            sex: true,
            ageMonths: true,
            camp: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 2000,
    }),
    prisma.healthRecord.findMany({
      where: {
        animal: animalWhere,
        ...(dateRange ? { date: dateRange } : {}),
      },
      include: {
        animal: {
          select: {
            id: true,
            eartag: true,
            breed: true,
            sex: true,
            ageMonths: true,
            camp: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 2000,
    }),
  ]);

  const dueCutoff = new Date();
  dueCutoff.setDate(dueCutoff.getDate() + 30);

  const [vaccDue, treatDue] = await Promise.all([
    prisma.vaccination.findMany({
      where: {
        animal: animalWhere,
        nextDue: { lte: dueCutoff, gte: new Date(0) },
      },
      include: {
        animal: {
          select: {
            id: true,
            eartag: true,
            camp: { select: { name: true } },
          },
        },
      },
      orderBy: { nextDue: "asc" },
      take: 200,
    }),
    prisma.treatment.findMany({
      where: {
        animal: animalWhere,
        nextDue: { lte: dueCutoff, gte: new Date(0) },
      },
      include: {
        animal: {
          select: {
            id: true,
            eartag: true,
            camp: { select: { name: true } },
          },
        },
      },
      orderBy: { nextDue: "asc" },
      take: 200,
    }),
  ]);

  return NextResponse.json({
    summary: {
      vaccinations: vaccinations.length,
      treatments: treatments.length,
      healthRecords: healthRecords.length,
      vaccinationsDue: vaccDue.length,
      treatmentsDue: treatDue.length,
    },
    vaccinations,
    treatments,
    healthRecords,
    vaccinationsDue: vaccDue,
    treatmentsDue: treatDue,
  });
}
