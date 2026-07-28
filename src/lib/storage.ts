import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "animal-photos";

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isCloudStorageConfigured(): boolean {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
  );
}

/**
 * Upload an animal photo.
 * Uses Supabase Storage when configured; otherwise writes to public/uploads (local/dev).
 */
export async function uploadAnimalPhoto(
  file: File
): Promise<{ url: string; storage: "supabase" | "local" }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filename = `${randomUUID()}.${ext || "jpg"}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const objectPath = `animals/${filename}`;
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    return { url: data.publicUrl, storage: "supabase" };
  }

  // Local fallback (dev / VPS with persistent disk)
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return { url: `/uploads/${filename}`, storage: "local" };
}
