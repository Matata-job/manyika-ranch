import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAuth,
  requireCampAccess,
  requireAnimalAccess,
} from "@/lib/auth/api-guard";
import { computeAgeMonths } from "@/lib/utils";
import { createAuditLog } from "@/lib/services/animal-service";
import { logAnimalEvent } from "@/lib/services/event-service";

function resolveAgeMonths(payload: Record<string, unknown>): number | null {
  const dob = payload.dob ? new Date(payload.dob as string) : null;
  if (dob) return computeAgeMonths(dob);
  if (typeof payload.ageMonths === "number") return payload.ageMonths as number;
  if (payload.ageYears != null || payload.ageMonthsPart != null) {
    return Math.max(
      0,
      (Number(payload.ageYears) || 0) * 12 + (Number(payload.ageMonthsPart) || 0)
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const { items } = await req.json();
  const results: { success: boolean; error?: string }[] = [];

  for (const item of items) {
    try {
      const { action, entity, payload, timestamp } = item;

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

        const sireId = (payload.sireId as string) || null;
        const damId = (payload.damId as string) || null;
        if (sireId) {
          const sire = await prisma.animal.findFirst({
            where: { id: sireId, sex: "MALE" },
            select: { id: true },
          });
          if (!sire) {
            results.push({ success: false, error: "Sire must be a male animal" });
            continue;
          }
        }
        if (damId) {
          const dam = await prisma.animal.findFirst({
            where: { id: damId, sex: "FEMALE" },
            select: { id: true },
          });
          if (!dam) {
            results.push({ success: false, error: "Dam must be a female animal" });
            continue;
          }
        }

        const dob = payload.dob ? new Date(payload.dob as string) : null;
        const sex = payload.sex as "MALE" | "FEMALE";
        const photoUrls: string[] = Array.isArray(payload.photoUrls)
          ? (payload.photoUrls as string[])
          : [];
        const primaryPhoto = photoUrls[0] || (payload.photoUrl as string) || null;
        const occurredAt =
          typeof timestamp === "number"
            ? new Date(timestamp)
            : payload.recordedOfflineAt
              ? new Date(payload.recordedOfflineAt as string)
              : new Date();

        const animal = await prisma.animal.create({
          data: {
            eartag: payload.eartag as string,
            rfidChip: (payload.rfidChip as string) || null,
            photoUrl: primaryPhoto,
            breed: payload.breed as string,
            sex,
            isCastrated: sex === "MALE" ? Boolean(payload.isCastrated) : false,
            isPregnant: sex === "FEMALE" ? Boolean(payload.isPregnant) : false,
            dob,
            ageMonths: resolveAgeMonths(payload),
            ownerId: (payload.ownerId as string) || result.user.id,
            sireId,
            damId,
            campId: payload.campId as string,
            status: (payload.status as "ACTIVE") || "ACTIVE",
            acquisitionType:
              (payload.acquisitionType as
                | "BORN_ON_FARM"
                | "PURCHASED"
                | "GIFT") || "BORN_ON_FARM",
            acquisitionDate: payload.acquisitionDate
              ? new Date(payload.acquisitionDate as string)
              : null,
            colorMarkings: (payload.colorMarkings as string) || null,
            notes: (payload.notes as string) || null,
          },
          include: {
            camp: { select: { id: true, name: true } },
          },
        });

        if (photoUrls.length > 0) {
          await prisma.animalPhoto.createMany({
            data: photoUrls.map((url) => ({
              animalId: animal.id,
              url,
              takenAt: occurredAt,
              uploadedById: result.user.id,
            })),
          });
        }

        await createAuditLog(result.user.id, "CREATE", "Animal", animal.id, {
          eartag: animal.eartag,
          breed: animal.breed,
          sex: animal.sex,
          campId: animal.campId,
          ownerId: animal.ownerId,
          acquisitionType: animal.acquisitionType,
          acquisitionDate: animal.acquisitionDate,
          dob: animal.dob,
          photoCount: photoUrls.length,
          syncedFromOffline: true,
        });

        await logAnimalEvent({
          animalId: animal.id,
          type: "REGISTERED",
          title: `Registered ${animal.eartag}`,
          description: `${animal.breed} · ${animal.sex} · Camp ${animal.camp.name}${
            photoUrls.length ? ` · ${photoUrls.length} photo(s)` : ""
          } · synced from offline`,
          occurredAt,
          recordedById: result.user.id,
          metadata: {
            campId: animal.campId,
            breed: animal.breed,
            syncedFromOffline: true,
            photoCount: photoUrls.length,
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
