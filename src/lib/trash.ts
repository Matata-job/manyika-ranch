/** Soft-delete / Recently deleted retention helpers. */

export const DEFAULT_TRASH_RETENTION_DAYS = 30;

export function getTrashRetentionDays(settings: unknown): number {
  const raw = (settings as { trashRetentionDays?: unknown } | null)
    ?.trashRetentionDays;
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return DEFAULT_TRASH_RETENTION_DAYS;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

export function trashExpiresAt(
  deletedAt: Date,
  retentionDays: number
): Date {
  const d = new Date(deletedAt);
  d.setDate(d.getDate() + retentionDays);
  return d;
}

export function daysLeftInTrash(
  deletedAt: Date,
  retentionDays: number,
  now = new Date()
): number {
  const expires = trashExpiresAt(deletedAt, retentionDays);
  const ms = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function isTrashExpired(
  deletedAt: Date,
  retentionDays: number,
  now = new Date()
): boolean {
  return now.getTime() >= trashExpiresAt(deletedAt, retentionDays).getTime();
}

/** Prisma filter: exclude soft-deleted rows. */
export const notDeleted = { deletedAt: null } as const;
