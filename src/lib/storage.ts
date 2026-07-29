import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

function getBucketName(): string {
  const raw = process.env.SUPABASE_STORAGE_BUCKET || "animal-photos";
  return raw.trim().toLowerCase().replace(/^["']|["']$/g, "");
}

/** Strip quotes, trailing slashes, and accidental /storage/v1 suffixes. */
export function normalizeSupabaseUrl(raw: string): string {
  let url = raw.trim().replace(/^["']|["']$/g, "");
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/storage\/v1\/?$/, "");
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }
  return url;
}

function getSupabaseConfig(): { url: string; key: string } | null {
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!rawUrl || !rawKey) return null;

  const url = normalizeSupabaseUrl(rawUrl);
  const key = rawKey.trim().replace(/^["']|["']$/g, "");

  if (!url.includes("supabase.co") && !url.includes("supabase.in")) {
    throw new Error(
      "SUPABASE_URL must be your Supabase project URL (e.g. https://abcdefgh.supabase.co), " +
        "not a database connection string. Find it in Supabase → Project Settings → API → Project URL."
    );
  }

  return { url, key };
}

function getSupabaseAdmin(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isCloudStorageConfigured(): boolean {
  try {
    return getSupabaseConfig() !== null;
  } catch {
    return false;
  }
}

/** Upload via Supabase Storage REST API (reliable on Vercel serverless). */
async function uploadToSupabase(
  buffer: Buffer,
  objectPath: string,
  contentType: string
): Promise<string> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase not configured");

  const bucket = getBucketName();
  const uploadUrl = `${config.url}/storage/v1/object/${bucket}/${objectPath}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.key}`,
      apikey: config.key,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase upload failed (bucket: ${bucket}): ${body || res.statusText}. ` +
        `Verify NEXT_PUBLIC_SUPABASE_URL is exactly https://YOUR-PROJECT.supabase.co (no /storage/v1 at the end).`
    );
  }

  return `${config.url}/storage/v1/object/public/${bucket}/${objectPath}`;
}

/**
 * Upload a photo. `folder` controls the path inside the bucket (e.g. "animals", "users").
 */
export async function uploadPhoto(
  file: File,
  folder = "animals"
): Promise<{ url: string; storage: "supabase" | "local" }> {
  const ext = (file.name.split(".").pop() || "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const filename = `${randomUUID()}.${ext || "jpg"}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "image/jpeg";
  const objectPath = `${folder}/${filename}`;

  if (getSupabaseConfig()) {
    const publicUrl = await uploadToSupabase(buffer, objectPath, contentType);
    return { url: publicUrl, storage: "supabase" };
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
