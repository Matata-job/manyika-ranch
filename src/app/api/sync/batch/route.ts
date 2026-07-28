import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  requireCampAccess,
  requireAnimalAccess,
} from "@/lib/auth/api-guard";
import { computeAgeMonths } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const { items } = await req.json();
  const results: { success: boolean; error?: string }[] = [];

  for (const item of items) {
    try {
      const { action, entity, payload } = item;

      if (entity === "animal" && action === "create") {
        const campAccess = await requireCampAccess(payload.campId as string);
        if (!campAccess.ok) {
          results.push({ success: false, error: "Camp access denied" });
          continue;
        }

        const existing = await prisma.animal.findUnique({
          where: { eartag: payload.eartag as string },
        });
        if (existing) {
          results.push({ success: false, error: "Eartag conflict" });
          continue;
        }
        const dob = payload.dob ? new Date(payload.dob as string) : null;
        await prisma.animal.create({
          data: {
            eartag: payload.eartag as string,
            breed: payload.breed as string,
            sex: payload.sex as "MALE" | "FEMALE",
            campId: payload.campId as string,
            ownerId: (payload.ownerId as string) || result.user.id,
            dob,
            ageMonths: dob ? computeAgeMonths(dob) : null,
            notes: payload.notes as string | undefined,
            status: "ACTIVE",
          },
        });
      } else if (entity === "weight" && action === "create") {
        const animalAccess = await requireAnimalAccess(payload.animalId as string);
        if (!animalAccess.ok) {
          results.push({ success: false, error: "Animal access denied" });
          continue;
        }
        await prisma.weightLog.create({
          data: {
            animalId: payload.animalId as string,
            weightKg: payload.weightKg as number,
            date: payload.date ? new Date(payload.date as string) : new Date(),
            recordedById: result.user.id,
            method: (payload.method as string) || "scale",
          },
        });
      } else if (entity === "health" && action === "create") {
        const animalAccess = await requireAnimalAccess(payload.animalId as string);
        if (!animalAccess.ok) {
          results.push({ success: false, error: "Animal access denied" });
          continue;
        }
        await prisma.healthRecord.create({
          data: {
            animalId: payload.animalId as string,
            type: payload.type as "ILLNESS" | "INJURY" | "CHECKUP" | "OTHER",
            diagnosis: payload.diagnosis as string | undefined,
            treatment: payload.treatment as string | undefined,
            vetId: result.user.id,
            date: payload.date ? new Date(payload.date as string) : new Date(),
          },
        });
      } else if (entity === "vaccination" && action === "create") {
        const animalAccess = await requireAnimalAccess(payload.animalId as string);
        if (!animalAccess.ok) {
          results.push({ success: false, error: "Animal access denied" });
          continue;
        }
        await prisma.vaccination.create({
          data: {
            animalId: payload.animalId as string,
            vaccineName: payload.vaccineName as string,
            date: payload.date ? new Date(payload.date as string) : new Date(),
            nextDue: payload.nextDue ? new Date(payload.nextDue as string) : null,
            administeredById: result.user.id,
          },
        });
      } else {
        results.push({ success: false, error: "Unsupported sync item" });
        continue;
      }

      results.push({ success: true });
    } catch (e) {
      results.push({
        success: false,
        error: e instanceof Error ? e.message : "Sync failed",
      });
    }
  }

  return NextResponse.json({ results });
}
