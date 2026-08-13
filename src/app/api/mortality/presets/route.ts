import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import {
  isKnownDisposalFormValue,
} from "@/lib/death-causes";
import {
  getCustomMortalityPresets,
  SYSTEM_MORTALITY_PRESETS,
  type CustomMortalityPreset,
} from "@/lib/mortality-presets";
import type { Prisma } from "@prisma/client";

function normalizeLabel(label: string): string | null {
  const trimmed = label.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 80) return null;
  return trimmed;
}

function isValidDisposal(value: string): boolean {
  return isKnownDisposalFormValue(value);
}

async function readCustomPresets(ranchId: string): Promise<CustomMortalityPreset[]> {
  const ranch = await prisma.ranch.findUnique({
    where: { id: ranchId },
    select: { settings: true },
  });
  return getCustomMortalityPresets(ranch?.settings);
}

async function writeCustomPresets(
  ranchId: string,
  presets: CustomMortalityPreset[]
) {
  const ranch = await prisma.ranch.findUnique({
    where: { id: ranchId },
    select: { settings: true },
  });
  const current = (ranch?.settings as Record<string, unknown>) || {};
  await prisma.ranch.update({
    where: { id: ranchId },
    data: {
      settings: {
        ...current,
        mortalityPresets: presets,
      } as Prisma.InputJsonValue,
    },
  });
}

export async function GET() {
  const result = await requirePermission("viewAnimal");
  if (!result.ok) return result.error;

  const custom = await readCustomPresets(result.user.ranchId);
  return NextResponse.json({
    system: SYSTEM_MORTALITY_PRESETS.map((p) => ({
      id: p.id,
      labelKey: p.labelKey,
      causeValue: p.causeValue,
      disposalMethod: p.disposalMethod,
      isCulling: p.isCulling,
      system: true,
    })),
    custom,
  });
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const body = await req.json().catch(() => ({}));
  const label = normalizeLabel(String(body.label || ""));
  const disposalMethod = String(body.disposalMethod || "");
  if (!label) {
    return NextResponse.json({ error: "Preset label is required" }, { status: 400 });
  }
  if (!isValidDisposal(disposalMethod)) {
    return NextResponse.json({ error: "Invalid disposal method" }, { status: 400 });
  }

  const causeValue =
    typeof body.causeValue === "string" && body.causeValue.trim()
      ? body.causeValue.trim()
      : undefined;

  const preset: CustomMortalityPreset = {
    id: `custom:${randomUUID()}`,
    label,
    causeValue,
    disposalMethod,
    isCulling: Boolean(body.isCulling),
  };

  const existing = await readCustomPresets(result.user.ranchId);
  const next = [...existing, preset];
  await writeCustomPresets(result.user.ranchId, next);

  return NextResponse.json({ preset, custom: next });
}

export async function PATCH(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id.startsWith("custom:")) {
    return NextResponse.json(
      { error: "Only custom presets can be edited" },
      { status: 400 }
    );
  }

  const existing = await readCustomPresets(result.user.ranchId);
  const index = existing.findIndex((p) => p.id === id);
  if (index < 0) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  const current = existing[index];
  const label =
    body.label !== undefined
      ? normalizeLabel(String(body.label))
      : current.label;
  if (!label) {
    return NextResponse.json({ error: "Preset label is required" }, { status: 400 });
  }

  let disposalMethod = current.disposalMethod;
  if (body.disposalMethod !== undefined) {
    const next = String(body.disposalMethod);
    if (!isValidDisposal(next)) {
      return NextResponse.json({ error: "Invalid disposal method" }, { status: 400 });
    }
    disposalMethod = next;
  }

  const causeValue =
    body.causeValue === null || body.causeValue === ""
      ? undefined
      : body.causeValue !== undefined
        ? String(body.causeValue).trim() || undefined
        : current.causeValue;

  const updated: CustomMortalityPreset = {
    ...current,
    label,
    causeValue,
    disposalMethod,
    isCulling:
      body.isCulling !== undefined ? Boolean(body.isCulling) : current.isCulling,
  };

  const next = [...existing];
  next[index] = updated;
  await writeCustomPresets(result.user.ranchId, next);

  return NextResponse.json({ preset: updated, custom: next });
}

export async function DELETE(req: NextRequest) {
  const result = await requirePermission("manageMortality");
  if (!result.ok) return result.error;

  const id = String(req.nextUrl.searchParams.get("id") || "");
  if (!id.startsWith("custom:")) {
    return NextResponse.json(
      { error: "Only custom presets can be deleted" },
      { status: 400 }
    );
  }

  const existing = await readCustomPresets(result.user.ranchId);
  const next = existing.filter((p) => p.id !== id);
  if (next.length === existing.length) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  await writeCustomPresets(result.user.ranchId, next);
  return NextResponse.json({ custom: next, removed: id });
}
