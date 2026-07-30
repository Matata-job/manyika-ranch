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

export interface PendingPhoto {
  id?: number;
  queueId: number;
  /** ArrayBuffer survives IndexedDB more reliably than File/Blob across browsers. */
  data: ArrayBuffer;
  fileName: string;
  mimeType: string;
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
  pendingPhotos!: EntityTable<PendingPhoto, "id">;
  animals!: EntityTable<CachedAnimal, "id">;
  camps!: EntityTable<CachedCamp, "id">;

  constructor() {
    super("RanchDB");
    this.version(1).stores({
      syncQueue: "++id, entity, status, timestamp",
      animals: "id, eartag, campId, updatedAt",
      camps: "id, name, updatedAt",
    });
    this.version(2).stores({
      syncQueue: "++id, entity, status, timestamp",
      pendingPhotos: "++id, queueId",
      animals: "id, eartag, campId, updatedAt",
      camps: "id, name, updatedAt",
    });
  }
}

export const db = typeof window !== "undefined" ? new RanchDatabase() : null;

export async function enqueueSync(
  action: SyncQueueItem["action"],
  entity: string,
  payload: Record<string, unknown>,
  photos: File[] = []
): Promise<number | null> {
  if (!db) return null;

  const queueId = await db.syncQueue.add({
    action,
    entity,
    payload: {
      ...payload,
      photoCount: photos.length,
      recordedOfflineAt: new Date().toISOString(),
    },
    timestamp: Date.now(),
    retryCount: 0,
    status: "pending",
  });

  if (photos.length > 0) {
    const rows: Omit<PendingPhoto, "id">[] = [];
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const data = await file.arrayBuffer();
      if (!data.byteLength) {
        throw new Error("Photo data was empty — try choosing the photo again");
      }
      rows.push({
        queueId,
        data,
        fileName: file.name || `photo-${Date.now()}-${i}.jpg`,
        mimeType: file.type || "image/jpeg",
      });
    }
    await db.pendingPhotos.bulkAdd(rows);
  }

  return queueId;
}

export async function getPendingSyncCount(): Promise<number> {
  if (!db) return 0;
  try {
    return await db.syncQueue.where("status").anyOf(["pending", "failed"]).count();
  } catch {
    return 0;
  }
}

async function uploadQueuedPhotos(queueId: number): Promise<string[]> {
  if (!db) return [];

  const photos = await db.pendingPhotos.where("queueId").equals(queueId).toArray();
  const urls: string[] = [];

  for (const photo of photos) {
    const bytes = photo.data;
    if (!bytes || !(bytes instanceof ArrayBuffer) || bytes.byteLength === 0) {
      // Legacy rows may still have a Blob in `blob` from older schema
      const legacy = photo as PendingPhoto & { blob?: Blob };
      if (legacy.blob instanceof Blob && legacy.blob.size > 0) {
        const file = new File([legacy.blob], photo.fileName, {
          type: photo.mimeType || "image/jpeg",
        });
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "animals");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || "Photo upload failed during sync"
          );
        }
        const { url } = await res.json();
        urls.push(url as string);
        continue;
      }
      throw new Error("Stored photo data is missing — re-save the animal with photos");
    }

    const file = new File([bytes], photo.fileName, {
      type: photo.mimeType || "image/jpeg",
    });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "animals");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error || "Photo upload failed during sync"
      );
    }
    const { url } = await res.json();
    urls.push(url as string);
  }

  return urls;
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

  const prepared: {
    id: number;
    action: SyncQueueItem["action"];
    entity: string;
    payload: Record<string, unknown>;
    timestamp: number;
  }[] = [];

  for (const item of pending) {
    try {
      await db.syncQueue.update(item.id, { status: "syncing" });
      let payload = { ...item.payload };
      const expectedPhotos = Number(payload.photoCount || 0);

      if (item.entity === "animal" && item.action === "create") {
        const photoUrls = await uploadQueuedPhotos(item.id);
        if (expectedPhotos > 0 && photoUrls.length === 0) {
          throw new Error(
            "Photos were attached offline but could not be uploaded. Try sync again."
          );
        }
        if (photoUrls.length > 0) {
          payload = {
            ...payload,
            photoUrls,
            photoUrl: photoUrls[0],
          };
        }
      }

      prepared.push({
        id: item.id,
        action: item.action,
        entity: item.entity,
        payload,
        timestamp: item.timestamp,
      });
    } catch (e) {
      await db.syncQueue.update(item.id, {
        status: "failed",
        retryCount: item.retryCount + 1,
        error: e instanceof Error ? e.message : "Photo upload failed",
      });
      failed++;
    }
  }

  if (prepared.length === 0) return { synced, failed };

  const response = await fetch("/api/sync/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: prepared.map(({ action, entity, payload, timestamp }) => ({
        action,
        entity,
        payload,
        timestamp,
      })),
    }),
  });

  if (!response.ok) {
    for (const item of prepared) {
      const original = pending.find((p) => p.id === item.id);
      await db.syncQueue.update(item.id, {
        status: "failed",
        retryCount: (original?.retryCount || 0) + 1,
        error: "Sync request failed",
      });
      failed++;
    }
    return { synced, failed };
  }

  const result = await response.json();

  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    const itemResult = result.results?.[i];
    if (itemResult?.success) {
      await db.syncQueue.update(item.id, { status: "synced" });
      await db.pendingPhotos.where("queueId").equals(item.id).delete();
      await db.syncQueue.delete(item.id);
      synced++;
    } else {
      const original = pending.find((p) => p.id === item.id);
      await db.syncQueue.update(item.id, {
        status: "failed",
        retryCount: (original?.retryCount || 0) + 1,
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
