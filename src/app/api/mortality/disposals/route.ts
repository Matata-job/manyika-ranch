import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import {
  SELECTABLE_DISPOSAL_METHODS,
  getCustomDisposalMethods,
  normalizeCustomDisposalName,
} from "@/lib/death-causes";
import {
  getCustomMortalityPresets,
  remapCustomPresets,
} from "@/lib/mortality-presets";
import type { Prisma } from "@prisma/client";

function settingsRecord(settings: unknown): Record<string, unknown> {
  return (settings as Record<string, unknown>) || {};
}

export async function GET() {
  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });

  return NextResponse.json({
    system: [...SELECTABLE_DISPOSAL_METHODS],
    custom: getCustomDisposalMethods(ranch?.settings),
  });
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const body = await req.json().catch(() => ({}));
  const name = normalizeCustomDisposalName(String(body.name || ""));
  if (!name) {
    return NextResponse.json(
      { error: "Disposal name is required (max 80 characters)" },
      { status: 400 }
    );
  }

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });
  const current = settingsRecord(ranch?.settings);
  const existing = getCustomDisposalMethods(current);
  const already = existing.find((c) => c.toLowerCase() === name.toLowerCase());
  const nextList = already
    ? existing
    : [...existing, name].sort((a, b) => a.localeCompare(b));

  if (!already) {
    await prisma.ranch.update({
      where: { id: result.user.ranchId },
      data: {
        settings: {
          ...current,
          customDisposalMethods: nextList,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return NextResponse.json({
    system: [...SELECTABLE_DISPOSAL_METHODS],
    custom: nextList,
    added: name,
  });
}

export async function PATCH(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const body = await req.json().catch(() => ({}));
  const oldName = normalizeCustomDisposalName(String(body.name || ""));
  const newName = normalizeCustomDisposalName(String(body.newName || ""));
  if (!oldName || !newName) {
    return NextResponse.json(
      { error: "Disposal name is required (max 80 characters)" },
      { status: 400 }
    );
  }

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });
  const current = settingsRecord(ranch?.settings);
  const existing = getCustomDisposalMethods(current);
  const index = existing.findIndex((c) => c.toLowerCase() === oldName.toLowerCase());
  if (index < 0) {
    return NextResponse.json({ error: "Disposal not found" }, { status: 404 });
  }

  const clash = existing.find(
    (c, i) => i !== index && c.toLowerCase() === newName.toLowerCase()
  );
  if (clash) {
    return NextResponse.json(
      { error: "A disposal with that name already exists" },
      { status: 409 }
    );
  }

  const nextList = [...existing];
  nextList[index] = newName;
  nextList.sort((a, b) => a.localeCompare(b));

  const presets = remapCustomPresets(
    getCustomMortalityPresets(current),
    "disposalMethod",
    `custom:${existing[index]}`,
    `custom:${newName}`
  );

  await prisma.ranch.update({
    where: { id: result.user.ranchId },
    data: {
      settings: {
        ...current,
        customDisposalMethods: nextList,
        mortalityPresets: presets,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ custom: nextList, renamed: newName });
}

export async function DELETE(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const name = normalizeCustomDisposalName(
    String(req.nextUrl.searchParams.get("name") || "")
  );
  if (!name) {
    return NextResponse.json({ error: "Disposal name is required" }, { status: 400 });
  }

  const ranch = await prisma.ranch.findUnique({
    where: { id: result.user.ranchId },
    select: { settings: true },
  });
  const current = settingsRecord(ranch?.settings);
  const existing = getCustomDisposalMethods(current);
  const match = existing.find((c) => c.toLowerCase() === name.toLowerCase());
  const nextList = existing.filter(
    (c) => c.toLowerCase() !== name.toLowerCase()
  );

  if (nextList.length === existing.length || !match) {
    return NextResponse.json({ error: "Disposal not found" }, { status: 404 });
  }

  const presets = remapCustomPresets(
    getCustomMortalityPresets(current),
    "disposalMethod",
    `custom:${match}`,
    "OTHER"
  );

  await prisma.ranch.update({
    where: { id: result.user.ranchId },
    data: {
      settings: {
        ...current,
        customDisposalMethods: nextList,
        mortalityPresets: presets,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ custom: nextList, removed: name });
}
