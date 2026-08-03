import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireCampAccess, requirePermission } from "@/lib/auth/api-guard";
import { createAuditLog } from "@/lib/services/animal-service";

function parseNoteDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  // Expect YYYY-MM-DD from <input type="date">
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireCampAccess(id);
  if (!access.ok) return access.error;

  const notes = await prisma.campNote.findMany({
    where: { campId: id },
    orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json(notes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireCampAccess(id);
  if (!access.ok) return access.error;

  const result = await requirePermission("addCampNotes");
  if (!result.ok) return result.error;

  const body = await req.json();
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Note text is required" }, { status: 400 });
  }

  const noteDate =
    parseNoteDate(body.noteDate) || parseNoteDate(todayYmd())!;

  const note = await prisma.campNote.create({
    data: {
      campId: id,
      body: text,
      noteDate,
      authorId: result.user.id,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  await createAuditLog(result.user.id, "CREATE", "CampNote", note.id, {
    campId: id,
    noteDate: note.noteDate,
  });

  return NextResponse.json(note, { status: 201 });
}
