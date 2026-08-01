import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { hasPermission } from "@/lib/auth/rbac";
import { syncHealthDueAlerts } from "@/lib/services/health-schedule";
import type { Role } from "@prisma/client";

export async function POST() {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const role = result.user.role as Role;
  if (!hasPermission(role, "manageHealth") && !hasPermission(role, "viewReports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const summary = await syncHealthDueAlerts(result.user.ranchId);
  return NextResponse.json(summary);
}
