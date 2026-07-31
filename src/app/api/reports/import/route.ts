import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/api-guard";
import { computeAgeMonths } from "@/lib/utils";
import { createAuditLog } from "@/lib/services/animal-service";

interface ImportRow {
  eartag: string;
  breed: string;
  sex: "MALE" | "FEMALE" | "UNKNOWN" | string;
  campName: string;
  dob?: string;
  ownerEmail?: string;
  sireEartag?: string;
  damEartag?: string;
  colorMarkings?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const result = await requirePermission("importData");
  if (!result.ok) return result.error;

  const { rows } = (await req.json()) as { rows: ImportRow[] };
  const results: { eartag: string; success: boolean; error?: string }[] = [];

  const camps = await prisma.camp.findMany({ where: { ranchId: result.user.ranchId } });
  const campByName = new Map(camps.map((c) => [c.name.toLowerCase(), c.id]));

  const users = await prisma.user.findMany({ where: { ranchId: result.user.ranchId } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

  for (const row of rows) {
    try {
      const campId = campByName.get(row.campName.toLowerCase());
      if (!campId) throw new Error(`Camp not found: ${row.campName}`);

      const existing = await prisma.animal.findUnique({ where: { eartag: row.eartag } });
      if (existing) throw new Error("Eartag already exists");

      let sireId: string | undefined;
      let damId: string | undefined;
      if (row.sireEartag) {
        const sire = await prisma.animal.findUnique({ where: { eartag: row.sireEartag } });
        sireId = sire?.id;
      }
      if (row.damEartag) {
        const dam = await prisma.animal.findUnique({ where: { eartag: row.damEartag } });
        damId = dam?.id;
      }

      const ownerId =
        (row.ownerEmail && userByEmail.get(row.ownerEmail.toLowerCase())) || result.user.id;
      const dob = row.dob ? new Date(row.dob) : null;
      const sexRaw = String(row.sex || "").toUpperCase();
      const sex =
        sexRaw === "MALE" || sexRaw === "M"
          ? "MALE"
          : sexRaw === "FEMALE" || sexRaw === "F"
            ? "FEMALE"
            : sexRaw === "UNKNOWN" || sexRaw === "U" || sexRaw === "?"
              ? "UNKNOWN"
              : null;
      if (!sex) throw new Error(`Invalid sex: ${row.sex}`);

      await prisma.animal.create({
        data: {
          eartag: row.eartag,
          breed: row.breed,
          sex,
          campId,
          ownerId,
          sireId,
          damId,
          dob,
          ageMonths: dob ? computeAgeMonths(dob) : null,
          colorMarkings: row.colorMarkings,
          notes: row.notes,
          status: "ACTIVE",
        },
      });

      results.push({ eartag: row.eartag, success: true });
    } catch (e) {
      results.push({
        eartag: row.eartag,
        success: false,
        error: e instanceof Error ? e.message : "Import failed",
      });
    }
  }

  await createAuditLog(result.user.id, "IMPORT", "Animal", "bulk", {
    total: rows.length,
    success: results.filter((r) => r.success).length,
  });

  return NextResponse.json({ results });
}
