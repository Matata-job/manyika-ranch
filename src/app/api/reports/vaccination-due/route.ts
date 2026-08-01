import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildAnimalScope } from "@/lib/auth/api-guard";
import {
  getHealthNotifyDaysEarly,
  DEFAULT_HEALTH_CALENDAR_DAYS,
} from "@/lib/services/health-schedule";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requirePermission("viewReports");
  if (!result.ok) return result.error;

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const daysRaw = searchParams.get("days");
  const days = daysRaw
    ? Math.min(Math.max(parseInt(daysRaw, 10) || DEFAULT_HEALTH_CALENDAR_DAYS, 1), 180)
    : undefined;

  const animalScope = await buildAnimalScope(
    result.user.id,
    result.user.role as Role,
    { campId }
  );
  if ("error" in animalScope) return animalScope.error;

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });
  const windowDays = days ?? Math.max(getHealthNotifyDaysEarly(ranch?.settings), 30);
  const horizon = new Date(Date.now() + windowDays * 86400000);

  const due = await prisma.vaccination.findMany({
    where: {
      nextDue: { lte: horizon, not: null },
      animal: {
        status: "ACTIVE",
        ...animalScope,
      },
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
  });

  return NextResponse.json(due);
}
