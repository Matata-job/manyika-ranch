import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildAnimalScope } from "@/lib/auth/api-guard";
import { hasPermission } from "@/lib/auth/rbac";
import {
  getHealthCalendar,
  getHealthNotifyDaysEarly,
  DEFAULT_HEALTH_CALENDAR_DAYS,
} from "@/lib/services/health-schedule";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const role = result.user.role as Role;
  if (!hasPermission(role, "manageHealth") && !hasPermission(role, "viewReports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const campId = searchParams.get("camp");
  const daysAheadRaw = searchParams.get("days");
  const daysAhead = daysAheadRaw
    ? Math.min(Math.max(parseInt(daysAheadRaw, 10) || DEFAULT_HEALTH_CALENDAR_DAYS, 7), 180)
    : DEFAULT_HEALTH_CALENDAR_DAYS;

  const animalScope = await buildAnimalScope(result.user.id, role, { campId });
  if ("error" in animalScope) return animalScope.error;

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });
  const notifyDaysEarly = getHealthNotifyDaysEarly(ranch?.settings);

  // Refresh all automated alerts when calendar is opened
  const { syncAllRanchAlerts } = await import("@/lib/services/alert-sync");
  await syncAllRanchAlerts(result.user.ranchId);

  const calendar = await getHealthCalendar({
    animalWhere: animalScope,
    daysAhead,
    notifyDaysEarly,
  });

  return NextResponse.json(calendar);
}
