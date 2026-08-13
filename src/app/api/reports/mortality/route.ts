import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewReports");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const animalScope = await buildAnimalScope(result.user.id, result.user.role as Role, {
    campId,
  });
  if ("error" in animalScope) return animalScope.error;

  const dateFilter = {
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const records = await prisma.deathRecord.findMany({
    where: {
      ...dateFilter,
      animal: animalScope,
    },
    orderBy: { date: "desc" },
    take: 200,
    include: {
      animal: {
        select: {
          id: true,
          eartag: true,
          breed: true,
          sex: true,
          camp: { select: { id: true, name: true } },
        },
      },
      recordedBy: { select: { name: true } },
    },
  });

  const cullings = records.filter((r) => r.isCulling).length;
  const deaths = records.length - cullings;
  const insuranceClaims = records.filter((r) => r.insuranceClaim).length;

  const byCause = records.reduce(
    (acc, r) => {
      const key =
        r.cause === "OTHER" && r.causeDetail?.trim()
          ? r.causeDetail.trim()
          : r.cause;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({
    total: records.length,
    deaths,
    cullings,
    insuranceClaims,
    byCause,
    records,
  });
}
