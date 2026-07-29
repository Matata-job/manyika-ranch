import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

function getBucketName(): string {
  const raw = process.env.SUPABASE_STORAGE_BUCKET || "animal-photos";
  return raw.toLowerCase();
}

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
 * Upload a photo. `folder` controls the path inside the bucket (e.g. "animals", "users").
 */
export async function uploadPhoto(
  file: File,
  folder = "animals"
): Promise<{ url: string; storage: "supabase" | "local" }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const filename = `${randomUUID()}.${ext || "jpg"}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const bucket = getBucketName();

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const objectPath = `${folder}/${filename}`;
    const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

    if (error) {
      throw new Error(
        `Supabase upload failed (bucket: ${bucket}): ${error.message}. ` +
          `Check SUPABASE_STORAGE_BUCKET matches your Supabase bucket name exactly.`
      );
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return { url: data.publicUrl, storage: "supabase" };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Photo storage is not configured on Vercel. Set NEXT_PUBLIC_SUPABASE_URL, " +
        "SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET in Vercel env vars, then redeploy."
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return { url: `/uploads/${filename}`, storage: "local" };
}

/** Backward-compatible alias */
export const uploadAnimalPhoto = (file: File) => uploadPhoto(file, "animals");
