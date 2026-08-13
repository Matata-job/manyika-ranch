import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requirePermission,
  requireAnimalAccess,
} from "@/lib/auth/api-guard";
import { logAnimalEvent } from "@/lib/services/event-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const take = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const events = await prisma.animalEvent.findMany({
    where: {
      animalId: id,
      ...(type ? { type: type as "NOTE" } : {}),
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take,
    include: { recordedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(events);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireAnimalAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("manageEvents");
  if (!result.ok) return result.error;

  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const event = await logAnimalEvent({
    animalId: id,
    type: body.type || "NOTE",
    title: body.title.trim(),
    description: body.description,
    occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    recordedById: result.user.id,
    metadata: body.metadata || null,
  });

  const full = await prisma.animalEvent.findUnique({
    where: { id: event.id },
    include: { recordedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(full, { status: 201 });
}
