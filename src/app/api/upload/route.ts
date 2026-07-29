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

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (file.type && !allowed.includes(file.type) && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: `Invalid file type: ${file.type}` }, { status: 400 });
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
