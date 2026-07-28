import Dexie, { type EntityTable } from "dexie";

export interface SyncQueueItem {
  id: number;
  action: "create" | "update" | "delete";
  entity: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  status: "pending" | "syncing" | "failed" | "synced";
  error?: string;
}

export interface CachedAnimal {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  campId: string;
  status: string;
  photoUrl?: string | null;
  updatedAt: string;
}

export interface CachedCamp {
  id: string;
  name: string;
  animalCount: number;
  updatedAt: string;
}

class RanchDatabase extends Dexie {
  syncQueue!: EntityTable<SyncQueueItem, "id">;
  animals!: EntityTable<CachedAnimal, "id">;
  camps!: EntityTable<CachedCamp, "id">;

  constructor() {
    super("RanchDB");
    this.version(1).stores({
      syncQueue: "++id, entity, status, timestamp",
      animals: "id, eartag, campId, updatedAt",
      camps: "id, name, updatedAt",
    });
  }
}

export const db = typeof window !== "undefined" ? new RanchDatabase() : null;

export async function enqueueSync(
  action: SyncQueueItem["action"],
  entity: string,
  payload: Record<string, unknown>
) {
  if (!db) return;
  await db.syncQueue.add({
    action,
    entity,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    status: "pending",
  });
}

export async function getPendingSyncCount(): Promise<number> {
  if (!db) return 0;
  return db.syncQueue.where("status").anyOf(["pending", "failed"]).count();
}

export async function flushSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (!db) return { synced: 0, failed: 0 };

  const pending = await db.syncQueue
    .where("status")
    .anyOf(["pending", "failed"])
    .toArray();

  let synced = 0;
  let failed = 0;

  if (pending.length === 0) return { synced, failed };

  const response = await fetch("/api/sync/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: pending.map(({ action, entity, payload, timestamp }) => ({
        action,
        entity,
        payload,
        timestamp,
      })),
    }),
  });

  if (!response.ok) {
    for (const item of pending) {
      await db.syncQueue.update(item.id, {
        status: "failed",
        retryCount: item.retryCount + 1,
        error: "Sync request failed",
      });
      failed++;
    }
    return { synced, failed };
  }

  const result = await response.json();

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const itemResult = result.results?.[i];
    if (itemResult?.success) {
      await db.syncQueue.update(item.id, { status: "synced" });
      synced++;
    } else {
      await db.syncQueue.update(item.id, {
        status: "failed",
        retryCount: item.retryCount + 1,
        error: itemResult?.error || "Unknown error",
      });
      failed++;
    }
  }

  return { synced, failed };
}

export function useOnlineStatus() {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}
