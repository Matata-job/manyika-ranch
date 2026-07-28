import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-guard";
import { uploadAnimalPhoto } from "@/lib/storage";

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

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  try {
    const { url, storage } = await uploadAnimalPhoto(file);
    return NextResponse.json({ url, storage });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
