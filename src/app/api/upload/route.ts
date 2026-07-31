import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { uploadPhoto } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const result = await requireAuth();
  if (!result.ok) return result.error;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const maxSize = 12 * 1024 * 1024; // after client compress most are <3MB; allow larger originals as fallback
  if (file.size > maxSize) {
    return NextResponse.json(
      {
        error:
          "File too large (max 12MB). Try a smaller photo or use the camera.",
      },
      { status: 400 }
    );
  }

  const type = (file.type || "").toLowerCase();
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/gif",
    "application/octet-stream", // some mobile galleries omit a real MIME
    "",
  ];
  const looksLikeImage =
    !type ||
    allowed.includes(type) ||
    type.startsWith("image/") ||
    /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name || "");

  if (!looksLikeImage) {
    return NextResponse.json(
      { error: `Invalid file type: ${file.type || "unknown"}` },
      { status: 400 }
    );
  }

  const folder = (formData.get("folder") as string) || "animals";

  try {
    const { url, storage } = await uploadPhoto(file, folder);
    return NextResponse.json({ url, storage });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
