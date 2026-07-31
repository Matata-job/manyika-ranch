import { prepareImageForUpload } from "@/lib/client/prepare-image";

/**
 * Compress a phone/gallery image then POST to /api/upload.
 */
export async function uploadPhotoFile(
  file: File,
  folder = "animals",
  failedMessage = "Photo upload failed"
): Promise<string> {
  const prepared = await prepareImageForUpload(file);
  const fd = new FormData();
  fd.append("file", prepared);
  fd.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || failedMessage
    );
  }
  const { url } = await res.json();
  return url as string;
}
