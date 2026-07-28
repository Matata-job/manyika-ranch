import { prisma } from "@/lib/db";
import type { AnimalEventType, Prisma } from "@prisma/client";

export async function logAnimalEvent(params: {
  animalId: string;
  type: AnimalEventType;
  title: string;
  description?: string | null;
  occurredAt?: Date;
  recordedById?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.animalEvent.create({
    data: {
      animalId: params.animalId,
      type: params.type,
      title: params.title,
      description: params.description || undefined,
      occurredAt: params.occurredAt || new Date(),
      recordedById: params.recordedById || undefined,
      metadata: (params.metadata as Prisma.InputJsonValue) || undefined,
    },
  });
}
