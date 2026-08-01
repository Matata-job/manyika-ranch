import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { hasPermission } from "@/lib/auth/rbac";
import { syncAllRanchAlerts } from "@/lib/services/alert-sync";
import type { Role } from "@prisma/client";

export async function POST() {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const role = result.user.role as Role;
  if (
    !hasPermission(role, "manageHealth") &&
    !hasPermission(role, "viewReports") &&
    !hasPermission(role, "viewAnimal")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const summary = await syncAllRanchAlerts(result.user.ranchId);
  return NextResponse.json(summary);
}
