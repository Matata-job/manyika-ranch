import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildAlertScope } from "@/lib/auth/api-guard";
import type { Role } from "@prisma/client";

export async function GET() {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const alertScope = await buildAlertScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in alertScope) return alertScope.error;

  const alerts = await prisma.alert.findMany({
    where: {
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
      ...alertScope,
    },
    include: {
      animal: { select: { id: true, eartag: true } },
      assignee: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(alerts);
}

export async function PATCH(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const body = await req.json();

  const existing = await prisma.alert.findUnique({
    where: { id: body.id },
    select: { id: true, animalId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const alertScope = await buildAlertScope(
    result.user.id,
    result.user.role as Role
  );
  if ("error" in alertScope) return alertScope.error;

  const allowed = await prisma.alert.findFirst({
    where: { id: existing.id, ...alertScope },
    select: { id: true },
  });
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const alert = await prisma.alert.update({
    where: { id: body.id },
    data: {
      status: body.status,
      assigneeId: body.assigneeId,
      resolvedAt: body.status === "RESOLVED" ? new Date() : null,
    },
  });

  return NextResponse.json(alert);
}
